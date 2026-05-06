const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

async function collectFullPatientSnapshot(db, patientId, tenantId, dischargeSummaryId, dischargedBy) {
  const patient = await db.get(`SELECT * FROM Patients WHERE id = ? AND tenantId = ?`, [patientId, tenantId]);
  const [
    dailyStats,
    medications,
    medicationAdministrations,
    escalations,
    tasks,
    handoverNotes,
    dischargeSummaries,
  ] = await Promise.all([
    db.all(
      `SELECT * FROM DailyStats WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`,
      [patientId, tenantId]
    ),
    db.all(`SELECT * FROM Medications WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`, [patientId, tenantId]),
    db.all(
      `SELECT * FROM MedicationAdministrations WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`,
      [patientId, tenantId]
    ),
    db.all(`SELECT * FROM Escalations WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`, [patientId, tenantId]),
    db.all(`SELECT * FROM Tasks WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`, [patientId, tenantId]),
    db.all(`SELECT * FROM HandoverNotes WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`, [patientId, tenantId]),
    db.all(
      `SELECT * FROM DischargeSummaries WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`,
      [patientId, tenantId]
    ),
  ]);

  const dischargeSummary = dischargeSummaries.find((s) => s.id === dischargeSummaryId) || null;

  return {
    version: 1,
    collectedAt: new Date().toISOString(),
    dischargedBy,
    patient,
    dischargeSummary,
    dischargeSummaries,
    dailyStats,
    medications,
    medicationAdministrations,
    escalations,
    tasks,
    handoverNotes,
  };
}

