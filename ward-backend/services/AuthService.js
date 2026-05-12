const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const authRepository = require('../repositories/AuthRepository');
const { checkPasswordSecurity } = require('../utils/passwordSecurity');
const logger = require('../utils/logger');

const JWT_SECRET = config.jwtSecret;
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Truncate UA strings — full UA can be 500+ bytes and adds no security value beyond ~200 chars.
const MAX_UA_LENGTH = 200;

function truncateUA(ua) {
  if (!ua || typeof ua !== 'string') return null;
  return ua.length > MAX_UA_LENGTH ? ua.slice(0, MAX_UA_LENGTH) : ua;
}

class AuthService {
  // Issues a paired access JWT (15 min) + opaque refresh token (30 days).
  //
  // Session fixation prevention: the refresh token ID is always a fresh crypto.randomUUID()
  // generated here — the caller cannot influence or pre-set it. An attacker cannot establish
  // a known session before the victim logs in.
  //
  // context = { ipAddress, userAgent } — stored with the refresh token so anomalous use
  // from a different IP or browser can be detected at next refresh.
  async _generateTokenPair(user, context = {}) {
    const tenantId = user.tenantId || 'tenant-default';
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, role: user.role, tenantId, csrf: csrfToken, tv: user.tokenVersion ?? 0 },
      JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );

    const refreshId = crypto.randomUUID();
    await authRepository.createRefreshToken({
      id: refreshId,
      userId: user.id,
      tenantId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
      ipAddress: context.ipAddress || null,
      userAgent: truncateUA(context.userAgent),
    });

    return {
      accessToken,
      refreshId,
      csrfToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId },
    };
  }

  async authenticateUser(username, password, context = {}) {
    if (!username || !password) throw new Error('Username and password are required');

    const user = await authRepository.findUserByName(username);
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    return this._generateTokenPair(user, context);
  }

  async registerHospital({ hospitalName, hospitalCode, adminName, email, employeeCode, password, context = {} }) {
    if (!hospitalName || !String(hospitalName).trim()) throw new Error('Hospital name is required');
    if (!hospitalCode || !String(hospitalCode).trim()) throw new Error('Hospital code is required');
    if (!adminName || !String(adminName).trim()) throw new Error('Admin name is required');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

    const tenantId = String(hospitalCode).trim().toLowerCase().replace(/\s+/g, '-');
    const tenantName = String(hospitalName).trim();
    const name = String(adminName).trim();
    const securityErr = await checkPasswordSecurity(password);
    if (securityErr) throw Object.assign(new Error(securityErr), { status: 400 });

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await authRepository.createTenantAndAdmin({
      tenantId, tenantName,
      tenantCode: String(hospitalCode).trim(),
      userId, name,
      email: email ? String(email).trim().toLowerCase() : null,
      employeeCode: employeeCode ? String(employeeCode).trim() : null,
      passwordHash,
    });

    const user = await authRepository.findUserById(userId);
    return this._generateTokenPair(user, context);
  }

  async createStaffMember({ adminUser, name, role, email, password }) {
    const ALLOWED_ROLES = ['doctor', 'nurse', 'pharmacist'];
    if (!name || !String(name).trim()) throw new Error('Name is required');
    if (!role || !ALLOWED_ROLES.includes(role))
      throw new Error(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    if (!password || String(password).length < 8)
      throw new Error('Password must be at least 8 characters');

    const securityErr = await checkPasswordSecurity(String(password));
    if (securityErr) throw Object.assign(new Error(securityErr), { status: 400 });

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(String(password), 12);
    await authRepository.createUser({
      userId,
      tenantId: adminUser.tenantId,
      name: String(name).trim(),
      role,
      email: email || null,
      passwordHash,
    });
    return { id: userId, name: String(name).trim(), role, tenantId: adminUser.tenantId };
  }

  // Validates the refresh token, checks for IP/UA anomalies, rotates the token,
  // and returns a fresh token pair. Hard-blocks on token mismatch/expiry; logs
  // but allows IP and UA changes (hospital staff roam networks, browsers update).
  async refresh(refreshId, context = {}) {
    if (!refreshId) {
      const err = new Error('No refresh token'); err.status = 401; throw err;
    }

    const stored = await authRepository.findRefreshToken(refreshId);
    if (!stored) {
      const err = new Error('Invalid refresh token'); err.status = 401; throw err;
    }
    if (new Date(stored.expiresAt) <= new Date()) {
      await authRepository.deleteRefreshToken(refreshId).catch(() => {});
      const err = new Error('Refresh token expired'); err.status = 401; throw err;
    }

    // Anomaly detection — log mismatches but do NOT hard-block. Hospital staff
    // frequently roam between APs (IP change) and browsers self-update (UA change).
    // These logs feed into operational monitoring; a SIEM can alert on patterns.
    if (stored.ipAddress && context.ipAddress && stored.ipAddress !== context.ipAddress) {
      logger.warn({
        event: 'session_ip_change',
        userId: stored.userId,
        tenantId: stored.tenantId,
        storedIp: stored.ipAddress,
        currentIp: context.ipAddress,
      });
    }
    if (stored.userAgent && context.userAgent) {
      const currentUA = truncateUA(context.userAgent);
      if (stored.userAgent !== currentUA) {
        logger.warn({
          event: 'session_ua_change',
          userId: stored.userId,
          tenantId: stored.tenantId,
        });
      }
    }

    const user = await authRepository.findUserById(stored.userId);
    if (!user) {
      const err = new Error('User not found'); err.status = 401; throw err;
    }

    // Rotate: delete old token before issuing new one.
    await authRepository.deleteRefreshToken(refreshId);
    return this._generateTokenPair(user, context);
  }

  async logout(userId, refreshId) {
    if (refreshId) {
      await authRepository.deleteRefreshToken(refreshId).catch(() => {});
    }
    await authRepository.incrementTokenVersion(userId);
  }

  // Invalidates ALL sessions for the user (every device / browser tab), then issues
  // a fresh token pair so the calling device stays signed in without re-authentication.
  // Other devices receive 401 on their next request and are redirected to /login.
  async logoutAll(userId, context = {}) {
    await authRepository.incrementTokenVersion(userId);
    await authRepository.deleteAllRefreshTokensForUser(userId);
    const user = await authRepository.findUserById(userId);
    if (!user) {
      const err = new Error('User not found'); err.status = 401; throw err;
    }
    return this._generateTokenPair(user, context);
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      const err = new Error('Current password is incorrect'); err.status = 400; throw err;
    }
    if (!newPassword || newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters'); err.status = 400; throw err;
    }
    if (currentPassword === newPassword) {
      const err = new Error('New password must differ from current password'); err.status = 400; throw err;
    }

    const securityErr = await checkPasswordSecurity(newPassword);
    if (securityErr) throw Object.assign(new Error(securityErr), { status: 400 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await authRepository.changePasswordAndInvalidateSessions(userId, passwordHash);

    const updatedUser = await authRepository.findUserById(userId);
    return this._generateTokenPair(updatedUser);
  }
}

module.exports = new AuthService();
