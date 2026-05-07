const dbAdapter = require('../db-adapter');

class AuthRepository {
  async findUserByName(username) {
    return dbAdapter.get(`SELECT * FROM Users WHERE name = ?`, [username]);
  }

  async findTenantById(tenantId) {
    return dbAdapter.get(`SELECT * FROM Tenants WHERE id = ?`, [tenantId]);
  }

  async createTenantAndAdmin({ tenantId, tenantName, userId, name, email, passwordHash }) {
    return dbAdapter.withTransaction(async (tx) => {
      const existing = await tx.get(`SELECT id FROM Tenants WHERE id = ?`, [tenantId]);
      if (existing) {
        const err = new Error('Registration failed. That hospital code is already registered.');
        err.code = 'TENANT_EXISTS';
        throw err;
      }

      await tx.run(`INSERT INTO Tenants (id, name) VALUES (?, ?)`, [tenantId, tenantName]);

      const existingUser = await tx.get(`SELECT id FROM Users WHERE name = ?`, [name]);
      if (existingUser) {
        const err = new Error('Registration failed. Please try a different username.');
        err.code = 'USER_EXISTS';
        throw err;
      }

      await tx.run(
        `INSERT INTO Users (id, name, role, tenantId, passwordHash, email)
         VALUES (?, ?, 'admin', ?, ?, ?)`,
        [userId, name, tenantId, passwordHash, email || null]
      );
    });
  }

  async createUser({ userId, tenantId, name, role, email, passwordHash }) {
    return dbAdapter.withTransaction(async (tx) => {
      const existing = await tx.get(`SELECT id FROM Users WHERE name = ?`, [name]);
      if (existing) {
        const err = new Error('Registration failed. Please try a different username.');
        err.code = 'USER_EXISTS';
        throw err;
      }
      await tx.run(
        `INSERT INTO Users (id, name, role, tenantId, passwordHash, email) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, name, role, tenantId, passwordHash, email || null]
      );
    });
  }

  async incrementTokenVersion(userId) {
    await dbAdapter.run(
      `UPDATE Users SET tokenVersion = tokenVersion + 1 WHERE id = ?`,
      [userId]
    );
  }
}

module.exports = new AuthRepository();
