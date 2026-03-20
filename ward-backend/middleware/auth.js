const jwt = require('jsonwebtoken');
const JWT_SECRET_ENV = process.env.JWT_SECRET;
let JWT_SECRET;
if (JWT_SECRET_ENV) {
  JWT_SECRET = JWT_SECRET_ENV;
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
} else {
  // Local/test fallback only. Do not use in production.
  JWT_SECRET = 'super-secret-key-change-in-production';
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET not set; using insecure fallback (non-production only).');
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

    // Phase C.2 migration: accept token from the HttpOnly cookie set at login.
    // We parse `req.headers.cookie` manually to avoid adding a cookie dependency.
    const cookieHeader = req.headers.cookie || '';
    let tokenFromCookie = null;
    if (cookieHeader) {
        const parts = cookieHeader.split(';');
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const [name, ...rest] = trimmed.split('=');
            if (name === 'ward_token') {
                tokenFromCookie = rest.join('=').trim();
                break;
            }
        }
    }

    const token = tokenFromHeader || tokenFromCookie;

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
