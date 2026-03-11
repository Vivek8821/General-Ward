const { db } = require('../db');

class PatientRepository {
    create(patientData) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [patientData.id, patientData.name, patientData.mrn, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity || 1],
                function(err) {
                    if (err) return reject(err);
                    resolve({ ...patientData, status: 'active' });
                }
            );
        });
    }

    findAll() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM Patients WHERE status IN ('active', 'escalated')`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    findArchived() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM Patients WHERE status = 'discharged'`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    findById(id) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM Patients WHERE id = ?`, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    findDischargeSummary(patientId) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM DischargeSummaries WHERE patientId = ? ORDER BY timestamp DESC LIMIT 1`, [patientId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    update(id, patientData) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE Patients SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ? WHERE id = ?`,
                [patientData.name, patientData.bedNumber, patientData.dob, patientData.diagnosis, patientData.allergies, patientData.careIntensity, id],
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

    discharge(patientId, data, dischargedBy) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION;");

                // 1. Mark patient as discharged
                db.run(`UPDATE Patients SET status = 'discharged' WHERE id = ?`, [patientId], function(err) {
                    if (err) {
                        db.run("ROLLBACK;");
                        return reject(err);
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK;");
                        return reject(new Error('Patient not found'));
                    }
                });

                // 2. Insert into DischargeSummaries
                const summaryId = require('crypto').randomUUID();
                const vitals = data.dischargeVitals ? JSON.stringify(data.dischargeVitals) : '{}';
                
                db.run(`
                    INSERT INTO DischargeSummaries (
                        id, patientId, reasonForAdmission, duration, 
                        medicationsDuringAdmission, dischargeVitals, 
                        dischargeRecommendations, dischargedBy
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        summaryId, patientId, data.reasonForAdmission, data.duration,
                        data.medicationsDuringAdmission, vitals,
                        data.dischargeRecommendations, dischargedBy
                    ],
                    function(err) {
                        if (err) {
                            db.run("ROLLBACK;");
                            return reject(err);
                        }
                    }
                );

                db.run("COMMIT;", (err) => {
                    if (err) return reject(err);
                    resolve({ message: 'Patient discharged successfully', summaryId });
                });
            });
        });
    }
}

module.exports = new PatientRepository();
