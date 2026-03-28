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
}

module.exports = new AuthService();
