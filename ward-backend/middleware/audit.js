const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

function extractPatientId(urlPath) {
  const m = urlPath.match(/^\/api\/patients\/([^\/]+)(?:\/|$)/);
  if (!m) return null;
  const seg = m[1];
  if (seg === 'archives') return null;
  return seg;
}

function auditLog(req, res, next) {
  res.on('finish', () => {
    if (!req.user) return;

    const path = (req.originalUrl || '').split('?')[0];

    if (path === '/health') return;

    const id = crypto.randomUUID();
    const userId = req.user.id || 'unknown';
    const userRole = req.user.role || 'unknown';
    const action = req.method;
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400 ? 1 : 0;
    const tenantId = req.user.tenantId || 'tenant-default';
    const patientId = extractPatientId(path);

    dbAdapter
      .run(
        `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success, patientId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, userRole, tenantId, action, path, ipAddress, statusCode, success, patientId]
      )
      .catch((err) => {
        console.error('Audit Log Error:', err.message);
      });
  });

  next();
}

module.exports = { auditLog };
