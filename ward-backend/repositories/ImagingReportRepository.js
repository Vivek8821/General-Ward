const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ImagingReportRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ImagingReports WHERE patientId = ? AND tenantId = ? ORDER BY investigationDate ASC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO ImagingReports
         (id, patientId, tenantId, modalityType, investigationDate, equipment, findings, impression, reportedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.modalityType,
        data.investigationDate,
        data.equipment || null,
        data.findings,
        data.impression || null,
        data.reportedBy,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ImagingReports WHERE id = ?`, [id]);
  }

  async update(id, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ImagingReports
       SET modalityType = ?, investigationDate = ?, equipment = ?,
           findings = ?, impression = ?, reportedBy = ?
       WHERE id = ? AND tenantId = ?`,
      [
        data.modalityType,
        data.investigationDate,
        data.equipment || null,
        data.findings,
        data.impression || null,
        data.reportedBy,
        id,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ImagingReports WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }

  async delete(id, tenantId) {
    return dbAdapter.run(
      `DELETE FROM ImagingReports WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }
}

module.exports = new ImagingReportRepository();
