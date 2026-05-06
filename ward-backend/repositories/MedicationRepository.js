const dbAdapter = require('../db-adapter');
const crypto = require('crypto');

class MedicationRepository {
  async findAllByPatientId(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM Medications WHERE patientId = ? AND tenantId = ? ORDER BY startDate DESC`,
      [patientId, tenantId]
    );
  }

  async findById(medId, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM Medications WHERE id = ? AND tenantId = ?`,
      [medId, tenantId]
    );
  }

  async create(data) {
    const { id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, prescribedBy } = data;
    await dbAdapter.run(
      `INSERT INTO Medications (id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, status, prescribedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn ? 1 : 0, startDate, prescribedBy]
    );
    return id;
  }

  async updateStatus(medId, patientId, tenantId, status) {
    return dbAdapter.run(
      `UPDATE Medications SET status = ? WHERE id = ? AND patientId = ? AND tenantId = ?`,
      [status, medId, patientId, tenantId]
    );
  }

  async findAdministrationsByPatientId(patientId, tenantId, { limit, cursorTs, cursorId }) {
    let query = `
      SELECT ma.*, m.name as medName, m.dosage, m.route
      FROM MedicationAdministrations ma
      JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
      WHERE ma.patientId = ? AND ma.tenantId = ?
    `;
    const params = [tenantId, patientId, tenantId];

    if (cursorTs && cursorId) {
      query += ` AND (ma.timestamp < ? OR (ma.timestamp = ? AND ma.id < ?))`;
      params.push(cursorTs, cursorTs, cursorId);
    }

    query += ` ORDER BY ma.timestamp DESC, ma.id DESC`;
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    return dbAdapter.all(query, params);
  }

  async findAdministrationById(adminId, tenantId) {
    return dbAdapter.get(
      `SELECT ma.*, m.dosage AS medDosage, ma.medicationId
       FROM MedicationAdministrations ma
       JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
       WHERE ma.id = ? AND ma.tenantId = ?`,
      [tenantId, adminId, tenantId]
    );
  }

  async createAdministration(data) {
    const { id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy, timestamp } = data;
    
    const query = timestamp
      ? `INSERT INTO MedicationAdministrations (id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO MedicationAdministrations (id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = timestamp
      ? [id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy, timestamp]
      : [id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy];

    // Retry logic is usually better in Service, but we'll keep it simple here.
    return dbAdapter.run(query, params);
  }

  async updateAdministration(adminId, patientId, tenantId, data) {
    const { status, notes, doseActuallyGiven, reasonCode } = data;
    return dbAdapter.run(
      `UPDATE MedicationAdministrations
       SET status = ?, notes = ?, doseActuallyGiven = ?, reasonCode = ?
       WHERE id = ? AND patientId = ? AND tenantId = ?`,
      [status, notes, doseActuallyGiven, reasonCode, adminId, patientId, tenantId]
    );
  }

  async deleteAdministration(adminId, patientId, tenantId) {
    return dbAdapter.run(
      `DELETE FROM MedicationAdministrations WHERE id = ? AND patientId = ? AND tenantId = ?`,
      [adminId, patientId, tenantId]
    );
  }
}

module.exports = new MedicationRepository();
