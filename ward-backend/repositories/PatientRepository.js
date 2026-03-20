const crypto = require('crypto');
const dbAdapter = require('../dbAdapter');

class PatientRepository {
    async create(patientData) {
        const tenantId = patientData.tenantId || 'tenant-default';
        await dbAdapter.run(
            `INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [patientData.id, tenantId, patientData.name, patientData.mrn, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity || 1]
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
        return dbAdapter.all(
          `SELECT * FROM Patients WHERE tenantId = ? AND status = 'discharged'`,
          [tenant]
        );
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
           SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ?
           WHERE id = ? AND tenantId = ?`,
          [patientData.name, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity, id, tenant]
        );
        return result.changes;
    }

    async updateStatus(id, newStatus, tenantId) {
        // tenantId optional because existing code didn't provide it; keep backward compatible signature.
        // If tenantId is provided later, we can tighten the WHERE clause.
        const query = tenantId
          ? `UPDATE Patients SET status = ? WHERE id = ? AND tenantId = ?`
          : `UPDATE Patients SET status = ? WHERE id = ?`;
        const params = tenantId ? [newStatus, id, tenantId] : [newStatus, id];
        const result = await dbAdapter.run(query, params);
        return result.changes;
    }

    async discharge(patientId, data, dischargedBy, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return dbAdapter.withTransaction(async ({ run }) => {
          const upd = await run(
            `UPDATE Patients SET status = 'discharged' WHERE id = ? AND tenantId = ?`,
            [patientId, tenant]
          );

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
              dischargedBy
            ]
          );

          return { message: 'Patient discharged successfully', summaryId };
        });
    }
}

module.exports = new PatientRepository();
