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

  listByPatient(patientId, tenantId, status = 'open') {
    return new Promise((resolve, reject) => {
      const tenant = tenantId || 'tenant-default';
      const query = `
        SELECT *
        FROM Tasks
        WHERE patientId = ? AND tenantId = ? AND status = ?
        ORDER BY dueAt ASC, timestamp DESC
      `;
      db.all(query, [patientId, tenant, status], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  listMyOpenTasks(assignee, tenantId) {
    return new Promise((resolve, reject) => {
      const tenant = tenantId || 'tenant-default';
      const query = `
        SELECT
          t.*,
          p.name AS patientName,
          p.bedNumber AS bedNumber
        FROM Tasks t
        JOIN Patients p ON t.patientId = p.id AND p.tenantId = t.tenantId
        WHERE t.assignee = ? AND t.status = 'open' AND t.tenantId = ?
        ORDER BY t.dueAt ASC, t.timestamp DESC
      `;

      db.all(query, [assignee, tenant], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  complete(taskId, completedBy, tenantId) {
    return new Promise((resolve, reject) => {
      const tenant = tenantId || 'tenant-default';
      db.run(
        `
          UPDATE Tasks
          SET status = 'completed',
              completedBy = ?,
              completedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND tenantId = ? AND status = 'open'
        `,
        [completedBy, taskId, tenant],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new TaskRepository();

