const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class MedicalHistoryRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM MedicalHistory WHERE patientId = ? AND tenantId = ?`,
      [patientId, tenantId]
    );
  }

  async upsert(data) {
    const existing = await this.getByPatient(data.patientId, data.tenantId);
    if (existing) {
      await dbAdapter.run(
        `UPDATE MedicalHistory
         SET comorbidities = ?, surgicalHistory = ?, familyHistory = ?, socialHistory = ?,
             updatedBy = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE patientId = ? AND tenantId = ?`,
        [
          data.comorbidities || null,
          data.surgicalHistory || null,
          data.familyHistory || null,
          data.socialHistory || null,
          data.updatedBy || data.createdBy,
          data.patientId,
          data.tenantId,
        ]
      );
      return this.getByPatient(data.patientId, data.tenantId);
    }
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO MedicalHistory
         (id, patientId, tenantId, comorbidities, surgicalHistory, familyHistory, socialHistory, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.comorbidities || null,
        data.surgicalHistory || null,
        data.familyHistory || null,
        data.socialHistory || null,
        data.createdBy,
      ]
    );
    return this.getByPatient(data.patientId, data.tenantId);
  }
}

module.exports = new MedicalHistoryRepository();
