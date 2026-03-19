const crypto = require('crypto');
const { db } = require('../db');

function auditLog(req, res, next) {
    // Capture response to log after execution completes (to get status codes if needed).
    // IMPORTANT: do not early-return based on req.user here, because authentication middleware
    // runs later in the chain and will populate req.user before `finish`.
    res.on('finish', () => {
        if (!req.user) return; // Skip if user is not authenticated.

        const path = req.originalUrl;

        // Exclude generic/noisy endpoints if needed (like health checks)
        if (path === '/health') return;

        const id = crypto.randomUUID();
        const userId = req.user.id || 'unknown';
        const userRole = req.user.role || 'unknown';
        const action = req.method;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400 ? 1 : 0;
        const tenantId = req.user.tenantId || 'tenant-default';

        db.run(
            `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, userRole, tenantId, action, path, ipAddress, statusCode, success],
            (err) => {
                if (err) {
                    console.error('Audit Log Error:', err.message);
                }
            }
        );
    });

    next();
}

module.exports = { auditLog };
