const { db, initDb } = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seed() {
    console.log('Seeding database...');
    
    // Hash passwords
    const drHash = await bcrypt.hash('1234', 10);
    const nurseHash = await bcrypt.hash('5678', 10);

    db.serialize(async () => {
        // Clear existing data for a clean slate
        db.run('DROP TABLE IF EXISTS Escalations');
        db.run('DROP TABLE IF EXISTS DailyStats');
        db.run('DROP TABLE IF EXISTS Medications');
        db.run('DROP TABLE IF EXISTS Patients');
        db.run('DROP TABLE IF EXISTS AuditLogs');
        db.run('DROP TABLE IF EXISTS Users', async () => {
              
            // Re-initialize the tables
            await initDb();
            
            // Users
            db.run(`INSERT OR IGNORE INTO Users (id, name, role, passwordHash) VALUES (?, ?, ?, ?)`, ['u1', 'Dr. Smith', 'doctor', drHash]);
            db.run(`INSERT OR IGNORE INTO Users (id, name, role, passwordHash) VALUES (?, ?, ?, ?)`, ['u2', 'Nurse Johnson', 'nurse', nurseHash]);

        // Patients
  // Seed Mock Patients Data
  const mockPatients = [
      { id: 'u1', name: 'John Doe', dob: '1978-06-15', mrn: 'MRN-1001', bedNumber: '101A', diagnosis: 'Pneumonia', status: 'active', careIntensity: 2, allergies: 'Penicillin' },
      { id: 'u2', name: 'Jane Smith', dob: '1991-03-22', mrn: 'MRN-1002', bedNumber: '102B', diagnosis: 'Post-op Appendectomy', status: 'active', careIntensity: 1, allergies: 'None' },
      { id: 'u3', name: 'Robert Johnson', dob: '1955-11-04', mrn: 'MRN-1003', bedNumber: '103A', diagnosis: 'Congestive Heart Failure', status: 'active', careIntensity: 4, allergies: 'Sulfa Drugs' },
      { id: 'u4', name: 'Emily Davis', dob: '1972-09-18', mrn: 'MRN-1004', bedNumber: '104B', diagnosis: 'Severe Sepsis', status: 'active', careIntensity: 4, allergies: 'Latex' },
      { id: 'u5', name: 'Michael Brown', dob: '1994-01-30', mrn: 'MRN-1005', bedNumber: '105A', diagnosis: 'Asthma Exacerbation', status: 'active', careIntensity: 3, allergies: 'None' },
      { id: 'u6', name: 'Sarah Wilson', dob: '1949-07-12', mrn: 'MRN-1006', bedNumber: '106B', diagnosis: 'Hip Fracture (Pre-op)', status: 'active', careIntensity: 2, allergies: 'Codeine' },
      { id: 'u7', name: 'David Lee', dob: '1982-12-05', mrn: 'MRN-1007', bedNumber: '107A', diagnosis: 'Acute Pancreatitis', status: 'active', careIntensity: 3, allergies: 'None' },
      { id: 'u8', name: 'Linda Taylor', dob: '1961-04-20', mrn: 'MRN-1008', bedNumber: '108B', diagnosis: 'Diabetic Ketoacidosis (DKA)', status: 'active', careIntensity: 4, allergies: 'Lantus' },
      { id: 'u9', name: 'James Anderson', dob: '1968-08-08', mrn: 'MRN-1009', bedNumber: '109A', diagnosis: 'Cellulitis - Left Leg', status: 'active', careIntensity: 1, allergies: 'None' },
      { id: 'u10', name: 'Patricia Thomas', dob: '1943-02-14', mrn: 'MRN-1010', bedNumber: '110B', diagnosis: 'Altered Mental Status (UTI)', status: 'active', careIntensity: 3, allergies: 'Ciprofloxacin' },
      { id: 'u11', name: 'William Jackson', dob: '1985-10-29', mrn: 'MRN-1011', bedNumber: '111A', diagnosis: 'Gastroenteritis', status: 'active', careIntensity: 2, allergies: 'None' },
      { id: 'u12', name: 'Barbara White', dob: '1976-05-03', mrn: 'MRN-1012', bedNumber: '112B', diagnosis: 'Cholecystitis', status: 'active', careIntensity: 2, allergies: 'Morphine' }
  ];

  const stmt = db.prepare(`INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  mockPatients.forEach(p => {
      stmt.run([p.id, p.name, p.mrn, p.bedNumber, p.dob, p.diagnosis, p.allergies, p.careIntensity, p.status]);
  });
  
  stmt.finalize();

        // Stats
        db.run(`INSERT INTO DailyStats (id, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), 'u3', 'vital', JSON.stringify({ bpSystolic: 150, bpDiastolic: 95, temp: 99.1, pulse: 110, spo2: 94, pain: 6 }), 'Nurse Johnson']);

        // Escalations
        db.run(`INSERT INTO Escalations (id, patientId, reason, escalatedBy, status) VALUES (?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), 'u3', 'Patient reporting continuous chest pain despite nitro.', 'Nurse Johnson', 'pending']);
            
        console.log('Database seeded successfully.');
        });
    });
}

seed();
