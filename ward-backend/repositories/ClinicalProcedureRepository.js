const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ClinicalProcedureRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ClinicalProcedures WHERE patientId = ? AND tenantId = ? ORDER BY procedureDate ASC`,
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

  async update(id, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ClinicalProcedures
       SET procedureDate = ?, procedureName = ?, performedBy = ?, outcome = ?
       WHERE id = ? AND tenantId = ?`,
      [
        data.procedureDate,
        data.procedureName,
        data.performedBy,
        data.outcome || null,
        id,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalProcedures WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }

  async delete(id, tenantId) {
    return dbAdapter.run(
      `DELETE FROM ClinicalProcedures WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }
}

module.exports = new ClinicalProcedureRepository();
