const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const authService = require('../services/AuthService');
const passwordResetService = require('../services/PasswordResetService');
const authLockoutRepository = require('../repositories/AuthLockoutRepository');
const { validateSignupPayload, bad } = require('../utils/validation');
const { validateHoneypot } = require('../middleware/abuseProtection');

const LOGIN_LOCKOUT_MESSAGE = 'Too many login attempts from this IP, please try again after 15 minutes';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many refresh requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many password change attempts. Please wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3 forgot-password requests per IP per hour prevents email flooding.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Cookie helpers ────────────────────────────────────────────────────────────

// SameSite policy:
//   Default: 'lax' — works for same-site deployments (frontend + API on same domain or localhost).
//   Override: set COOKIE_SAME_SITE=none for cross-origin deployments (different TLD for frontend vs API).
//   Note: SameSite=none REQUIRES Secure=true; browsers reject None+non-Secure since Chrome 80.
//
// Secure flag:
//   true in production/staging (HTTPS only), false in development (HTTP localhost).
//   Set NODE_ENV=production to enable. Do NOT set secure:true in HTTP-only dev — cookies won't be sent.
function getCookieSameSite() {
  return process.env.COOKIE_SAME_SITE || 'lax';
}

// Short-lived access token — 15 minutes, sent with every API request.
function getAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProdLike,
    sameSite: getCookieSameSite(),
    path: '/',
    maxAge: 15 * 60 * 1000,
  };
}

// Long-lived refresh token — 30 days, scoped to /api/auth so it is NOT sent
// with every API request (only reaches the server when explicitly refreshing).
function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProdLike,
    sameSite: getCookieSameSite(),
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

// clearCookie must include the same path/secure/sameSite that was used when setting
// the cookie, otherwise some browsers will not find and remove it.
function clearAuthCookies(res) {
  const base = { secure: config.isProdLike, sameSite: getCookieSameSite() };
  res.clearCookie('ward_token',   { ...base, path: '/' });
  res.clearCookie('ward_refresh', { ...base, path: '/api/auth' });
}

// Manually parses the Cookie header to extract the ward_refresh value.
// No cookie-parser dependency — mirrors the pattern used in middleware/auth.js.
function extractRefreshId(req) {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    if (name === 'ward_refresh') return trimmed.slice(eqIdx + 1).trim();
  }
  return null;
}

function setTokenPairCookies(res, result) {
  res.cookie('ward_token',   result.accessToken, getAccessCookieOptions());
  res.cookie('ward_refresh', result.refreshId,   getRefreshCookieOptions());
}

// Extracts the request context used for session binding (IP + User-Agent).
// IP/UA are stored with each refresh token so anomalous use from a different
// network or browser can be detected at the next refresh.
function getRequestContext(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || null,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/login', loginLimiter, validateHoneypot, async (req, res) => {
  const { username, password } = req.body || {};
  const context = getRequestContext(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let reservation;
  try {
    reservation = await authLockoutRepository.tryAttempt(username, context.ipAddress);
  } catch (_) {
    return res.status(503).json({ error: 'Authentication temporarily unavailable. Please try again later.' });
  }
  if (reservation.locked) {
    return res.status(429).json({ error: LOGIN_LOCKOUT_MESSAGE });
  }

  try {
    // Session fixation prevention: authenticateUser calls _generateTokenPair which
    // always issues a fresh crypto.randomUUID() — the caller cannot pre-set the session ID.
    const result = await authService.authenticateUser(username, password, context);
    await authLockoutRepository.reset(username, context.ipAddress);
    setTokenPairCookies(res, result);
    res.json({ user: result.user, csrfToken: result.csrfToken });
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/signup', signupLimiter, validateHoneypot, async (req, res) => {
  const body = req.body || {};
  const errors = validateSignupPayload(body);
  if (errors.length > 0) return bad(res, errors);

  try {
    const { hospitalName, hospitalCode, adminName, email, employeeCode, password } = body;
    const result = await authService.registerHospital({
      hospitalName, hospitalCode, adminName, email, employeeCode, password,
      context: getRequestContext(req),
    });
    setTokenPairCookies(res, result);
    res.status(201).json({ user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    if (error.code === 'TENANT_EXISTS') return res.status(409).json({ error: error.message, code: 'TENANT_EXISTS' });
    if (error.code === 'USER_EXISTS')   return res.status(409).json({ error: error.message, code: 'USER_EXISTS' });
    res.status(400).json({ error: error.message });
  }
});

// Exchanges a valid refresh token cookie for a fresh access + refresh token pair.
// No access token (or expired access token) is required — that is the whole point.
// The refresh cookie is scoped to /api/auth so it is only sent to this route.
// IP and UA are checked against stored values; anomalies are logged but not blocked.
router.post('/refresh', refreshLimiter, async (req, res) => {
  const refreshId = extractRefreshId(req);
  try {
    const result = await authService.refresh(refreshId, getRequestContext(req));
    setTokenPairCookies(res, result);
    res.json({ user: result.user, csrfToken: result.csrfToken });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  const refreshId = extractRefreshId(req);
  try {
    await authService.logout(req.user.id, refreshId);
  } catch (_) {
    // Still clear cookies even if server-side invalidation fails.
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});

// Invalidates ALL active sessions for this user across every device/browser.
// Issues a fresh token pair so the calling session stays signed in.
// All other sessions receive 401 on their next request.
router.post('/logout-all', authenticateToken, async (req, res, next) => {
  try {
    const result = await authService.logoutAll(req.user.id, getRequestContext(req));
    setTokenPairCookies(res, result);
    res.json({
      user: result.user,
      csrfToken: result.csrfToken,
      message: 'All other sessions have been signed out.',
    });
  } catch (err) {
    next(err);
  }
});

// Changes the authenticated user's password and invalidates ALL other sessions
// (both access tokens via tokenVersion bump and refresh tokens via DB deletion).
// Issues a fresh token pair so the current session continues without re-login.
router.put('/change-password', authenticateToken, changePasswordLimiter, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  try {
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    setTokenPairCookies(res, result);
    res.json({ user: result.user, csrfToken: result.csrfToken, message: 'Password changed. All other sessions have been signed out.' });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const { csrf, iat, exp, ...user } = req.user;
  res.json({ user, csrfToken: csrf });
});

// Initiates the password reset flow. Always responds 200 regardless of whether
// the email exists — prevents account enumeration via response.
router.post('/forgot-password', forgotPasswordLimiter, validateHoneypot, async (req, res) => {
  const { email } = req.body || {};
  // Fire and forget — do not await. Response is sent before the lookup completes
  // so timing cannot distinguish existing vs non-existing accounts.
  passwordResetService.requestReset(email).catch(() => {});
  res.json({ message: 'If an account with that email exists, we sent a reset link.' });
});

// Validates a reset token without consuming it. Returns 200 if valid so the
// frontend can show the reset form, 400 if invalid/expired/already-used.
router.get('/reset-password/validate', async (req, res) => {
  const { token } = req.query || {};
  try {
    await passwordResetService.validateToken(token);
    res.json({ valid: true });
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

// Consumes the reset token and sets a new password. Token is invalidated on first
// use and all existing sessions for the user are immediately revoked.
router.post('/reset-password', forgotPasswordLimiter, async (req, res, next) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required.' });
  }
  try {
    await passwordResetService.executeReset(token, newPassword);
    res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
