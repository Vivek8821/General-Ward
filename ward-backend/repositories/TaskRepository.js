const { db } = require('../db');

class TaskRepository {
  create({ id, tenantId, patientId, type, dueAt, status, assignee, notes, createdBy }) {
    return new Promise((resolve, reject) => {
      const tenant = tenantId || 'tenant-default';
      db.run(
        `INSERT INTO Tasks (id, tenantId, patientId, type, dueAt, status, assignee, notes, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenant, patientId, type, dueAt, status || 'open', assignee, notes || null, createdBy],
        function (err) {
          if (err) return reject(err);
          resolve({
            id,
            tenantId: tenant,
            patientId,
            type,
            dueAt,
            status: status || 'open',
            assignee,
            notes: notes || null,
            createdBy
          });
        }
      );
    });
  }

  listByPatient(patientId, status = 'open') {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM Tasks
        WHERE patientId = ? AND status = ?
        ORDER BY dueAt ASC, timestamp DESC
      `;
      db.all(query, [patientId, status], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  listMyOpenTasks(assignee) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          t.*,
          p.name AS patientName,
          p.bedNumber AS bedNumber
        FROM Tasks t
        JOIN Patients p ON t.patientId = p.id
        WHERE t.assignee = ? AND t.status = 'open'
        ORDER BY t.dueAt ASC, t.timestamp DESC
      `;

      db.all(query, [assignee], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  complete(taskId, completedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `
          UPDATE Tasks
          SET status = 'completed',
              completedBy = ?,
              completedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'open'
        `,
        [completedBy, taskId],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new TaskRepository();

