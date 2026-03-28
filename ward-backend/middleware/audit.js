const crypto = require('crypto');
const dbAdapter = require('../dbAdapter');

function auditLog(req, res, next) {
  res.on('finish', () => {
    if (!req.user) return;

    const path = req.originalUrl;

    if (path === '/health') return;

    const id = crypto.randomUUID();
    const userId = req.user.id || 'unknown';
    const userRole = req.user.role || 'unknown';
    const action = req.method;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400 ? 1 : 0;
    const tenantId = req.user.tenantId || 'tenant-default';

    dbAdapter
      .run(
        `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, userRole, tenantId, action, path, ipAddress, statusCode, success]
      )
      .catch((err) => {
        console.error('Audit Log Error:', err.message);
      });
  });

  next();
}

module.exports = { auditLog };
