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
  max: 10,
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
  const { username, password } = req.body || {};
  const ipAddress = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Atomic check-and-reserve: if the lockout is active OR this attempt would exceed
  // the limit, reject before running bcrypt. Otherwise the counter is debited NOW so
  // parallel attempts can't all slip past a stale read and burn extra guesses.
  let reservation;
  try {
    reservation = await authLockoutRepository.tryAttempt(username, ipAddress);
  } catch (_) {
    reservation = { locked: false };
  }
  if (reservation.locked) {
    return res.status(429).json({ error: LOGIN_LOCKOUT_MESSAGE });
  }

  try {
    const result = await authService.authenticateUser(username, password);
    // Success clears the failure counter so the user starts fresh next time.
    await authLockoutRepository.reset(username, ipAddress);
    res.cookie('ward_token', result.token, getCookieOptions());
    res.json({ user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    // Counter was already incremented atomically by tryAttempt; nothing to do here.
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

const signupLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: { error: 'Too many signup attempts from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { hospitalName, hospitalCode, adminName, email, employeeCode, password } = req.body || {};
    const result = await authService.registerHospital({
      hospitalName,
      hospitalCode,
      adminName,
      email,
      employeeCode,
      password,
    });
    res.cookie('ward_token', result.token, getCookieOptions());
    res.status(201).json({ user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    if (error.code === 'TENANT_EXISTS') {
      return res.status(409).json({ error: error.message, code: 'TENANT_EXISTS' });
    }
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({ error: error.message, code: 'USER_EXISTS' });
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await authService.logout(req.user.id);
  } catch (_) {
    // Token version increment failed — still clear cookie
  }
  res.clearCookie('ward_token', getCookieOptions());
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticateToken, (req, res) => {
  const { user, csrfToken } = publicUserAndCsrf(req.user);
  res.json({ user, csrfToken });
});

module.exports = router;
