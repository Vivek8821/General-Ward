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
    const token = authHeader && authHeader.split(' ')[1];
    
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
