const { db } = require('../db');

class HandoverNotesRepository {
  create({ id, tenantId, patientId, shift, note, tags, createdBy }) {
    return new Promise((resolve, reject) => {
      const tenant = tenantId || 'tenant-default';
      db.run(
        `INSERT INTO HandoverNotes (id, tenantId, patientId, shift, note, tags, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, tenant, patientId, shift, note, tags || null, createdBy],
        function (err) {
          if (err) return reject(err);
          resolve({
            id,
            tenantId: tenant,
            patientId,
            shift,
            note,
            tags: tags || null,
            createdBy
          });
        }
      );
    });
  }

  listByPatient(patientId, { shift, from, to, limit = 50 }) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT *
        FROM HandoverNotes
        WHERE patientId = ?
      `;
      const params = [patientId];

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

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = new HandoverNotesRepository();

