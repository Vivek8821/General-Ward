const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class ToxicologyScreenRepository {
  async getByPatient(patientId, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM ToxicologyScreens WHERE patientId = ? AND tenantId = ?`,
      [patientId, tenantId]
    );
  }

  async upsert(data) {
    const existing = await this.getByPatient(data.patientId, data.tenantId);
    const serialize = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));
    if (existing) {
      await dbAdapter.run(
        `UPDATE ToxicologyScreens
         SET screenDate = ?, bac = ?, drugScreen = ?, poisonScreen = ?, heavyMetals = ?, recordedBy = ?
         WHERE patientId = ? AND tenantId = ?`,
        [
          data.screenDate,
          serialize(data.bac),
          serialize(data.drugScreen),
          serialize(data.poisonScreen),
          serialize(data.heavyMetals),
          data.recordedBy,
          data.patientId,
          data.tenantId,
        ]
      );
      return this.getByPatient(data.patientId, data.tenantId);
    }
    const id = crypto.randomUUID();
    await dbAdapter.run(
      `INSERT INTO ToxicologyScreens
         (id, patientId, tenantId, screenDate, bac, drugScreen, poisonScreen, heavyMetals, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.patientId,
        data.tenantId,
        data.screenDate,
        serialize(data.bac),
        serialize(data.drugScreen),
        serialize(data.poisonScreen),
        serialize(data.heavyMetals),
        data.recordedBy,
      ]
    );
    return this.getByPatient(data.patientId, data.tenantId);
  }
}

module.exports = new ToxicologyScreenRepository();
