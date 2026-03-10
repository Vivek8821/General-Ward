const crypto = require('crypto');
const { db } = require('../db');

function auditLog(req, res, next) {
    if (!req.user) {
        return next(); // Skip if user is not authenticated yet (e.g., login route)
    }

    // Capture response to log after execution completes (to get status codes if needed)
    res.on('finish', () => {
        // We only want to log significant actions: GET (patient data), POST, PUT, DELETE
        const method = req.method;
        const path = req.originalUrl;
        
        // Exclude generic/noisy endpoints if needed (like health checks)
        if (path === '/health') return;

        const id = crypto.randomUUID();
        const userId = req.user.id || 'unknown';
        const userRole = req.user.role || 'unknown';
        const action = method;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

        db.run(
            `INSERT INTO AuditLogs (id, userId, userRole, action, resource, ipAddress) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, userId, userRole, action, path, ipAddress],
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