class PatientRepository {
  async create(patientData) {
    const tenantId = patientData.tenantId || 'tenant-default';
    await dbAdapter.run(
      `INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status, admittedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        patientData.id,
        tenantId,
        patientData.name,
        patientData.mrn,
        patientData.bedNumber,
        patientData.dob,
        patientData.diagnosis,
        patientData.allergies,
        patientData.careIntensity || 1,
        patientData.admittedAt || new Date().toISOString(),
      ]
    );
    return { ...patientData, status: 'active' };
  }

  async findAll(tenantId) {
    const tenant = tenantId || 'tenant-default';
    return dbAdapter.all(
      `SELECT * FROM Patients WHERE tenantId = ? AND status IN ('active', 'escalated')`,
      [tenant]
    );
  }

  async findArchived(tenantId) {
    const tenant = tenantId || 'tenant-default';

    const fromArchives = await dbAdapter.all(
      `
      SELECT
        h.id AS archiveId,
        h.patientId,
        h.patientName AS name,
        h.mrn,
        h.bedNumber,
        h.archivedAt,
        h.dischargedBy,
        COALESCE(p.diagnosis, '') AS diagnosis,
        COALESCE(p.careIntensity, 1) AS careIntensity
      FROM HospitalArchives h
      LEFT JOIN Patients p ON p.id = h.patientId AND p.tenantId = h.tenantId
      WHERE h.tenantId = ?
      ORDER BY h.archivedAt DESC
      `,
      [tenant]
    );

    const legacy = await dbAdapter.all(
      `
      SELECT id AS patientId, name, mrn, bedNumber, diagnosis, careIntensity
      FROM Patients
      WHERE tenantId = ? AND status = 'discharged'
        AND id NOT IN (SELECT patientId FROM HospitalArchives WHERE tenantId = ?)
      `,
      [tenant, tenant]
    );

    const archivedRows = fromArchives.map((r) => ({
      archiveId: r.archiveId,
      patientId: r.patientId,
      id: r.archiveId,
      name: r.name,
      mrn: r.mrn,
      bedNumber: r.bedNumber,
      diagnosis: r.diagnosis,
      careIntensity: r.careIntensity,
      status: 'discharged',
      archivedAt: r.archivedAt,
      dischargedBy: r.dischargedBy,
    }));

    const legacyRows = legacy.map((p) => ({
      archiveId: null,
      patientId: p.patientId,
      id: p.patientId,
      name: p.name,
      mrn: p.mrn,
      bedNumber: p.bedNumber,
      diagnosis: p.diagnosis,
      careIntensity: p.careIntensity,
      status: 'discharged',
      archivedAt: null,
      dischargedBy: null,
    }));

    const combined = [...archivedRows, ...legacyRows];
    combined.sort((a, b) => {
      if (!a.archivedAt && !b.archivedAt) return 0;
      if (!a.archivedAt) return 1;
      if (!b.archivedAt) return -1;
      return new Date(b.archivedAt) - new Date(a.archivedAt);
    });
    return combined;
  }

  async findArchiveById(archiveId, tenantId) {
    const tenant = tenantId || 'tenant-default';
    const row = await dbAdapter.get(`SELECT * FROM HospitalArchives WHERE id = ? AND tenantId = ?`, [
      archiveId,
      tenant,
    ]);
    if (!row) return null;
    let snapshot = null;
    try {
      snapshot = JSON.parse(row.snapshotJson);
    } catch {
      snapshot = null;
    }
    const { snapshotJson, ...meta } = row;
    return { ...meta, snapshot };
  }

  async findById(id, tenantId) {
    const tenant = tenantId || 'tenant-default';
    return dbAdapter.get(`SELECT * FROM Patients WHERE id = ? AND tenantId = ?`, [id, tenant]);
  }

  async findDischargeSummary(patientId, tenantId) {
    const tenant = tenantId || 'tenant-default';
    return dbAdapter.get(
      `SELECT * FROM DischargeSummaries WHERE patientId = ? AND tenantId = ? ORDER BY timestamp DESC LIMIT 1`,
      [patientId, tenant]
    );
  }

  async update(id, patientData, tenantId) {
    const tenant = tenantId || 'tenant-default';
    const result = await dbAdapter.run(
      `UPDATE Patients
           SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ?, admittedAt = ?
           WHERE id = ? AND tenantId = ?`,
      [
        patientData.name,
        patientData.bedNumber,
        patientData.dob,
        patientData.diagnosis,
        patientData.allergies,
        patientData.careIntensity,
        patientData.admittedAt,
        id,
        tenant,
      ]
    );
    return result.changes;
  }

  async updateStatus(id, newStatus, tenantId) {
    const query = tenantId
      ? `UPDATE Patients SET status = ? WHERE id = ? AND tenantId = ?`
      : `UPDATE Patients SET status = ? WHERE id = ?`;
    const params = tenantId ? [newStatus, id, tenantId] : [newStatus, id];
    const result = await dbAdapter.run(query, params);
    return result.changes;
  }

  async discharge(patientId, data, dischargedBy, tenantId) {
    const tenant = tenantId || 'tenant-default';
    return dbAdapter.withTransaction(async ({ run, get, all }) => {
      const db = { run, get, all };

      const upd = await run(`UPDATE Patients SET status = 'discharged' WHERE id = ? AND tenantId = ?`, [
        patientId,
        tenant,
      ]);

      if (!upd || upd.changes === 0) {
        throw new Error('Patient not found');
      }

      const summaryId = crypto.randomUUID();
      const vitals = data.dischargeVitals ? JSON.stringify(data.dischargeVitals) : '{}';

      await run(
        `
                INSERT INTO DischargeSummaries (
                    id, tenantId, patientId, reasonForAdmission, duration,
                    medicationsDuringAdmission, dischargeVitals,
                    dischargeRecommendations, dischargedBy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          summaryId,
          tenant,
          patientId,
          data.reasonForAdmission,
          data.duration,
          data.medicationsDuringAdmission,
          vitals,
          data.dischargeRecommendations,
          dischargedBy,
        ]
      );

      const snapshot = await collectFullPatientSnapshot(db, patientId, tenant, summaryId, dischargedBy);
      const archiveId = crypto.randomUUID();
      const archivedAt = snapshot.collectedAt;
      const p = snapshot.patient;
      if (!p) {
        throw new Error('Patient not found');
      }

      await run(
        `
        INSERT INTO HospitalArchives (
          id, tenantId, patientId, dischargeSummaryId, archivedAt, dischargedBy,
          patientName, mrn, bedNumber, snapshotJson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          archiveId,
          tenant,
          patientId,
          summaryId,
          archivedAt,
          dischargedBy,
          p.name,
          p.mrn,
          p.bedNumber,
          JSON.stringify(snapshot),
        ]
      );

      return { message: 'Patient discharged successfully', summaryId, archiveId };
    });
  }
}

module.exports = new PatientRepository();
