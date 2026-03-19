const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const authService = require('../services/AuthService');
const authLockoutRepository = require('../repositories/AuthLockoutRepository');

const LOGIN_LOCKOUT_MESSAGE = 'Too many login attempts from this IP, please try again after 15 minutes';

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const ipAddress = getClientIp(req);

        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password are required' });
        }

        // Enterprise hardening: DB-backed lockout (username + ipAddress).
        if (await authLockoutRepository.isLocked(username, ipAddress)) {
          return res.status(429).json({ error: LOGIN_LOCKOUT_MESSAGE });
        }

        const result = await authService.authenticateUser(username, password);
        await authLockoutRepository.reset(username, ipAddress);
        res.json(result);
    } catch (error) {
        const { username } = req.body || {};
        const ipAddress = getClientIp(req);

        // Always record failures so lockout can activate for both unknown users and wrong passwords.
        // (Do not reveal which part failed.)
        try {
          if (username) await authLockoutRepository.recordFailure(username, ipAddress);
        } catch (_) {
          // If lockout recording fails, continue with normal auth response.
        }

        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
