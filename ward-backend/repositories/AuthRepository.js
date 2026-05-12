const dbAdapter = require('../db-adapter');

class AuthRepository {
  // ── Users ──────────────────────────────────────────────────────────────────

  async findUserByName(username) {
    return dbAdapter.get(`SELECT * FROM Users WHERE name = ?`, [username]);
  }

  async findUserById(id) {
    return dbAdapter.get(`SELECT * FROM Users WHERE id = ?`, [id]);
  }

  async findUserByEmail(email) {
    return dbAdapter.get(`SELECT * FROM Users WHERE LOWER(email) = ?`, [email]);
  }

  async findTenantById(tenantId) {
    return dbAdapter.get(`SELECT * FROM Tenants WHERE id = ?`, [tenantId]);
  }

  async createTenantAndAdmin({ tenantId, tenantName, tenantCode, userId, name, email, employeeCode, passwordHash }) {
    return dbAdapter.withTransaction(async (tx) => {
      const existing = await tx.get(`SELECT id FROM Tenants WHERE id = ?`, [tenantId]);
      if (existing) {
        const err = new Error('Registration failed. That hospital code is already registered.');
        err.code = 'TENANT_EXISTS';
        throw err;
      }

      await tx.run(`INSERT INTO Tenants (id, name, code) VALUES (?, ?, ?)`, [tenantId, tenantName, tenantCode || null]);

      const existingUser = await tx.get(`SELECT id FROM Users WHERE name = ?`, [name]);
      if (existingUser) {
        const err = new Error('Registration failed. Please try a different username.');
        err.code = 'USER_EXISTS';
        throw err;
      }

      await tx.run(
        `INSERT INTO Users (id, name, role, tenantId, passwordHash, email, employeeCode)
         VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
        [userId, name, tenantId, passwordHash, email || null, employeeCode || null]
      );
    });
  }

  async createUser({ userId, tenantId, name, role, email, employeeCode, passwordHash }) {
    return dbAdapter.withTransaction(async (tx) => {
      const existing = await tx.get(`SELECT id FROM Users WHERE name = ?`, [name]);
      if (existing) {
        const err = new Error('Registration failed. Please try a different username.');
        err.code = 'USER_EXISTS';
        throw err;
      }
      await tx.run(
        `INSERT INTO Users (id, name, role, tenantId, passwordHash, email, employeeCode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, role, tenantId, passwordHash, email || null, employeeCode || null]
      );
    });
  }

  async incrementTokenVersion(userId) {
    await dbAdapter.run(
      `UPDATE Users SET tokenVersion = tokenVersion + 1 WHERE id = ?`,
      [userId]
    );
  }

  // Atomically update password + increment tokenVersion + delete all refresh tokens
  // for the user. All three steps are in one transaction so a crash mid-way leaves
  // no partial state.
  async changePasswordAndInvalidateSessions(userId, passwordHash) {
    await dbAdapter.withTransaction(async ({ runAsync }) => {
      await runAsync(
        `UPDATE Users SET passwordHash = ?, tokenVersion = tokenVersion + 1 WHERE id = ?`,
        [passwordHash, userId]
      );
      await runAsync(`DELETE FROM RefreshTokens WHERE userId = ?`, [userId]);
    });
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────────

  async createRefreshToken({ id, userId, tenantId, expiresAt, ipAddress = null, userAgent = null }) {
    await dbAdapter.run(
      `INSERT INTO RefreshTokens (id, userId, tenantId, expiresAt, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, tenantId, expiresAt, ipAddress, userAgent]
    );
  }

  async findRefreshToken(id) {
    return dbAdapter.get(`SELECT * FROM RefreshTokens WHERE id = ?`, [id]);
  }

  async deleteRefreshToken(id) {
    await dbAdapter.run(`DELETE FROM RefreshTokens WHERE id = ?`, [id]);
  }

  async deleteAllRefreshTokensForUser(userId) {
    await dbAdapter.run(`DELETE FROM RefreshTokens WHERE userId = ?`, [userId]);
  }
}

module.exports = new AuthRepository();
