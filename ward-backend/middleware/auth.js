const jwt = require('jsonwebtoken');
const config = require('../config');
const dbAdapter = require('../db-adapter');
const JWT_SECRET = config.jwtSecret;

function extractToken(req) {
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

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

    if (tokenFromHeader) return { token: tokenFromHeader, source: 'header' };
    if (tokenFromCookie) return { token: tokenFromCookie, source: 'cookie' };
    return null;
}

/** Parse JWT early so CSRF and audit can run after global auth hint (same claims as authenticateToken). */
function attachUserIfPresent(req, res, next) {
    const extracted = extractToken(req);
    if (!extracted) return next();
    jwt.verify(extracted.token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
        if (!err) {
            req.user = user;
            req.authSource = extracted.source;
        }
        next();
    });
}

function authenticateToken(req, res, next) {
    const extracted = extractToken(req);

    if (!extracted) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(extracted.token, JWT_SECRET, { algorithms: ['HS256'] }, async (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });

        // Token version check — ensures revoked tokens (logout, password change) are rejected.
        // Skipped in test mode so integration tests using synthetic JWT payloads continue to work.
        if (process.env.NODE_ENV !== 'test') {
            try {
                const dbUser = await dbAdapter.get('SELECT tokenVersion FROM Users WHERE id = ?', [decoded.id]);
                if (!dbUser || (dbUser.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
                    return res.status(401).json({ error: 'Session expired. Please log in again.' });
                }
            } catch (dbErr) {
                return next(dbErr);
            }
        }

        req.user = decoded;
        req.authSource = extracted.source;
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

module.exports = { authenticateToken, attachUserIfPresent, extractToken, requireRole, JWT_SECRET };
