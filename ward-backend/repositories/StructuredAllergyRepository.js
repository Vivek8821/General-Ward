const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class StructuredAllergyRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM StructuredAllergies WHERE patientId = ? AND tenantId = ? ORDER BY recordedAt ASC`,
      [patientId, tenantId]
    );
  }

  async create(data) {
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO StructuredAllergies
         (id, patientId, tenantId, allergen, category, reaction, severity, verificationMethod, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.allergen,
        data.category,
        data.reaction,
        data.severity,
        data.verificationMethod || null,
        data.recordedBy,
      ]
    );
    return dbAdapter.get(`SELECT * FROM StructuredAllergies WHERE id = ?`, [id]);
  }

  async update(id, tenantId, data) {
    await dbAdapter.run(
      `UPDATE StructuredAllergies
       SET allergen = ?, category = ?, reaction = ?, severity = ?, verificationMethod = ?
       WHERE id = ? AND tenantId = ?`,
      [
        data.allergen,
        data.category,
        data.reaction,
        data.severity,
        data.verificationMethod || null,
        id,
        tenantId,
      ]
    );
    return dbAdapter.get(`SELECT * FROM StructuredAllergies WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }

  async delete(id, tenantId) {
    return dbAdapter.run(
      `DELETE FROM StructuredAllergies WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }
}

module.exports = new StructuredAllergyRepository();
