const { db, withTransaction } = require('../db');

class PatientRepository {
    create(patientData) {
        return new Promise((resolve, reject) => {
            const tenantId = patientData.tenantId || 'tenant-default';
            db.run(
                `INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [patientData.id, tenantId, patientData.name, patientData.mrn, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity || 1],
                function(err) {
                    if (err) return reject(err);
                    resolve({ ...patientData, status: 'active' });
                }
            );
        });
    }

    findAll(tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.all(
              `SELECT * FROM Patients WHERE tenantId = ? AND status IN ('active', 'escalated')`,
              [tenant],
              (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
              }
            );
        });
    }

    findArchived(tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.all(
              `SELECT * FROM Patients WHERE tenantId = ? AND status = 'discharged'`,
              [tenant],
              (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
              }
            );
        });
    }

    findById(id, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM Patients WHERE id = ? AND tenantId = ?`, [id, tenant], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    findDischargeSummary(patientId, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.get(
              `SELECT * FROM DischargeSummaries WHERE patientId = ? AND tenantId = ? ORDER BY timestamp DESC LIMIT 1`,
              [patientId, tenant],
              (err, row) => {
                if (err) return reject(err);
                resolve(row);
              }
            );
        });
    }

    update(id, patientData, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE Patients
                 SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ?
                 WHERE id = ? AND tenantId = ?`,
                [patientData.name, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity, id, tenant],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    updateStatus(id, newStatus) {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE Patients SET status = ? WHERE id = ?`, [newStatus, id], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }

    discharge(patientId, data, dischargedBy, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return withTransaction(async ({ runAsync }) => {
            const upd = await runAsync(
                `UPDATE Patients SET status = 'discharged' WHERE id = ? AND tenantId = ?`,
                [patientId, tenant]
            );

            if (!upd || upd.changes === 0) {
                throw new Error('Patient not found');
            }

            const summaryId = require('crypto').randomUUID();
            const vitals = data.dischargeVitals ? JSON.stringify(data.dischargeVitals) : '{}';

            await runAsync(
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
