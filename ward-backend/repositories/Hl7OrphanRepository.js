const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class Hl7OrphanRepository {
  async listPending(tenantId) {
    return dbAdapter.query(
      `SELECT o.*, m.receivedAt
         FROM Hl7OrphanedMessages o
         JOIN Hl7InboundMessages m ON m.id = o.inboundId
        WHERE o.tenantId = ? AND o.linkedPatientId IS NULL
        ORDER BY o.createdAt DESC
        LIMIT 200`,
      [tenantId]
    );
  }

  async findById(id, tenantId) {
    return dbAdapter.queryOne(
      `SELECT * FROM Hl7OrphanedMessages WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async linkToPatient(id, tenantId, patientId, linkedBy) {
    await dbAdapter.execute(
      `UPDATE Hl7OrphanedMessages
          SET linkedPatientId = ?, linkedAt = CURRENT_TIMESTAMP, linkedBy = ?
        WHERE id = ? AND tenantId = ? AND linkedPatientId IS NULL`,
      [patientId, linkedBy, id, tenantId]
    );
    return this.findById(id, tenantId);
  }

  async listByPatient(tenantId, patientId) {
    return dbAdapter.query(
      `SELECT * FROM Hl7OrphanedMessages WHERE tenantId = ? AND linkedPatientId = ? ORDER BY createdAt DESC`,
      [tenantId, patientId]
    );
  }
}

module.exports = new Hl7OrphanRepository();
