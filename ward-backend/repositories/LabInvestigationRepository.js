const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class LabInvestigationRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM LabInvestigations WHERE patientId = ? AND tenantId = ? AND deletedAt IS NULL ORDER BY investigationDate ASC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO LabInvestigations
         (id, patientId, tenantId, investigationDate, dayLabel, results, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.investigationDate,
        data.dayLabel || null,
        typeof data.results === 'string' ? data.results : JSON.stringify(data.results),
        data.recordedBy,
      ]
    );
    return dbAdapter.get(`SELECT * FROM LabInvestigations WHERE id = ?`, [id]);
  }

  async update(id, tenantId, data) {
    await dbAdapter.run(
      `UPDATE LabInvestigations
       SET investigationDate = ?, dayLabel = ?, results = ?, recordedBy = ?
       WHERE id = ? AND tenantId = ? AND deletedAt IS NULL`,
      [
        data.investigationDate,
        data.dayLabel || null,
        typeof data.results === 'string' ? data.results : JSON.stringify(data.results),
        data.recordedBy,
        id,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM LabInvestigations WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }

  async delete(id, tenantId) {
    return dbAdapter.run(
      `UPDATE LabInvestigations SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ? AND deletedAt IS NULL`,
      [id, tenantId]
    );
  }
}

module.exports = new LabInvestigationRepository();
