/**
 * Double-submit CSRF: JWT carries `csrf`; browser sends matching `X-CSRF-Token`.
 * Skipped when no `csrf` claim (legacy tokens / tests) or no authenticated user.
 */
function verifyCsrfForMutations(req, res, next) {
  const method = req.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Endpoints that MUST be accessible without a CSRF token (e.g., initial authentication).
  const CSRF_ALLOWLIST = [
    '/api/auth/login',
    '/health',
    '/api/version'
  ];

  const path = req.originalUrl.split('?')[0];
  if (CSRF_ALLOWLIST.includes(path)) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  // Enforce CSRF for browser cookie-authenticated requests only.
  // Header-based clients (e.g. stress harness) do not use CSRF by design.
  if (req.authSource !== 'cookie') {
    return next();
  }

  if (!req.user.csrf) {
    return res.status(403).json({ error: 'Missing CSRF token' });
  }

  const header = req.headers['x-csrf-token'];
  if (!header || String(header) !== String(req.user.csrf)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  return next();
}

module.exports = { verifyCsrfForMutations };
