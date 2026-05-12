const dbAdapter = require('../db-adapter');

class PasswordResetRepository {
  // Removes all existing tokens for a user before creating a new one.
  // Ensures only one active reset token exists per user at a time.
  async createToken({ id, userId, tenantId, tokenHash, expiresAt }) {
    await dbAdapter.withTransaction(async ({ runAsync }) => {
      await runAsync(
        'DELETE FROM PasswordResetTokens WHERE userId = ?',
        [userId]
      );
      await runAsync(
        `INSERT INTO PasswordResetTokens (id, userId, tenantId, tokenHash, expiresAt)
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, tenantId, tokenHash, expiresAt]
      );
    });
  }

  async findByTokenHash(tokenHash) {
    return dbAdapter.get(
      'SELECT * FROM PasswordResetTokens WHERE tokenHash = ?',
      [tokenHash]
    );
  }

  async markUsed(id) {
    await dbAdapter.run(
      'UPDATE PasswordResetTokens SET usedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async deleteByUserId(userId) {
    await dbAdapter.run(
      'DELETE FROM PasswordResetTokens WHERE userId = ?',
      [userId]
    );
  }
}

module.exports = new PasswordResetRepository();
