const crypto = require('crypto');
const authRepository = require('../repositories/AuthRepository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

class AuthService {
  async authenticateUser(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const user = await authRepository.findUserByName(username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const tenantId = user.tenantId || 'tenant-default';
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, tenantId, csrf: csrfToken },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      csrfToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId },
    };
  }

  async registerHospital({ hospitalName, hospitalCode, adminName, email, password }) {
    if (!hospitalName || !String(hospitalName).trim()) {
      throw new Error('Hospital name is required');
    }
    if (!hospitalCode || !String(hospitalCode).trim()) {
      throw new Error('Hospital code is required');
    }
    if (!adminName || !String(adminName).trim()) {
      throw new Error('Admin name is required');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const tenantId = String(hospitalCode).trim().toLowerCase().replace(/\s+/g, '-');
    const tenantName = String(hospitalName).trim();
    const name = String(adminName).trim();

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await authRepository.createTenantAndAdmin({
      tenantId,
      tenantName,
      userId,
      name,
      email: email ? String(email).trim().toLowerCase() : null,
      passwordHash,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign(
      { id: userId, name, role: 'admin', tenantId, csrf: csrfToken },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      csrfToken,
      user: { id: userId, name, role: 'admin', tenantId },
    };
  }
}

module.exports = new AuthService();
