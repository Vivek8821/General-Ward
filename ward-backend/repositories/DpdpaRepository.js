const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class DpdpaRepository {
  // ── Correction Requests ─────────────────────────────────────────────────

  async createCorrectionRequest({ tenantId, patientId, requestedBy, requestType, fieldsAffected, description }) {
    const id = crypto.randomUUID();
    const requestedAt = new Date().toISOString();
    await dbAdapter.run(
      `INSERT INTO DpdpaCorrectionRequests (id, tenantId, patientId, requestedBy, requestedAt, requestType, fieldsAffected, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, tenantId, patientId, requestedBy, requestedAt, requestType, fieldsAffected || null, description]
    );
    return { id, tenantId, patientId, requestedBy, requestedAt, requestType, fieldsAffected, description, status: 'pending' };
  }

  async listCorrectionRequests(tenantId, { status, patientId, limit = 50, cursor } = {}) {
    let q = `SELECT * FROM DpdpaCorrectionRequests WHERE tenantId = ?`;
    const params = [tenantId];
    if (status) { q += ' AND status = ?'; params.push(status); }
    if (patientId) { q += ' AND patientId = ?'; params.push(patientId); }
    if (cursor) {
      const [ts, id] = cursor.split('|');
      if (ts && id) { q += ` AND (createdAt < ? OR (createdAt = ? AND id < ?))`; params.push(ts, ts, id); }
    }
    q += ' ORDER BY createdAt DESC, id DESC LIMIT ?';
    params.push(Math.min(limit, 100));
    const rows = await dbAdapter.all(q, params);
    const nextCursor = rows.length === limit ? `${rows[rows.length - 1].createdAt}|${rows[rows.length - 1].id}` : null;
    return { items: rows, nextCursor };
  }

  async updateCorrectionRequest(id, tenantId, { status, reviewedBy, resolutionNotes }) {
    const resolvedAt = (status === 'resolved' || status === 'rejected') ? new Date().toISOString() : null;
    const result = await dbAdapter.run(
      `UPDATE DpdpaCorrectionRequests SET status=?, reviewedBy=?, resolutionNotes=?, resolvedAt=? WHERE id=? AND tenantId=?`,
      [status, reviewedBy || null, resolutionNotes || null, resolvedAt, id, tenantId]
    );
    if (result.changes === 0) throw new Error('Correction request not found');
    return { id, status, reviewedBy, resolutionNotes, resolvedAt };
  }

  // ── Grievances ──────────────────────────────────────────────────────────

  async createGrievance({ tenantId, patientId, complainantName, complainantContact, description, category }) {
    const id = crypto.randomUUID();
    const filedAt = new Date().toISOString();
    await dbAdapter.run(
      `INSERT INTO DpdpaGrievances (id, tenantId, patientId, complainantName, complainantContact, description, category, filedAt, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [id, tenantId, patientId || null, complainantName, complainantContact || null, description, category || 'other', filedAt]
    );
    return { id, tenantId, patientId, complainantName, complainantContact, description, category, filedAt, status: 'open' };
  }

  async listGrievances(tenantId, { status, limit = 50, cursor } = {}) {
    let q = `SELECT * FROM DpdpaGrievances WHERE tenantId = ?`;
    const params = [tenantId];
    if (status) { q += ' AND status = ?'; params.push(status); }
    if (cursor) {
      const [ts, id] = cursor.split('|');
      if (ts && id) { q += ` AND (createdAt < ? OR (createdAt = ? AND id < ?))`; params.push(ts, ts, id); }
    }
    q += ' ORDER BY createdAt DESC, id DESC LIMIT ?';
    params.push(Math.min(limit, 100));
    const rows = await dbAdapter.all(q, params);
    const nextCursor = rows.length === limit ? `${rows[rows.length - 1].createdAt}|${rows[rows.length - 1].id}` : null;
    return { items: rows, nextCursor };
  }

  async updateGrievance(id, tenantId, { status, assignedTo, resolutionNotes }) {
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    const result = await dbAdapter.run(
      `UPDATE DpdpaGrievances SET status=?, assignedTo=?, resolutionNotes=?, resolvedAt=? WHERE id=? AND tenantId=?`,
      [status, assignedTo || null, resolutionNotes || null, resolvedAt, id, tenantId]
    );
    if (result.changes === 0) throw new Error('Grievance not found');
    return { id, status, assignedTo, resolutionNotes, resolvedAt };
  }

  // ── Data Sharing Log ────────────────────────────────────────────────────

  async createDataSharingEntry({ tenantId, patientId, sharedWith, purposeOfSharing, dataCategories, sharedBy, legalBasis, consentReference }) {
    const id = crypto.randomUUID();
    const sharedAt = new Date().toISOString();
    await dbAdapter.run(
      `INSERT INTO DpdpaDataSharingLog (id, tenantId, patientId, sharedWith, purposeOfSharing, dataCategories, sharedAt, sharedBy, legalBasis, consentReference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, patientId, sharedWith, purposeOfSharing, dataCategories, sharedAt, sharedBy, legalBasis || 'other', consentReference || null]
    );
    return { id, tenantId, patientId, sharedWith, purposeOfSharing, dataCategories, sharedAt, sharedBy, legalBasis, consentReference };
  }

  async listDataSharingEntries(tenantId, { patientId, limit = 50, cursor } = {}) {
    let q = `SELECT * FROM DpdpaDataSharingLog WHERE tenantId = ?`;
    const params = [tenantId];
    if (patientId) { q += ' AND patientId = ?'; params.push(patientId); }
    if (cursor) {
      const [ts, id] = cursor.split('|');
      if (ts && id) { q += ` AND (createdAt < ? OR (createdAt = ? AND id < ?))`; params.push(ts, ts, id); }
    }
    q += ' ORDER BY createdAt DESC, id DESC LIMIT ?';
    params.push(Math.min(limit, 100));
    const rows = await dbAdapter.all(q, params);
    const nextCursor = rows.length === limit ? `${rows[rows.length - 1].createdAt}|${rows[rows.length - 1].id}` : null;
    return { items: rows, nextCursor };
  }

  // ── Retention Review ────────────────────────────────────────────────────

  async getPatientsForRetentionReview(tenantId, { daysAhead = 30 } = {}) {
    const cutoff = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await dbAdapter.all(
      `SELECT id, name, mrn, status, admittedAt, retention_due_at
       FROM Patients
       WHERE tenantId = ? AND retention_due_at IS NOT NULL AND retention_due_at <= ?
       ORDER BY retention_due_at ASC`,
      [tenantId, cutoff]
    );
    return rows.map(r => ({ ...r, isOverdue: r.retention_due_at < today }));
  }
}

module.exports = new DpdpaRepository();
