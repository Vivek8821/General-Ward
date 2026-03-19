const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ward.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (!err) {
        db.run('PRAGMA foreign_keys = ON;'); // Crucial for cascading deletes in SQLite
    }
});

const DEFAULT_TENANT_ID = 'tenant-default';

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Users Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
            tenantId TEXT,
            passwordHash TEXT NOT NULL
          )
        `);

        // Tenants Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
          )
        `);

        // Ensure there's always a default tenant for legacy/backfill rows.
        db.run(`INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)`, [DEFAULT_TENANT_ID, 'Default Tenant']);

        // Patients Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Patients (
            id TEXT PRIMARY KEY,
            tenantId TEXT,
            name TEXT NOT NULL,
            mrn TEXT UNIQUE NOT NULL,
            bedNumber TEXT NOT NULL,
            dob TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            allergies TEXT,
            careIntensity INTEGER CHECK(careIntensity IN (1, 2, 3, 4)) DEFAULT 1,
            status TEXT DEFAULT 'active'
          )
        `);

        // Daily Stats Table
        // Using JSON/Text for 'data' flexiblity across different stat types
        db.run(`
          CREATE TABLE IF NOT EXISTS DailyStats (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            type TEXT CHECK(type IN ('vital', 'symptom', 'diet', 'sleep')) NOT NULL,
            data TEXT NOT NULL,
            recordedBy TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Medications Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Medications (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            route TEXT NOT NULL,
            frequency TEXT NOT NULL,
            scheduledTimes TEXT,
            prn BOOLEAN DEFAULT 0,
            startDate DATE NOT NULL,
            prescribedBy TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Medication Administrations Table
        db.run(`
          CREATE TABLE IF NOT EXISTS MedicationAdministrations (
            id TEXT PRIMARY KEY,
            medicationId TEXT NOT NULL,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            status TEXT CHECK(status IN ('given', 'refused', 'missed')) NOT NULL,
            notes TEXT,
            administeredBy TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medicationId) REFERENCES Medications(id),
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Dynamically patch existing DB for MAR and timestamp
        db.run(`ALTER TABLE Medications ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {});
        db.run(`ALTER TABLE Medications ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {});

        // Medication administration extensions (reason + dose capture).
        db.run(`ALTER TABLE MedicationAdministrations ADD COLUMN doseActuallyGiven TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE MedicationAdministrations ADD COLUMN reasonCode TEXT`, (err) => { /* Ignore duplicate column error */ });

        // Dynamically patch existing DB for MedsTab fix
        db.run(`ALTER TABLE Medications ADD COLUMN status TEXT DEFAULT 'active'`, (err) => { /* Ignore duplicate column error */ });

        // Tenant-aware schema: add tenantId columns idempotently for legacy databases.
        db.run(`ALTER TABLE Users ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE Patients ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE DailyStats ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE Medications ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE MedicationAdministrations ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });

        // Escalations Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Escalations (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            reason TEXT NOT NULL,
            escalatedBy TEXT NOT NULL,
            status TEXT CHECK(status IN ('pending', 'reviewed')) DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Discharge Summaries Table
        db.run(`
          CREATE TABLE IF NOT EXISTS DischargeSummaries (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            reasonForAdmission TEXT NOT NULL,
            duration TEXT NOT NULL,
            medicationsDuringAdmission TEXT,
            dischargeVitals TEXT NOT NULL,
            dischargeRecommendations TEXT,
            dischargedBy TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Tasks Table (shift/workflow tasks for clinicians)
        db.run(`
          CREATE TABLE IF NOT EXISTS Tasks (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            type TEXT NOT NULL CHECK(type IN ('vital', 'assessment', 'followup')),
            dueAt DATETIME NOT NULL,
            status TEXT CHECK(status IN ('open', 'completed', 'cancelled')) DEFAULT 'open',
            assignee TEXT,
            notes TEXT,
            createdBy TEXT,
            completedBy TEXT,
            completedAt DATETIME,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Handover Notes Table (shift-based clinical notes)
        db.run(`
          CREATE TABLE IF NOT EXISTS HandoverNotes (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            tenantId TEXT,
            shift TEXT NOT NULL,
            note TEXT NOT NULL,
            tags TEXT,
            createdBy TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id)
          )
        `);

        // Audit Logs Table
        db.run(`
          CREATE TABLE IF NOT EXISTS AuditLogs (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            userRole TEXT NOT NULL,
            tenantId TEXT,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            ipAddress TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Additional tenant column backfills for legacy DBs.
        db.run(`ALTER TABLE Escalations ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE DischargeSummaries ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE Tasks ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE HandoverNotes ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE AuditLogs ADD COLUMN tenantId TEXT`, (err) => { /* Ignore duplicate column error */ });

        // Backfill any existing rows that predate tenant support.
        db.run(`UPDATE Users SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Patients SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE DailyStats SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Medications SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE MedicationAdministrations SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Escalations SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE DischargeSummaries SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Tasks SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE HandoverNotes SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE AuditLogs SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);

        // Extend AuditLogs with additional attributes for stronger traceability.
        // Safe to run multiple times (errors ignored if columns already exist).
        db.run(`ALTER TABLE AuditLogs ADD COLUMN statusCode INTEGER`, (err) => { /* Ignore duplicate column error */ });
        db.run(`ALTER TABLE AuditLogs ADD COLUMN success INTEGER`, (err) => { /* Ignore duplicate column error */ });

        // Production Indexes for query performance and cascading speed
        db.run(`CREATE INDEX IF NOT EXISTS idx_dailystats_patient ON DailyStats(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_medications_patient ON Medications(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_escalations_patient ON Escalations(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_discharges_patient ON DischargeSummaries(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(timestamp);`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_patient ON Tasks(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON Tasks(assignee);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON Tasks(status);`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_handovernots_patient ON HandoverNotes(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_handovernots_timestamp ON HandoverNotes(timestamp);`);
        
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

// Auto-init on load for normal server runs
initDb();

module.exports = { db, initDb };
