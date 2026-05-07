const dbAdapter = require('../db-adapter');

class AuthRepository {
  async findUserByName(username) {
    return dbAdapter.get(`SELECT * FROM Users WHERE name = ?`, [username]);
  }

  async createUser({ id, name, role, tenantId, passwordHash }) {
    return dbAdapter.run(
      `INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`,
      [id, name, role, tenantId, passwordHash]
    );
  }
}

module.exports = new AuthRepository();
