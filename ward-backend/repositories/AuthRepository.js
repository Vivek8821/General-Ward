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
        const err = new Error(`Hospital code "${tenantId}" is already registered`);
        err.code = 'TENANT_EXISTS';
        throw err;
      }

      await tx.run(`INSERT INTO Tenants (id, name) VALUES (?, ?)`, [tenantId, tenantName]);

      const existingUser = await tx.get(`SELECT id FROM Users WHERE name = ?`, [name]);
      if (existingUser) {
        const err = new Error(`Username "${name}" is already taken`);
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
}

module.exports = new AuthRepository();
