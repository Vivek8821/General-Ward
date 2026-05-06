const dbAdapter = require('../db-adapter');

class HandoverNotesRepository {
  async create({ id, tenantId, patientId, shift, note, tags, createdBy }) {
    const tenant = tenantId || 'tenant-default';
    await dbAdapter.run(
      `INSERT INTO HandoverNotes (id, tenantId, patientId, shift, note, tags, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant, patientId, shift, note, tags || null, createdBy]
    );

    return {
      id,
      tenantId: tenant,
      patientId,
      shift,
      note,
      tags: tags || null,
      createdBy
    };
  }

  async listByPatient(patientId, tenantId, { shift, from, to, limit = 50, cursor } = {}) {
    const tenant = tenantId || 'tenant-default';
    let query = `
      SELECT *
      FROM HandoverNotes
      WHERE patientId = ? AND tenantId = ?
    `;
    const params = [patientId, tenant];

    if (shift) {
      query += ` AND shift = ?`;
      params.push(shift);
    }

    if (from) {
      query += ` AND timestamp >= ?`;
      params.push(from);
    }

    if (to) {
      query += ` AND timestamp <= ?`;
      params.push(to);
    }

    // Cursor pagination (descending timestamp):
    // cursor format: "<timestampISO>|<id>"
    if (cursor && typeof cursor === 'string') {
      const parts = cursor.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const cursorTimestamp = parts[0];
        const cursorId = parts[1];
        query += ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
        params.push(cursorTimestamp, cursorTimestamp, cursorId);
      }
    }

    query += ` ORDER BY timestamp DESC, id DESC LIMIT ?`;
    params.push(limit);

    return dbAdapter.all(query, params);
  }
}

module.exports = new HandoverNotesRepository();

