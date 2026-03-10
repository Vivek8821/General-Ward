const { db } = require('../db');

class AuthRepository {
    findUserByName(username) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM Users WHERE name = ?`, [username], (err, user) => {
                if (err) return reject(err);
                resolve(user);
            });
        });
    }
}

module.exports = new AuthRepository();
