const dbAdapter = require('../dbAdapter');

class AuthRepository {
  async findUserByName(username) {
    return dbAdapter.get(`SELECT * FROM Users WHERE name = ?`, [username]);
  }
}

module.exports = new AuthRepository();
