const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ward.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (!err) {
        db.run('PRAGMA foreign_keys = ON;'); // Crucial for cascading deletes in SQLite
        // Better concurrency characteristics under load.
        // WAL lets readers proceed while a writer is active.
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA synchronous = NORMAL;');
        // Avoid immediate failures while the DB is locked by another writer.
        db.run('PRAGMA busy_timeout = 5000;');
    }
});

const DEFAULT_TENANT_ID = 'tenant-default';

// SQLite is single-writer and the `sqlite3` Database instance is shared across requests.
// Manual `BEGIN TRANSACTION` blocks can overlap under concurrent load, causing
// "cannot start a transaction within a transaction". This queue ensures only one
// explicit transaction runs at a time.
let transactionChain = Promise.resolve();

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

function withTransaction(work) {
  // Ensure a previous failure doesn't poison the global transaction queue.
  transactionChain = transactionChain.catch(() => {}).then(async () => {
    await runAsync('BEGIN IMMEDIATE;');
    try {
      const result = await work({ runAsync, getAsync, allAsync });
      await runAsync('COMMIT;');
      return result;
    } catch (err) {
      try {
        await runAsync('ROLLBACK;');
      } catch (_) {
        // ignore rollback errors
      }
      throw err;
    }
  });

  return transactionChain;
}

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        const runIgnoreDuplicateColumn = (sql) => {
          db.run(sql, (err) => {
            if (!err) return;
            if (/duplicate column name/i.test(String(err.message || ''))) return;
            console.error('[db] migration failed:', err.message);
          });
        };

        // Users Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
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
            type TEXT CHECK(type IN ('vital', 'symptom', 'diet', 'sleep', 'history')) NOT NULL,
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
        runIgnoreDuplicateColumn(`ALTER TABLE Medications ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`);
        runIgnoreDuplicateColumn(`ALTER TABLE Medications ADD COLUMN status TEXT DEFAULT 'active'`);

        // Medication administration extensions (reason + dose capture).
        runIgnoreDuplicateColumn(`ALTER TABLE MedicationAdministrations ADD COLUMN doseActuallyGiven TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE MedicationAdministrations ADD COLUMN reasonCode TEXT`);

        // Tenant-aware schema: add tenantId columns idempotently for legacy databases.
        runIgnoreDuplicateColumn(`ALTER TABLE Users ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE DailyStats ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Medications ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE MedicationAdministrations ADD COLUMN tenantId TEXT`);

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

        // Immutable full-record snapshot at discharge (hospital archive).
        db.run(`
          CREATE TABLE IF NOT EXISTS HospitalArchives (
            id TEXT PRIMARY KEY,
            tenantId TEXT,
            patientId TEXT NOT NULL,
            dischargeSummaryId TEXT NOT NULL,
            archivedAt TEXT NOT NULL,
            dischargedBy TEXT NOT NULL,
            patientName TEXT NOT NULL,
            mrn TEXT NOT NULL,
            bedNumber TEXT NOT NULL,
            snapshotJson TEXT NOT NULL,
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

        // Domain-level change log (entity updates beyond HTTP access audit).
        db.run(`
          CREATE TABLE IF NOT EXISTS ClinicalChangeLog (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            userId TEXT NOT NULL,
            userRole TEXT NOT NULL,
            entityType TEXT NOT NULL,
            entityId TEXT NOT NULL,
            action TEXT NOT NULL,
            summary TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Idempotency keys for write endpoints (e.g., observations ingest).
        // This prevents duplicate rows when clients retry safely.
        db.run(`
          CREATE TABLE IF NOT EXISTS IdempotencyKeys (
            idempotencyKey TEXT NOT NULL,
            tenantId TEXT NOT NULL,
            userId TEXT NOT NULL,
            patientId TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('processing', 'completed')) DEFAULT 'processing',
            responseStatus INTEGER,
            responseJson TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (idempotencyKey, tenantId, userId, patientId, endpoint)
          )
        `);

        // Auth lockout state for enterprise hardening.
        // Tracks consecutive failed login attempts for a (username, ipAddress) pair.
        db.run(`
          CREATE TABLE IF NOT EXISTS AuthLoginAttempts (
            username TEXT NOT NULL,
            ipAddress TEXT NOT NULL,
            attemptCount INTEGER NOT NULL,
            firstAttemptAt DATETIME NOT NULL,
            lockedUntil DATETIME,
            PRIMARY KEY (username, ipAddress)
          )
        `);

        // Additional tenant column backfills for legacy DBs.
        runIgnoreDuplicateColumn(`ALTER TABLE Escalations ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE DischargeSummaries ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Tasks ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE HandoverNotes ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN tenantId TEXT`);

        // Backfill any existing rows that predate tenant support.
        db.run(`UPDATE Users SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Patients SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE DailyStats SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Medications SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE MedicationAdministrations SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Escalations SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE DischargeSummaries SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE HospitalArchives SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE Tasks SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE HandoverNotes SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE AuditLogs SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID]);
        db.run(`UPDATE ClinicalChangeLog SET tenantId = ? WHERE tenantId IS NULL`, [DEFAULT_TENANT_ID], () => {});

        // Enforce a safe default tenant for any legacy/explicit inserts that omit tenantId.
        // This prevents tenant-scoped reads from "losing" rows seeded by tests or older code.
        const tenantDefault = DEFAULT_TENANT_ID;
        const createDefaultTenantTrigger = (table) => {
          const triggerName = `trg_${table}_tenant_default`;
          // SQLite does not support CREATE TRIGGER IF NOT EXISTS; ignore duplicate-trigger errors.
          // Use AFTER INSERT + UPDATE because SQLite doesn't allow direct NEW.column assignment in triggers.
          db.run(`
            CREATE TRIGGER ${triggerName}
            AFTER INSERT ON ${table}
            FOR EACH ROW
            WHEN NEW.tenantId IS NULL
            BEGIN
              UPDATE ${table} SET tenantId = '${tenantDefault}' WHERE id = NEW.id;
            END
          `, () => { /* ignore errors (e.g. trigger exists) */ });
        };
        [
          'Users',
          'Patients',
          'DailyStats',
          'Medications',
          'MedicationAdministrations',
          'Escalations',
          'DischargeSummaries',
          'HospitalArchives',
          'Tasks',
          'HandoverNotes',
          'AuditLogs',
          'ClinicalChangeLog'
        ].forEach(createDefaultTenantTrigger);

        // Extend AuditLogs with additional attributes for stronger traceability.
        // Safe to run multiple times (errors ignored if columns already exist).
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN statusCode INTEGER`);
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN success INTEGER`);

        // Waste Records (Clinical Waste & Spillage Management — Phase 9)
        db.run(`
          CREATE TABLE IF NOT EXISTS WasteRecords (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            stockId TEXT NOT NULL,
            batchId TEXT,
            quantityWasted INTEGER NOT NULL CHECK(quantityWasted > 0),
            unit TEXT NOT NULL,
            reasonCode TEXT NOT NULL CHECK(reasonCode IN ('EXPIRED','DAMAGED','CONTAMINATED','SPILL','OTHER')),
            reasonNotes TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','CANCELLED')),
            initiatedByUserId TEXT NOT NULL,
            initiatedByUserName TEXT NOT NULL,
            initiatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            witnessUserId TEXT,
            witnessUserName TEXT,
            witnessedAt DATETIME,
            pharmacyTransactionId TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stockId) REFERENCES PharmacyStock(id),
            FOREIGN KEY (batchId) REFERENCES PharmacyBatches(id),
            FOREIGN KEY (pharmacyTransactionId) REFERENCES PharmacyTransactions(id)
          )
        `);
        
        // Barcode Extensions (Phase 10)
        runIgnoreDuplicateColumn(`ALTER TABLE PharmacyStock ADD COLUMN barcode TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE PharmacyBatches ADD COLUMN barcode TEXT`);

        db.run(`
          CREATE TABLE IF NOT EXISTS BarcodeRegistrations (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            tenantId      TEXT    NOT NULL,
            targetType    TEXT    NOT NULL CHECK(targetType IN ('STOCK','BATCH')),
            targetId      TEXT    NOT NULL,
            barcode       TEXT    NOT NULL,
            registeredBy  TEXT    NOT NULL,
            registeredAt  TEXT    NOT NULL DEFAULT (datetime('now')),
            notes         TEXT
          )
        `);

        // Production Indexes for query performance and cascading speed
        db.run(`CREATE INDEX IF NOT EXISTS idx_dailystats_patient ON DailyStats(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_medications_patient ON Medications(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_escalations_patient ON Escalations(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_discharges_patient ON DischargeSummaries(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_hospital_archives_tenant_time ON HospitalArchives(tenantId, archivedAt DESC);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(timestamp);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_auditlogs_tenant_timestamp ON AuditLogs(tenantId, timestamp DESC);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_tenant_time ON ClinicalChangeLog(tenantId, timestamp DESC);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_entity ON ClinicalChangeLog(entityType, entityId);`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_patient ON Tasks(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON Tasks(assignee);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON Tasks(status);`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_handovernots_patient ON HandoverNotes(patientId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_handovernots_timestamp ON HandoverNotes(timestamp);`);

        // WasteRecords indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_tenant ON WasteRecords(tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_status ON WasteRecords(status, tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_stock ON WasteRecords(stockId, tenantId);`);
        
        // Barcode Indexes (Phase 10)
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacystock_barcode ON PharmacyStock(barcode) WHERE barcode IS NOT NULL;`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacybatches_barcode ON PharmacyBatches(barcode) WHERE barcode IS NOT NULL;`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_barcoderegistrations_tenant ON BarcodeRegistrations(tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_barcoderegistrations_barcode ON BarcodeRegistrations(barcode);`);
        
        // 7. PatientReports Table (Phase 11)
        db.run(`
          CREATE TABLE IF NOT EXISTS PatientReports (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            tenantId        TEXT    NOT NULL,
            patientId       TEXT    NOT NULL,
            reportType      TEXT    NOT NULL DEFAULT 'FULL_TREATMENT',
            reportHash      TEXT    NOT NULL,
            generatedByUserId TEXT  NOT NULL,
            generatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
            periodFrom      TEXT    NOT NULL,
            periodTo        TEXT    NOT NULL,
            pdfStoredAt     TEXT,
            metadata        TEXT
          )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_patientreports_patient ON PatientReports(patientId, tenantId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_patientreports_hash ON PatientReports(reportHash)`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

// Export for explicit initialization in server.js or setup scripts
module.exports = { db, initDb, withTransaction, runAsync, getAsync, allAsync };
