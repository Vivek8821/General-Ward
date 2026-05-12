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
    medicalHistory,
    structuredAllergies,
    clinicalPresentation,
    labInvestigations,
    imagingReports,
    clinicalProcedures,
    clinicalTeam,
    toxicologyScreen,
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
    db.get(`SELECT * FROM MedicalHistory WHERE patientId = ? AND tenantId = ?`, [patientId, tenantId]),
    db.all(`SELECT * FROM StructuredAllergies WHERE patientId = ? AND tenantId = ? ORDER BY recordedAt ASC`, [patientId, tenantId]),
    db.get(`SELECT * FROM ClinicalPresentation WHERE patientId = ? AND tenantId = ?`, [patientId, tenantId]),
    db.all(`SELECT * FROM LabInvestigations WHERE patientId = ? AND tenantId = ? ORDER BY investigationDate ASC`, [patientId, tenantId]),
    db.all(`SELECT * FROM ImagingReports WHERE patientId = ? AND tenantId = ? ORDER BY investigationDate ASC`, [patientId, tenantId]),
    db.all(`SELECT * FROM ClinicalProcedures WHERE patientId = ? AND tenantId = ? ORDER BY procedureDate ASC`, [patientId, tenantId]),
    db.all(`SELECT * FROM ClinicalTeam WHERE patientId = ? AND tenantId = ? ORDER BY timestamp ASC`, [patientId, tenantId]),
    db.get(`SELECT * FROM ToxicologyScreens WHERE patientId = ? AND tenantId = ?`, [patientId, tenantId]),
  ]);

  const dischargeSummary = dischargeSummaries.find((s) => s.id === dischargeSummaryId) || null;

  return {
    version: 2,
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
    medicalHistory: medicalHistory || null,
    structuredAllergies: structuredAllergies || [],
    clinicalPresentation: clinicalPresentation || null,
    labInvestigations: labInvestigations || [],
    imagingReports: imagingReports || [],
    clinicalProcedures: clinicalProcedures || [],
    clinicalTeam: clinicalTeam || [],
    toxicologyScreen: toxicologyScreen || null,
  };
}

class PatientRepository {
  async create(patientData) {
    const tenantId = patientData.tenantId || 'tenant-default';
    await dbAdapter.run(
      `INSERT INTO Patients (
        id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status, admittedAt,
        gender, bloodGroup, contactNumber, emergencyContact,
        is_minor, notice_given_at, notice_given_by, guardian_name, guardian_contact, guardian_notice_at,
        data_nominee, data_nominee_relationship, retention_due_at,
        uhid, nationality, occupation, maritalStatus, codeStatus,
        insuranceProvider, insurancePolicyNo, tpaName, tpaClaimNo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientData.id,
        tenantId,
        patientData.name,
        patientData.mrn,
        patientData.bedNumber,
        patientData.dob,
        patientData.diagnosis,
        patientData.allergies || null,
        patientData.careIntensity || 1,
        patientData.admittedAt || new Date().toISOString(),
        patientData.gender || null,
        patientData.bloodGroup || null,
        patientData.contactNumber || null,
        patientData.emergencyContact || null,
        patientData.is_minor || 0,
        patientData.notice_given_at || null,
        patientData.notice_given_by || null,
        patientData.guardian_name || null,
        patientData.guardian_contact || null,
        patientData.guardian_notice_at || null,
        patientData.data_nominee || null,
        patientData.data_nominee_relationship || null,
        patientData.retention_due_at || null,
        patientData.uhid || null,
        patientData.nationality || null,
        patientData.occupation || null,
        patientData.maritalStatus || null,
        patientData.codeStatus || 'full_code',
        patientData.insuranceProvider || null,
        patientData.insurancePolicyNo || null,
        patientData.tpaName || null,
        patientData.tpaClaimNo || null,
      ]
    );
    return { ...patientData, status: 'active' };
  }

  async findAll(tenantId, { limit = 500 } = {}) {
    const tenant = tenantId || 'tenant-default';
    const rows = await dbAdapter.all(
      `SELECT * FROM Patients WHERE tenantId = ? AND status IN ('active', 'escalated') LIMIT ?`,
      [tenant, limit]
    );
    if (rows.length === limit) {
      console.warn(`[PatientRepository.findAll] result set hit limit=${limit} for tenant=${tenant} — consider pagination`);
    }
    return rows;
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
    
    // Fetch existing to preserve admittedAt if missing in payload
    const existing = await this.findById(id, tenant);
    if (!existing) return 0;

    const admittedAt = patientData.admittedAt || existing.admittedAt;

    const result = await dbAdapter.run(
      `UPDATE Patients
           SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ?, admittedAt = ?,
               uhid = ?, nationality = ?, occupation = ?, maritalStatus = ?, codeStatus = ?,
               insuranceProvider = ?, insurancePolicyNo = ?, tpaName = ?, tpaClaimNo = ?
           WHERE id = ? AND tenantId = ?`,
      [
        patientData.name || existing.name,
        patientData.bedNumber || existing.bedNumber,
        patientData.dob || existing.dob,
        patientData.diagnosis || existing.diagnosis,
        patientData.allergies !== undefined ? patientData.allergies : existing.allergies,
        patientData.careIntensity !== undefined ? patientData.careIntensity : existing.careIntensity,
        admittedAt,
        patientData.uhid !== undefined ? patientData.uhid : existing.uhid,
        patientData.nationality !== undefined ? patientData.nationality : existing.nationality,
        patientData.occupation !== undefined ? patientData.occupation : existing.occupation,
        patientData.maritalStatus !== undefined ? patientData.maritalStatus : existing.maritalStatus,
        patientData.codeStatus !== undefined ? patientData.codeStatus : existing.codeStatus,
        patientData.insuranceProvider !== undefined ? patientData.insuranceProvider : existing.insuranceProvider,
        patientData.insurancePolicyNo !== undefined ? patientData.insurancePolicyNo : existing.insurancePolicyNo,
        patientData.tpaName !== undefined ? patientData.tpaName : existing.tpaName,
        patientData.tpaClaimNo !== undefined ? patientData.tpaClaimNo : existing.tpaClaimNo,
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

      const serializeJson = (v) =>
        v == null ? null : typeof v === 'string' ? v : JSON.stringify(v);

      await run(
        `
                INSERT INTO DischargeSummaries (
                    id, tenantId, patientId, reasonForAdmission, duration,
                    medicationsDuringAdmission, dischargeVitals,
                    dischargeRecommendations, dischargedBy,
                    admissionDiagnosis, dischargeDiagnosis, conditionAtDischarge, dischargeMode,
                    dischargePrescription, followUpSchedule, dischargeInstructions, dietaryRestrictions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          data.admissionDiagnosis || null,
          data.dischargeDiagnosis || null,
          data.conditionAtDischarge || null,
          data.dischargeMode || null,
          serializeJson(data.dischargePrescription),
          serializeJson(data.followUpSchedule),
          data.dischargeInstructions || null,
          serializeJson(data.dietaryRestrictions),
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

      // NMC medical record retention: 5 years for IPD (general ward = inpatient).
      // DPDPA Rule 8 1-year inactivity rule does not override this legally mandated period.
      const retentionDueAt = new Date();
      retentionDueAt.setFullYear(retentionDueAt.getFullYear() + 5);
      await run(
        `UPDATE Patients SET retention_due_at = ? WHERE id = ? AND tenantId = ?`,
        [retentionDueAt.toISOString().slice(0, 10), patientId, tenant]
      );

      return { message: 'Patient discharged successfully', summaryId, archiveId };
    });
  }
}

module.exports = new PatientRepository();
