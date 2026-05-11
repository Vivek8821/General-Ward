const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const dbAdapter = require('../db-adapter');
const dpdpaRepository = require('../repositories/DpdpaRepository');

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
router.get('/audit-logs', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
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
      query += ' AND timestamp >= ?';
      params.push(from);
    }
    if (to && typeof to === 'string') {
      query += ' AND timestamp <= ?';
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

    const rows = await dbAdapter.all(query, params);
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
router.get('/audit-logs/export.csv', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
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
      query += ' AND timestamp >= ?';
      params.push(from);
    }
    if (to && typeof to === 'string') {
      query += ' AND timestamp <= ?';
      params.push(to);
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ?';
    params.push(exportMax);

    const rows = await dbAdapter.all(query, params);

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
/**
 * GET /api/admin/clinical-changes
 * Domain-level entity changes (tenant-scoped). Query: limit, cursor (timestamp|id), entityType, from, to
 */
router.get('/clinical-changes', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const parsedLimit = parseLimit(req.query.limit);
    if (parsedLimit === null) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    let query = `
      SELECT id, tenantId, userId, userRole, entityType, entityId, action, summary, timestamp
      FROM ClinicalChangeLog
      WHERE tenantId = ?
    `;
    const params = [tenantId];

    const { entityType, from, to, cursor } = req.query;
    if (entityType && typeof entityType === 'string') {
      query += ' AND entityType = ?';
      params.push(entityType);
    }
    if (from && typeof from === 'string') {
      query += ' AND timestamp >= ?';
      params.push(from);
    }
    if (to && typeof to === 'string') {
      query += ' AND timestamp <= ?';
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

    const rows = await dbAdapter.all(query, params);
    const nextCursor =
      rows.length === parsedLimit
        ? `${rows[rows.length - 1].timestamp}|${rows[rows.length - 1].id}`
        : null;

    res.json({ items: rows, nextCursor });
  } catch (err) {
    console.error('[adminAudit] clinical-changes', err);
    res.status(500).json({ error: err.message || 'Failed to list clinical changes' });
  }
});

/**
 * GET /api/admin/dpdpa/breach-report
 * Structured breach notification report from audit + clinical logs.
 * Satisfies DPDPA Section 8 — Data Fiduciary obligations.
 */
router.get('/dpdpa/breach-report', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { from, to, patientIds } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to (ISO date strings) are required' });
    }
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return res.status(400).json({ error: 'from and to must be valid ISO date strings' });
    }

    // SQLite stores timestamps as 'YYYY-MM-DD HH:MM:SS'; normalize ISO format for string comparison
    const sqlFrom = from.replace('T', ' ').replace('Z', '').slice(0, 19);
    const sqlTo = to.replace('T', ' ').replace('Z', '').slice(0, 19);

    const auditParams = [tenantId, sqlFrom, sqlTo];
    let patientFilter = '';
    if (patientIds && typeof patientIds === 'string') {
      const ids = patientIds.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
      if (ids.length > 0) {
        patientFilter = ` AND patientId IN (${ids.map(() => '?').join(',')})`;
        auditParams.push(...ids);
      }
    }

    const auditRows = await dbAdapter.all(
      `SELECT userId, userRole, action, resource, patientId, ipAddress, timestamp
       FROM AuditLogs
       WHERE tenantId = ? AND timestamp >= ? AND timestamp <= ?${patientFilter}
       ORDER BY timestamp ASC`,
      auditParams
    );

    const clinicalRows = await dbAdapter.all(
      `SELECT userId, userRole, entityType, entityId, action, summary, timestamp
       FROM ClinicalChangeLog
       WHERE tenantId = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
      [tenantId, sqlFrom, sqlTo]
    );

    const affectedPatientIds = [...new Set(
      auditRows.filter(r => r.patientId).map(r => r.patientId)
    )];

    const dataCategories = new Set();
    for (const row of auditRows) {
      const r = row.resource || '';
      if (r.includes('/vitals') || r.includes('/stats') || r.includes('/history')) dataCategories.add('clinical observations (vitals, symptoms, history)');
      if (r.includes('/medications')) dataCategories.add('medication records');
      if (r.includes('/notes')) dataCategories.add('handover notes');
      if (r.includes('/escalations')) dataCategories.add('escalation records');
      if (r.match(/\/api\/patients\/[^/]+(\/|$)/) && !r.includes('/medications') && !r.includes('/vitals') && !r.includes('/notes')) {
        dataCategories.add('patient demographic and clinical data');
      }
    }

    const accessingUsers = [...new Set(auditRows.map(r => `${r.userId} (${r.userRole})`))];

    res.json({
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name || req.user.id,
      reportingPeriod: { from, to },
      tenantId,
      approximateAffectedIndividuals: affectedPatientIds.length,
      affectedPatientIds,
      dataCategories: [...dataCategories],
      accessingUsers,
      totalAuditEvents: auditRows.length,
      totalClinicalChanges: clinicalRows.length,
      auditLog: auditRows,
      clinicalChanges: clinicalRows,
      breachNaturePlaceholder: '[Describe the nature of the breach]',
      measuresBeingTakenPlaceholder: '[Describe the measures being taken to address the breach]',
    });
  } catch (err) {
    console.error('[adminAudit] breach-report', err);
    res.status(500).json({ error: err.message || 'Failed to generate breach report' });
  }
});

/**
 * GET /api/admin/audit-logs/patient/:patientId
 * All audit log entries that accessed a specific patient's record.
 * Satisfies DPDPA Section 11 — Right to Access (who accessed this data).
 */
router.get('/audit-logs/patient/:patientId', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { patientId } = req.params;
    if (!patientId || typeof patientId !== 'string') {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const parsedLimit = parseLimit(req.query.limit);
    if (parsedLimit === null) return res.status(400).json({ error: 'Invalid limit' });

    let query = `
      SELECT id, userId, userRole, action, resource, ipAddress, statusCode, success, timestamp
      FROM AuditLogs
      WHERE tenantId = ? AND patientId = ?
    `;
    const params = [tenantId, patientId];

    const { from, to, cursor } = req.query;
    if (from && typeof from === 'string') { query += ' AND timestamp >= ?'; params.push(from); }
    if (to && typeof to === 'string') { query += ' AND timestamp <= ?'; params.push(to); }
    if (cursor && typeof cursor === 'string') {
      const parts = cursor.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        query += ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
        params.push(parts[0], parts[0], parts[1]);
      }
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ?';
    params.push(parsedLimit);

    const rows = await dbAdapter.all(query, params);
    const nextCursor = rows.length === parsedLimit
      ? `${rows[rows.length - 1].timestamp}|${rows[rows.length - 1].id}`
      : null;

    res.json({ patientId, items: rows, nextCursor });
  } catch (err) {
    console.error('[adminAudit] patient-access-log', err);
    res.status(500).json({ error: err.message || 'Failed to query patient access log' });
  }
});

router.post('/audit/purge', authenticateToken, authorize(PERMISSIONS.PURGE_AUDIT), async (req, res) => {
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
    const cutoffIso = new Date(Date.now() - days * 86400000).toISOString();

    const countSql = `
      SELECT COUNT(*) AS c FROM AuditLogs
      WHERE tenantId = ? AND timestamp < ?
    `;
    const row = await dbAdapter.get(countSql, [tenantId, cutoffIso]);
    const count = row ? Number(row.c) : 0;

    if (dryRun) {
      return res.json({ dryRun: true, wouldDelete: count, olderThanDays: days, tenantId });
    }

    const delSql = `
      DELETE FROM AuditLogs
      WHERE tenantId = ? AND timestamp < ?
    `;
    const result = await dbAdapter.run(delSql, [tenantId, cutoffIso]);
    return res.json({ dryRun: false, deleted: result.changes, olderThanDays: days, tenantId });
  } catch (err) {
    console.error('[adminAudit] purge', err);
    res.status(500).json({ error: err.message || 'Failed to purge audit logs' });
  }
});

// ── Correction Requests (Section 12) ────────────────────────────────────────

router.post('/dpdpa/correction-requests', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { patientId, requestedBy, requestType, fieldsAffected, description } = req.body || {};
    if (!patientId || !requestedBy || !requestType || !description) {
      return res.status(400).json({ error: 'patientId, requestedBy, requestType, and description are required' });
    }
    if (!['correction', 'erasure'].includes(requestType)) {
      return res.status(400).json({ error: 'requestType must be "correction" or "erasure"' });
    }
    if (typeof description !== 'string' || description.length > 5000) {
      return res.status(400).json({ error: 'description must be a string of 5000 characters or fewer' });
    }
    if (typeof requestedBy !== 'string' || requestedBy.length > 300) {
      return res.status(400).json({ error: 'requestedBy must be a string of 300 characters or fewer' });
    }
    if (fieldsAffected !== undefined && (typeof fieldsAffected !== 'string' || fieldsAffected.length > 500)) {
      return res.status(400).json({ error: 'fieldsAffected must be a string of 500 characters or fewer' });
    }
    const result = await dpdpaRepository.createCorrectionRequest({ tenantId, patientId, requestedBy, requestType, fieldsAffected, description });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpdpa/correction-requests', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { status, patientId, limit, cursor } = req.query;
    const result = await dpdpaRepository.listCorrectionRequests(tenantId, { status, patientId, limit: Number(limit) || 50, cursor });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/dpdpa/correction-requests/:id', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { status, resolutionNotes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });
    if (!['pending', 'under_review', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await dpdpaRepository.updateCorrectionRequest(req.params.id, tenantId, { status, reviewedBy: req.user.name || req.user.id, resolutionNotes });
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Grievances (Section 13) ──────────────────────────────────────────────────

router.post('/dpdpa/grievances', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { patientId, complainantName, complainantContact, description, category } = req.body || {};
    if (!complainantName || !description) {
      return res.status(400).json({ error: 'complainantName and description are required' });
    }
    if (typeof complainantName !== 'string' || complainantName.length > 300) {
      return res.status(400).json({ error: 'complainantName must be a string of 300 characters or fewer' });
    }
    if (typeof description !== 'string' || description.length > 5000) {
      return res.status(400).json({ error: 'description must be a string of 5000 characters or fewer' });
    }
    if (complainantContact !== undefined && (typeof complainantContact !== 'string' || complainantContact.length > 200)) {
      return res.status(400).json({ error: 'complainantContact must be a string of 200 characters or fewer' });
    }
    const validCategories = ['data_access', 'correction_delay', 'breach', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
    }
    const result = await dpdpaRepository.createGrievance({ tenantId, patientId, complainantName, complainantContact, description, category });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpdpa/grievances', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { status, limit, cursor } = req.query;
    const result = await dpdpaRepository.listGrievances(tenantId, { status, limit: Number(limit) || 50, cursor });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/dpdpa/grievances/:id', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { status, assignedTo, resolutionNotes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });
    if (!['open', 'in_progress', 'resolved', 'escalated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await dpdpaRepository.updateGrievance(req.params.id, tenantId, { status, assignedTo, resolutionNotes });
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Data Sharing Log (Section 11) ───────────────────────────────────────────

router.post('/dpdpa/data-sharing', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { patientId, sharedWith, purposeOfSharing, dataCategories, legalBasis, consentReference } = req.body || {};
    if (!patientId || !sharedWith || !purposeOfSharing || !dataCategories) {
      return res.status(400).json({ error: 'patientId, sharedWith, purposeOfSharing, and dataCategories are required' });
    }
    if (typeof sharedWith !== 'string' || sharedWith.length > 300) {
      return res.status(400).json({ error: 'sharedWith must be a string of 300 characters or fewer' });
    }
    if (typeof purposeOfSharing !== 'string' || purposeOfSharing.length > 1000) {
      return res.status(400).json({ error: 'purposeOfSharing must be a string of 1000 characters or fewer' });
    }
    if (typeof dataCategories !== 'string' || dataCategories.length > 1000) {
      return res.status(400).json({ error: 'dataCategories must be a string of 1000 characters or fewer' });
    }
    if (consentReference !== undefined && (typeof consentReference !== 'string' || consentReference.length > 200)) {
      return res.status(400).json({ error: 'consentReference must be a string of 200 characters or fewer' });
    }
    const validBases = ['care_referral', 'legal_obligation', 'consent', 'other'];
    if (legalBasis && !validBases.includes(legalBasis)) {
      return res.status(400).json({ error: `legalBasis must be one of: ${validBases.join(', ')}` });
    }
    const result = await dpdpaRepository.createDataSharingEntry({
      tenantId, patientId, sharedWith, purposeOfSharing, dataCategories,
      sharedBy: req.user.name || req.user.id, legalBasis, consentReference
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpdpa/data-sharing', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const { patientId, limit, cursor } = req.query;
    const result = await dpdpaRepository.listDataSharingEntries(tenantId, { patientId, limit: Number(limit) || 50, cursor });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Retention Review (Rule 8) ────────────────────────────────────────────────

router.get('/dpdpa/retention-review', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  try {
    const tenantId = tenantIdForUser(req.user);
    const daysAhead = Math.min(Number(req.query.daysAhead) || 30, 365);
    const results = await dpdpaRepository.getPatientsForRetentionReview(tenantId, { daysAhead });
    res.json({ daysAhead, count: results.length, patients: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
