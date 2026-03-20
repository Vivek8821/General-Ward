const { db, initDb } = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seed() {
    console.log('Seeding database...');
    
    // Hash passwords (dev/demo only)
    const drHash = await bcrypt.hash('1234', 10);
    const nurseHash = await bcrypt.hash('5678', 10);
    const adminHash = await bcrypt.hash('9999', 10);

    // Disable FKs temporarily during seed to be 100% safe
    db.run('PRAGMA foreign_keys = OFF;', async () => {
        db.serialize(async () => {
            // Clear existing data
            db.run('DELETE FROM Escalations');
            db.run('DELETE FROM DailyStats');
            db.run('DELETE FROM Medications');
            db.run('DELETE FROM HandoverNotes');
            db.run('DELETE FROM Patients');
            db.run('DELETE FROM Users');
            
            // Re-init tables (ensures schema is up to date)
            await initDb();
            
            // Users (tenant-default matches JWT / tenant middleware defaults)
            const tid = 'tenant-default';
            db.run(`INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`, ['u1', 'Dr. Smith', 'doctor', tid, drHash]);
            db.run(`INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`, ['u2', 'Nurse Johnson', 'nurse', tid, nurseHash]);
            db.run(`INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`, ['admin-1', 'Ward Admin', 'admin', tid, adminHash]);

            // Patients
            const mockPatients = [
                { id: 'u1', name: 'John Doe', dob: '1978-06-15', mrn: 'MRN-1001', bedNumber: '1', diagnosis: 'Pneumonia', status: 'active', careIntensity: 2, allergies: 'Penicillin' },
                { id: 'u2', name: 'Jane Smith', dob: '1991-03-22', mrn: 'MRN-1002', bedNumber: '2', diagnosis: 'Post-op Appendectomy', status: 'active', careIntensity: 1, allergies: 'None' },
                { id: 'u3', name: 'Robert Johnson', dob: '1955-11-04', mrn: 'MRN-1003', bedNumber: '3', diagnosis: 'Congestive Heart Failure', status: 'escalated', careIntensity: 4, allergies: 'Sulfa Drugs' },
                { id: 'u4', name: 'Emily Davis', dob: '1972-09-18', mrn: 'MRN-1004', bedNumber: '4', diagnosis: 'Severe Sepsis', status: 'active', careIntensity: 4, allergies: 'Latex' },
                { id: 'u5', name: 'Michael Brown', dob: '1994-01-30', mrn: 'MRN-1005', bedNumber: '5', diagnosis: 'Asthma Exacerbation', status: 'active', careIntensity: 3, allergies: 'None' },
                { id: 'u6', name: 'Sarah Wilson', dob: '1949-07-12', mrn: 'MRN-1006', bedNumber: '6', diagnosis: 'Hip Fracture (Pre-op)', status: 'active', careIntensity: 2, allergies: 'Codeine' },
                { id: 'u7', name: 'David Lee', dob: '1982-12-05', mrn: 'MRN-1007', bedNumber: '7', diagnosis: 'Acute Pancreatitis', status: 'active', careIntensity: 3, allergies: 'None' },
                { id: 'u8', name: 'Linda Taylor', dob: '1961-04-20', mrn: 'MRN-1008', bedNumber: '8', diagnosis: 'Diabetic Ketoacidosis (DKA)', status: 'active', careIntensity: 4, allergies: 'Lantus' },
                { id: 'u9', name: 'James Anderson', dob: '1968-08-08', mrn: 'MRN-1009', bedNumber: '9', diagnosis: 'Cellulitis - Left Leg', status: 'active', careIntensity: 1, allergies: 'None' },
                { id: 'u10', name: 'Patricia Thomas', dob: '1943-02-14', mrn: 'MRN-1010', bedNumber: '10', diagnosis: 'Altered Mental Status (UTI)', status: 'active', careIntensity: 3, allergies: 'Ciprofloxacin' },
                { id: 'u11', name: 'William Jackson', dob: '1985-10-29', mrn: 'MRN-1011', bedNumber: '11', diagnosis: 'Gastroenteritis', status: 'active', careIntensity: 2, allergies: 'None' },
                { id: 'u12', name: 'Barbara White', dob: '1976-05-03', mrn: 'MRN-1012', bedNumber: '12', diagnosis: 'Cholecystitis', status: 'active', careIntensity: 2, allergies: 'Morphine' }
            ];

            mockPatients.forEach(p => {
                db.run(`INSERT INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.mrn, p.bedNumber, p.dob, p.diagnosis, p.allergies, p.careIntensity, p.status]);
            });

            // Stats
            db.run(`INSERT INTO DailyStats (id, patientId, type, data, recordedBy) VALUES (?, ?, 'vital', ?, ?)`,
                [crypto.randomUUID(), 'u3', JSON.stringify({ bpSystolic: 150, bpDiastolic: 95, temp: 99.1, pulse: 110, spo2: 94, pain: 6 }), 'Nurse Johnson']);

            // Escalations
            db.run(`INSERT INTO Escalations (id, patientId, reason, escalatedBy, status) VALUES (?, ?, ?, ?, 'pending')`,
                [crypto.randomUUID(), 'u3', 'Patient reporting continuous chest pain despite nitro.', 'Nurse Johnson']);

            // Handover Notes (shift-based)
            db.run(
                `INSERT INTO HandoverNotes (id, patientId, shift, note, tags, createdBy) VALUES (?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), 'u3', 'morning', 'Overnight: monitor chest pain frequency. Review response to nitro and vitals trend.', 'sepsis,cardiac', 'Nurse Johnson']
            );
            db.run(
                `INSERT INTO HandoverNotes (id, patientId, shift, note, tags, createdBy) VALUES (?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), 'u4', 'night', 'Sepsis watch: ensure fluid balance and recheck temperature; follow up labs in the morning.', 'infection', 'Dr. Smith']
            );
            
            db.run('PRAGMA foreign_keys = ON;', () => {
                console.log('Database seeded successfully.');
            });
        });
    });
}

seed();
