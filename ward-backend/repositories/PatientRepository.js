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
            db.all(`SELECT * FROM Patients`, [], (err, rows) => {
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
}

module.exports = new PatientRepository();
