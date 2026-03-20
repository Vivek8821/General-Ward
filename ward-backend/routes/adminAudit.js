const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { allAsync, getAsync, runAsync } = require('../db');

const router = express.Router();
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function tenantIdForUser(user) {
  return user.tenantId || 'tenant-default';
}

function parseLimit(raw) {
  if (raw === undefined || raw === '') return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function resolveRetentionDays(body) {
  if (body && body.olderThanDays != null && body.olderThanDays !== '') {
    const d = Number(body.olderThanDays);
    if (!Number.isFinite(d) || d <= 0) {
      return { error: 'olderThanDays must be a positive number' };
    }
    return { days: Math.floor(d) };
  }
  const envDays = parseInt(process.env.AUDIT_RETENTION_DAYS, 10);
  if (Number.isFinite(envDays) && envDays > 0) return { days: envDays };
  return { error: 'Provide olderThanDays in the body or set AUDIT_RETENTION_DAYS in the environment' };
}

/**
 * GET /api/admin/audit-logs
 * Query: limit, cursor (timestamp|id), success (0|1), from, to (ISO date strings)
 */
router.get('/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const parsedLimit = parseLimit(req.query.limit);
    if (parsedLimit === null) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    let query = `
      SELECT id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success, timestamp
      FROM AuditLogs
      WHERE tenantId = ?
    `;
    const params = [tenantId];

    const { success, from, to, cursor } = req.query;
    if (success === '0' || success === '1') {
      query += ' AND success = ?';
      params.push(Number(success));
    }
    if (from && typeof from === 'string') {
      query += ' AND datetime(timestamp) >= datetime(?)';
      params.push(from);
    }
    if (to && typeof to === 'string') {
      query += ' AND datetime(timestamp) <= datetime(?)';
      params.push(to);
    }

    if (cursor && typeof cursor === 'string') {
      const parts = cursor.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const [cursorTs, cursorId] = parts;
        query += ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
        params.push(cursorTs, cursorTs, cursorId);
      }
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ?';
    params.push(parsedLimit);

    const rows = await allAsync(query, params);
    const nextCursor =
      rows.length === parsedLimit
        ? `${rows[rows.length - 1].timestamp}|${rows[rows.length - 1].id}`
        : null;

    res.json({ items: rows, nextCursor });
  } catch (err) {
    console.error('[adminAudit] list', err);
    res.status(500).json({ error: err.message || 'Failed to list audit logs' });
  }
});

/**
 * GET /api/admin/audit-logs/export.csv
 * Same query params as GET /audit-logs except no cursor pagination — capped export.
 */
router.get('/audit-logs/export.csv', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const exportMax = Math.min(parseLimit(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);

    let query = `
      SELECT id, timestamp, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success
      FROM AuditLogs
      WHERE tenantId = ?
    `;
    const params = [tenantId];

    const { success, from, to } = req.query;
    if (success === '0' || success === '1') {
      query += ' AND success = ?';
      params.push(Number(success));
    }
    if (from && typeof from === 'string') {
      query += ' AND datetime(timestamp) >= datetime(?)';
      params.push(from);
    }
    if (to && typeof to === 'string') {
      query += ' AND datetime(timestamp) <= datetime(?)';
      params.push(to);
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ?';
    params.push(exportMax);

    const rows = await allAsync(query, params);

    const header = [
      'id',
      'timestamp',
      'userId',
      'userRole',
      'tenantId',
      'action',
      'resource',
      'ipAddress',
      'statusCode',
      'success',
    ];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.id),
          csvEscape(row.timestamp),
          csvEscape(row.userId),
          csvEscape(row.userRole),
          csvEscape(row.tenantId),
          csvEscape(row.action),
          csvEscape(row.resource),
          csvEscape(row.ipAddress),
          csvEscape(row.statusCode),
          csvEscape(row.success),
        ].join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('[adminAudit] export', err);
    res.status(500).json({ error: err.message || 'Failed to export audit logs' });
  }
});

/**
 * POST /api/admin/audit/purge
 * Body: { dryRun: boolean, olderThanDays?: number }
 */
router.post('/audit/purge', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { dryRun } = req.body || {};
    if (typeof dryRun !== 'boolean') {
      return res.status(400).json({ error: 'dryRun (boolean) is required' });
    }

    const resolved = resolveRetentionDays(req.body);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    const { days } = resolved;
    const modifier = `-${days} days`;

    const countSql = `
      SELECT COUNT(*) AS c FROM AuditLogs
      WHERE tenantId = ? AND datetime(timestamp) < datetime('now', ?)
    `;
    const row = await getAsync(countSql, [tenantId, modifier]);
    const count = row ? row.c : 0;

    if (dryRun) {
      return res.json({ dryRun: true, wouldDelete: count, olderThanDays: days, tenantId });
    }

    const delSql = `
      DELETE FROM AuditLogs
      WHERE tenantId = ? AND datetime(timestamp) < datetime('now', ?)
    `;
    const result = await runAsync(delSql, [tenantId, modifier]);
    return res.json({ dryRun: false, deleted: result.changes, olderThanDays: days, tenantId });
  } catch (err) {
    console.error('[adminAudit] purge', err);
    res.status(500).json({ error: err.message || 'Failed to purge audit logs' });
  }
});

module.exports = router;
