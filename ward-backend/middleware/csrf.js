/**
 * Double-submit CSRF: JWT carries `csrf`; browser sends matching `X-CSRF-Token`.
 * Skipped when no `csrf` claim (legacy tokens / tests) or no authenticated user.
 */
function verifyCsrfForMutations(req, res, next) {
  const method = req.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  const path = req.originalUrl.split('?')[0];
  if (path === '/api/auth/login') {
    return next();
  }

  if (!req.user) {
    return next();
  }

  if (!req.user.csrf) {
    return next();
  }

  const header = req.headers['x-csrf-token'];
  if (!header || String(header) !== String(req.user.csrf)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  return next();
}

module.exports = { verifyCsrfForMutations };
