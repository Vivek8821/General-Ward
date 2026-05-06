const dbAdapter = require('../db-adapter');
const crypto = require('crypto');

class ObservationRepository {
  async findAllByPatientId(patientId, tenantId, { type, limit, cursorTs, cursorId }) {
    let query = `SELECT * FROM DailyStats WHERE patientId = ? AND tenantId = ?`;
    const params = [patientId, tenantId];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    if (cursorTs && cursorId) {
      query += ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
      params.push(cursorTs, cursorTs, cursorId);
    }

    query += ` ORDER BY timestamp DESC, id DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    return dbAdapter.all(query, params);
  }

  async findLatestByType(patientId, tenantId, type) {
    return dbAdapter.get(
      `SELECT * FROM DailyStats WHERE patientId = ? AND tenantId = ? AND type = ? ORDER BY timestamp DESC LIMIT 1`,
      [patientId, tenantId, type]
    );
  }

  async findLatestTwoByType(patientId, tenantId, type) {
    return dbAdapter.all(
      `SELECT * FROM DailyStats
       WHERE patientId = ? AND tenantId = ? AND type = ?
       ORDER BY timestamp DESC
       LIMIT 2`,
      [patientId, tenantId, type]
    );
  }

  async create(data) {
    const { id, tenantId, patientId, type, data: observationData, recordedBy, timestamp } = data;
    const dataString = typeof observationData === 'object' ? JSON.stringify(observationData) : observationData;
    
    if (timestamp) {
      return dbAdapter.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, type, dataString, recordedBy, timestamp]
      );
    } else {
      return dbAdapter.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, type, dataString, recordedBy]
      );
    }
  }

  async insertIdempotencyKey({ idempotencyKey, tenantId, userId, patientId, endpoint }) {
    if (dbAdapter.isPostgresEnabled()) {
      return dbAdapter.run(
        `INSERT INTO IdempotencyKeys (idempotencyKey, tenantId, userId, patientId, endpoint, status)
         VALUES (?, ?, ?, ?, ?, 'processing')
         ON CONFLICT (idempotencyKey, tenantId, userId, patientId, endpoint) DO NOTHING`,
        [idempotencyKey, tenantId, userId, patientId, endpoint]
      );
    }
    return dbAdapter.run(
      `INSERT OR IGNORE INTO IdempotencyKeys (idempotencyKey, tenantId, userId, patientId, endpoint, status)
       VALUES (?, ?, ?, ?, ?, 'processing')`,
      [idempotencyKey, tenantId, userId, patientId, endpoint]
    );
  }

  async findIdempotencyKey(idempotencyKey, tenantId, userId, patientId, endpoint) {
    return dbAdapter.get(
      `SELECT status, responseStatus, responseJson
       FROM IdempotencyKeys
       WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
      [idempotencyKey, tenantId, userId, patientId, endpoint]
    );
  }

  async updateIdempotencyKey(idempotencyKey, tenantId, userId, patientId, endpoint, { status, responseStatus, responseJson }) {
    return dbAdapter.run(
      `UPDATE IdempotencyKeys
       SET status = ?, responseStatus = ?, responseJson = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
      [status, responseStatus, responseJson, idempotencyKey, tenantId, userId, patientId, endpoint]
    );
  }

  async deleteIdempotencyKey(idempotencyKey, tenantId, userId, patientId, endpoint) {
    return dbAdapter.run(
      `DELETE FROM IdempotencyKeys
       WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
      [idempotencyKey, tenantId, userId, patientId, endpoint]
    );
  }

  async findLatestVitalsByTenant(tenantId) {
    // This query gets the most recent 'vital' record for each patient in the tenant.
    return dbAdapter.all(
      `SELECT ds.* 
       FROM DailyStats ds
       INNER JOIN (
         SELECT patientId, MAX(timestamp) as max_ts
         FROM DailyStats
         WHERE tenantId = ? AND type = 'vital'
         GROUP BY patientId
       ) latest ON ds.patientId = latest.patientId AND ds.timestamp = latest.max_ts
       WHERE ds.tenantId = ? AND ds.type = 'vital'`,
      [tenantId, tenantId]
    );
  }
}

module.exports = new ObservationRepository();
