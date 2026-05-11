const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ClinicalTeamRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM ClinicalTeam WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`,
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

  async update(id, tenantId, data) {
    await dbAdapter.run(
      `UPDATE ClinicalTeam
       SET role = ?, name = ?, registrationNo = ?, qualification = ?,
           clinicalRemarks = ?, remarksDate = ?
       WHERE id = ? AND tenantId = ?`,
      [
        data.role,
        data.name,
        data.registrationNo || null,
        data.qualification || null,
        data.clinicalRemarks || null,
        data.remarksDate || null,
        id,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM ClinicalTeam WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }

  async delete(id, tenantId) {
    return dbAdapter.run(
      `DELETE FROM ClinicalTeam WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }
}

module.exports = new ClinicalTeamRepository();
