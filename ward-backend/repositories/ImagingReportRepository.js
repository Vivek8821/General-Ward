const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ImagingReportRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ImagingReports WHERE patientId = ? AND tenantId = ? AND deletedAt IS NULL ORDER BY investigationDate ASC`,
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

  async update(id, patientId, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ImagingReports
       SET modalityType = ?, investigationDate = ?, equipment = ?,
           findings = ?, impression = ?, reportedBy = ?
       WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [
        data.modalityType,
        data.investigationDate,
        data.equipment || null,
        data.findings,
        data.impression || null,
        data.reportedBy,
        id,
        patientId,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ImagingReports WHERE id = ? AND patientId = ? AND tenantId = ?`, [id, patientId, tenantId]);
  }

  async delete(id, patientId, tenantId) {
    return dbAdapter.run(
      `UPDATE ImagingReports SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [id, patientId, tenantId]
    );
  }
}

module.exports = new ImagingReportRepository();
