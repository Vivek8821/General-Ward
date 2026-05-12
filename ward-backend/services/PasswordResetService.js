const crypto = require('crypto');
const bcrypt = require('bcrypt');
const authRepository = require('../repositories/AuthRepository');
const passwordResetRepository = require('../repositories/PasswordResetRepository');
const emailService = require('./EmailService');
const { checkPasswordSecurity } = require('../utils/passwordSecurity');

const RESET_TOKEN_BYTES = 32;          // 256-bit raw token
const RESET_TTL_MINUTES = 20;
const RESET_TTL_MS = RESET_TTL_MINUTES * 60 * 1000;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

class PasswordResetService {
  // Requests a password reset for the given email.
  // Always responds the same way whether the account exists or not — no enumeration.
  // Email is sent fire-and-forget; caller gets back before email completes.
  async requestReset(email) {
    if (!email || typeof email !== 'string') return;

    const normalizedEmail = email.trim().toLowerCase();
    const user = await authRepository.findUserByEmail(normalizedEmail);

    if (!user) {
      // Unknown email — return silently. Timing attack mitigation: we still do a
      // small async pause so response time does not reveal account existence.
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
      return;
    }

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    const id = crypto.randomUUID();

    await passwordResetRepository.createToken({
      id,
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
    });

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

    // Fire and forget — do not await; response returns before email is sent
    // so timing cannot reveal whether the account exists.
    emailService
      .sendPasswordReset({
        toEmail: user.email || normalizedEmail,
        toName: user.name,
        resetUrl,
        expiresInMinutes: RESET_TTL_MINUTES,
      })
      .catch(() => {
        // Email failure is not surfaced to the caller.
        // Operators should alert on email service health separately.
      });
  }

  // Validates a raw token without consuming it. Returns the user record on success.
  // Used by the frontend to verify the token is valid before showing the reset form.
  async validateToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      const err = new Error('Invalid or expired reset link.'); err.status = 400; throw err;
    }

    const tokenHash = hashToken(rawToken);
    const record = await passwordResetRepository.findByTokenHash(tokenHash);

    if (!record) {
      const err = new Error('Invalid or expired reset link.'); err.status = 400; throw err;
    }
    if (record.usedAt) {
      const err = new Error('This reset link has already been used.'); err.status = 400; throw err;
    }
    if (new Date(record.expiresAt) <= new Date()) {
      const err = new Error('This reset link has expired. Please request a new one.'); err.status = 400; throw err;
    }

    return record;
  }

  // Consumes the token and resets the user's password.
  // Invalidates ALL existing sessions (tokenVersion + delete all refresh tokens).
  async executeReset(rawToken, newPassword) {
    const record = await this.validateToken(rawToken);

    if (!newPassword || newPassword.length < 8) {
      const err = new Error('Password must be at least 8 characters.'); err.status = 400; throw err;
    }

    const securityErr = await checkPasswordSecurity(newPassword);
    if (securityErr) {
      const err = new Error(securityErr); err.status = 400; throw err;
    }

    // Mark token as used first — if hashing or DB update fails the token is still
    // consumed so a crashed reset cannot be replayed.
    await passwordResetRepository.markUsed(record.id);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await authRepository.changePasswordAndInvalidateSessions(record.userId, passwordHash);

    // Clean up remaining tokens for this user (markUsed already prevents replay,
    // this just keeps the table tidy).
    await passwordResetRepository.deleteByUserId(record.userId).catch(() => {});
  }
}

module.exports = new PasswordResetService();
