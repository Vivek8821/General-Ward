const jwt = require('jsonwebtoken');
const config = require('../config');
const dbAdapter = require('../db-adapter');
const { extractToken } = require('./auth');
const logger = require('../utils/logger');

const JWT_SECRET = config.jwtSecret;

/**
 * protect(authzFn, options?)
 *
 * Returns an async Express middleware that:
 *   1. Verifies the access token (401 if missing/invalid/expired/revoked).
 *   2. Calls authzFn(req) to check resource-level authorization (403 if denied).
 *   3. Logs every denial as a structured warning for SIEM/monitoring.
 *
 * authzFn: async (req) => boolean | { allowed: boolean, reason?: string }
 *   - Receives the request with req.user already populated.
 *   - Return true / { allowed: true } to permit; false / { allowed: false } to deny.
 *
 * options:
 *   resource {string}  — label included in denial logs (e.g. 'patient', 'escalation')
 */
function protect(authzFn, options = {}) {
    const resource = options.resource || 'resource';

    return async function protectMiddleware(req, res, next) {
        // ── Step 1: extract and verify token ─────────────────────────────────
        const extracted = extractToken(req);
        if (!extracted) {
            logger.warn('access_denied_unauthenticated', {
                event: 'unauthenticated',
                resource,
                method: req.method,
                path: req.originalUrl,
                ip: req.ip,
            });
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        let decoded;
        try {
            decoded = await new Promise((resolve, reject) => {
                jwt.verify(extracted.token, JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
                    if (err) reject(err);
                    else resolve(payload);
                });
            });
        } catch {
            logger.warn('access_denied_invalid_token', {
                event: 'invalid_token',
                resource,
                method: req.method,
                path: req.originalUrl,
                ip: req.ip,
            });
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        // ── Step 2: token version check (revocation) ─────────────────────────
        if (process.env.NODE_ENV !== 'test') {
            try {
                const dbUser = await dbAdapter.get('SELECT tokenVersion FROM Users WHERE id = ?', [decoded.id]);
                if (!dbUser || (dbUser.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
                    logger.warn('access_denied_revoked_token', {
                        event: 'revoked_token',
                        resource,
                        userId: decoded.id,
                        tenantId: decoded.tenantId,
                        method: req.method,
                        path: req.originalUrl,
                        ip: req.ip,
                    });
                    return res.status(401).json({ error: 'Session expired. Please log in again.' });
                }
            } catch (dbErr) {
                return next(dbErr);
            }
        }

        req.user = decoded;
        req.authSource = extracted.source;

        // ── Step 3: resource-level authorization ─────────────────────────────
        let authzResult;
        try {
            authzResult = await authzFn(req);
        } catch (authzErr) {
            return next(authzErr);
        }

        const allowed = typeof authzResult === 'object' ? authzResult.allowed : authzResult === true;
        const reason = typeof authzResult === 'object' ? (authzResult.reason || 'authorization check failed') : 'authorization check failed';

        if (!allowed) {
            logger.warn('access_denied_unauthorized', {
                event: 'unauthorized',
                resource,
                reason,
                userId: decoded.id,
                userRole: decoded.role,
                tenantId: decoded.tenantId,
                method: req.method,
                path: req.originalUrl,
                ip: req.ip,
            });
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
}

module.exports = { protect };
