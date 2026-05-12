const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ClinicalProcedureRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ClinicalProcedures WHERE patientId = ? AND tenantId = ? AND deletedAt IS NULL ORDER BY procedureDate ASC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO ClinicalProcedures
         (id, patientId, tenantId, procedureDate, procedureName, performedBy, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.procedureDate,
        data.procedureName,
        data.performedBy,
        data.outcome || null,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalProcedures WHERE id = ?`, [id]);
  }

  async update(id, patientId, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ClinicalProcedures
       SET procedureDate = ?, procedureName = ?, performedBy = ?, outcome = ?
       WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [
        data.procedureDate,
        data.procedureName,
        data.performedBy,
        data.outcome || null,
        id,
        patientId,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalProcedures WHERE id = ? AND patientId = ? AND tenantId = ?`, [id, patientId, tenantId]);
  }

  async delete(id, patientId, tenantId) {
    return dbAdapter.run(
      `UPDATE ClinicalProcedures SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [id, patientId, tenantId]
    );
  }
}

module.exports = new ClinicalProcedureRepository();
