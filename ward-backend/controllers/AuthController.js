const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const authService = require('../services/AuthService');
const authLockoutRepository = require('../repositories/AuthLockoutRepository');

const LOGIN_LOCKOUT_MESSAGE = 'Too many login attempts from this IP, please try again after 15 minutes';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many login requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProdLike,
    sameSite: config.isProdLike ? 'none' : 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function publicUserAndCsrf(userPayload) {
  if (!userPayload) return { user: null, csrfToken: undefined };
  const { csrf, iat, exp, ...rest } = userPayload;
  return { user: rest, csrfToken: csrf };
}

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const ipAddress = getClientIp(req);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (await authLockoutRepository.isLocked(username, ipAddress)) {
      return res.status(429).json({ error: LOGIN_LOCKOUT_MESSAGE });
    }

    const result = await authService.authenticateUser(username, password);
    await authLockoutRepository.reset(username, ipAddress);
    res.cookie('ward_token', result.token, getCookieOptions());
    res.json({ user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    const { username } = req.body || {};
    const ipAddress = getClientIp(req);

    try {
      if (username) await authLockoutRepository.recordFailure(username, ipAddress);
    } catch (_) {
      // ignore
    }

    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    res.clearCookie('ward_token', getCookieOptions());
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.json({ message: 'Logged out' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const { user, csrfToken } = publicUserAndCsrf(req.user);
  res.json({ user, csrfToken });
});

module.exports = router;
