const dbAdapter = require('../db-adapter');

class TaskRepository {
  async create({ id, tenantId, patientId, type, dueAt, status, assignee, notes, createdBy }) {
    const tenant = tenantId || 'tenant-default';
    await dbAdapter.run(
      `INSERT INTO Tasks (id, tenantId, patientId, type, dueAt, status, assignee, notes, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant, patientId, type, dueAt, status || 'open', assignee, notes || null, createdBy]
    );

    return {
      id,
      tenantId: tenant,
      patientId,
      type,
      dueAt,
      status: status || 'open',
      assignee,
      notes: notes || null,
      createdBy
    };
  }

  async listByPatient(patientId, tenantId, status = 'open', { limit, cursor } = {}) {
    const tenant = tenantId || 'tenant-default';
    const query = `
      SELECT *
      FROM Tasks
      WHERE patientId = ? AND tenantId = ? AND status = ?
      ${cursor && typeof cursor === 'string' ? 'AND (dueAt > ? OR (dueAt = ? AND id > ?))' : ''}
      ORDER BY dueAt ASC, timestamp DESC, id ASC
    `;
    const params = [patientId, tenant, status];

    if (cursor && typeof cursor === 'string') {
      // cursor format: "<dueAtISO>|<id>"
      const parts = cursor.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        params.push(parts[0], parts[0], parts[1]);
      }
    }

    let finalQuery = query;
    const parsedLimit = limit !== undefined ? Number(limit) : null;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      finalQuery = `${query} LIMIT ?`;
      params.push(parsedLimit);
    }

    return dbAdapter.all(finalQuery, params);
  }

  async listMyOpenTasks(assignee, tenantId, { limit, cursor } = {}) {
    const tenant = tenantId || 'tenant-default';
    const query = `
      SELECT
        t.*,
        p.name AS patientName,
        p.bedNumber AS bedNumber
      FROM Tasks t
      JOIN Patients p ON t.patientId = p.id AND p.tenantId = t.tenantId
      WHERE t.assignee = ? AND t.status = 'open' AND t.tenantId = ?
      ${cursor && typeof cursor === 'string' ? 'AND (t.dueAt > ? OR (t.dueAt = ? AND t.id > ?))' : ''}
      ORDER BY t.dueAt ASC, t.timestamp DESC, t.id ASC
    `;

    const params = [assignee, tenant];
    let finalQuery = query;
    if (cursor && typeof cursor === 'string') {
      const parts = cursor.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        params.push(parts[0], parts[0], parts[1]);
      }
    }

    const parsedLimit = limit !== undefined ? Number(limit) : null;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      finalQuery = `${query} LIMIT ?`;
      params.push(parsedLimit);
    }

    return dbAdapter.all(finalQuery, params);
  }

  async complete(taskId, completedBy, tenantId) {
    const tenant = tenantId || 'tenant-default';
    const result = await dbAdapter.run(
      `
        UPDATE Tasks
        SET status = 'completed',
            completedBy = ?,
            completedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ? AND status = 'open'
      `,
      [completedBy, taskId, tenant]
    );

    return result.changes;
  }
}

module.exports = new TaskRepository();

