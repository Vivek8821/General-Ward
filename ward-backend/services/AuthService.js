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

  async signup({ username, password, role, hospitalName }) {
    if (!username || !password || !role) {
      throw new Error('Username, password and role are required');
    }

    const existingUser = await authRepository.findUserByName(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const tenantId = 'tenant-default'; // In a real system, we'd create a new tenant if hospitalName is provided

    await authRepository.createUser({
      id: userId,
      name: username,
      role,
      tenantId,
      passwordHash,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign(
      { id: userId, name: username, role, tenantId, csrf: csrfToken },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      csrfToken,
      user: { id: userId, name: username, role, tenantId },
    };
  }
}

module.exports = new AuthService();
