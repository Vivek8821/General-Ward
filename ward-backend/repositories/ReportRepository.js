const dbAdapter = require('../dbAdapter');

class ReportRepository {
  async findById(id, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM PatientReports WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async findAllByPatientId(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM PatientReports WHERE patientId = ? AND tenantId = ? ORDER BY generatedAt DESC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const { tenantId, patientId, reportType, reportHash, generatedByUserId, periodFrom, periodTo, metadata } = data;
    const res = await dbAdapter.run(
      `INSERT INTO PatientReports (tenantId, patientId, reportType, reportHash, generatedByUserId, periodFrom, periodTo, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, patientId, reportType, reportHash, generatedByUserId, periodFrom, periodTo, JSON.stringify(metadata || {})]
    );
    return res.lastID;
  }
}

module.exports = new ReportRepository();
