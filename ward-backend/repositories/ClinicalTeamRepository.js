const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ClinicalTeamRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ClinicalTeam WHERE patientId = ? AND tenantId = ? AND deletedAt IS NULL ORDER BY timestamp ASC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO ClinicalTeam
         (id, patientId, tenantId, role, name, registrationNo, qualification, clinicalRemarks, remarksDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.role,
        data.name,
        data.registrationNo || null,
        data.qualification || null,
        data.clinicalRemarks || null,
        data.remarksDate || null,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalTeam WHERE id = ?`, [id]);
  }

  async update(id, patientId, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ClinicalTeam
       SET role = ?, name = ?, registrationNo = ?, qualification = ?,
           clinicalRemarks = ?, remarksDate = ?
       WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [
        data.role,
        data.name,
        data.registrationNo || null,
        data.qualification || null,
        data.clinicalRemarks || null,
        data.remarksDate || null,
        id,
        patientId,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalTeam WHERE id = ? AND patientId = ? AND tenantId = ?`, [id, patientId, tenantId]);
  }

  async delete(id, patientId, tenantId) {
    return dbAdapter.run(
      `UPDATE ClinicalTeam SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND patientId = ? AND tenantId = ? AND deletedAt IS NULL`,
      [id, patientId, tenantId]
    );
  }
}

module.exports = new ClinicalTeamRepository();
