const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ClinicalPresentationRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM ClinicalPresentation WHERE patientId = ? AND tenantId = ?`,
      [patientId, tenantId]
    );
  }

  async upsert(data) {
    const existing = await this.getByPatient(data.patientId, data.tenantId);
    if (existing) {
      await dbAdapter.run(
        `UPDATE ClinicalPresentation
         SET historyOfPresentingIllness = ?, physicalExamFindings = ?,
             examinedBy = ?, examinedAt = CURRENT_TIMESTAMP
         WHERE patientId = ? AND tenantId = ?`,
        [
          data.historyOfPresentingIllness || null,
          data.physicalExamFindings || null,
          data.examinedBy,
          data.patientId,
          data.tenantId,
        ]
      );
      return this.getByPatient(data.patientId, data.tenantId);
    }
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO ClinicalPresentation
         (id, patientId, tenantId, historyOfPresentingIllness, physicalExamFindings, examinedBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.historyOfPresentingIllness || null,
        data.physicalExamFindings || null,
        data.examinedBy,
      ]
    );
    return this.getByPatient(data.patientId, data.tenantId);
  }
}

module.exports = new ClinicalPresentationRepository();
