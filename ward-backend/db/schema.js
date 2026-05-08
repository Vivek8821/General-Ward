const DEFAULT_TENANT_ID = 'tenant-default';

const initDb = (db) => {
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
            role TEXT CHECK(role IN ('doctor', 'nurse', 'pharmacist', 'admin')) NOT NULL,
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

        runIgnoreDuplicateColumn(`ALTER TABLE Medications ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`);
        runIgnoreDuplicateColumn(`ALTER TABLE Medications ADD COLUMN status TEXT DEFAULT 'active'`);
        runIgnoreDuplicateColumn(`ALTER TABLE MedicationAdministrations ADD COLUMN doseActuallyGiven TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE MedicationAdministrations ADD COLUMN reasonCode TEXT`);

        runIgnoreDuplicateColumn(`ALTER TABLE Users ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Users ADD COLUMN email TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Users ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 0`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN admittedAt DATETIME`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN gender TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN bloodGroup TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN contactNumber TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN emergencyContact TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN notice_given_at TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN notice_given_by TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN is_minor INTEGER DEFAULT 0`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN guardian_name TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN guardian_contact TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN guardian_notice_at TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN data_nominee TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN data_nominee_relationship TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Patients ADD COLUMN retention_due_at TEXT`);
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

        // HospitalArchives Table
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

        // Tasks Table
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

        // Handover Notes Table
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

        // ClinicalChangeLog Table
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

        // DPDPA 2023 Compliance Tables
        db.run(`
          CREATE TABLE IF NOT EXISTS DpdpaCorrectionRequests (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            patientId TEXT NOT NULL,
            requestedBy TEXT NOT NULL,
            requestedAt TEXT NOT NULL,
            requestType TEXT NOT NULL CHECK(requestType IN ('correction', 'erasure')),
            fieldsAffected TEXT,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'resolved', 'rejected')),
            reviewedBy TEXT,
            resolvedAt TEXT,
            resolutionNotes TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS DpdpaGrievances (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            patientId TEXT,
            complainantName TEXT NOT NULL,
            complainantContact TEXT,
            description TEXT NOT NULL,
            category TEXT CHECK(category IN ('data_access', 'correction_delay', 'breach', 'other')),
            filedAt TEXT NOT NULL,
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'escalated')),
            assignedTo TEXT,
            resolvedAt TEXT,
            resolutionNotes TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS DpdpaDataSharingLog (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            patientId TEXT NOT NULL,
            sharedWith TEXT NOT NULL,
            purposeOfSharing TEXT NOT NULL,
            dataCategories TEXT NOT NULL,
            sharedAt TEXT NOT NULL,
            sharedBy TEXT NOT NULL,
            legalBasis TEXT CHECK(legalBasis IN ('care_referral', 'legal_obligation', 'consent', 'other')),
            consentReference TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // IdempotencyKeys Table
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

        // AuthLoginAttempts Table
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

        runIgnoreDuplicateColumn(`ALTER TABLE Escalations ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE DischargeSummaries ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE Tasks ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE HandoverNotes ADD COLUMN tenantId TEXT`);
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN tenantId TEXT`);

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

        const tenantDefault = DEFAULT_TENANT_ID;
        const createDefaultTenantTrigger = (table) => {
          const triggerName = `trg_${table}_tenant_default`;
          db.run(`
            CREATE TRIGGER ${triggerName}
            AFTER INSERT ON ${table}
            FOR EACH ROW
            WHEN NEW.tenantId IS NULL
            BEGIN
              UPDATE ${table} SET tenantId = '${tenantDefault}' WHERE id = NEW.id;
            END
          `, () => { /* ignore errors */ });
        };
        [
          'Users', 'Patients', 'DailyStats', 'Medications', 'MedicationAdministrations',
          'Escalations', 'DischargeSummaries', 'HospitalArchives', 'Tasks',
          'HandoverNotes', 'AuditLogs', 'ClinicalChangeLog'
        ].forEach(createDefaultTenantTrigger);

        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN statusCode INTEGER`);
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN success INTEGER`);
        runIgnoreDuplicateColumn(`ALTER TABLE AuditLogs ADD COLUMN patientId TEXT`);

        // Pharmacy Tables
        db.run(`
          CREATE TABLE IF NOT EXISTS PharmacyStock (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            name TEXT NOT NULL,
            composition TEXT,
            type TEXT,
            category TEXT,
            quantityPerUnit INTEGER DEFAULT 1,
            totalUnits INTEGER DEFAULT 0,
            totalQuantity INTEGER DEFAULT 0,
            unit TEXT,
            itemUnit TEXT,
            costPerUnit REAL DEFAULT 0,
            expiryDate DATE,
            manufacturer TEXT,
            minThreshold INTEGER DEFAULT 10,
            barcode TEXT,
            lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenantId, name, composition)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS PharmacyTransactions (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            medicationId TEXT NOT NULL,
            type TEXT CHECK(type IN ('restock', 'dispense', 'adjustment', 'waste')) NOT NULL,
            quantity INTEGER NOT NULL,
            userId TEXT NOT NULL,
            userName TEXT NOT NULL,
            patientId TEXT,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medicationId) REFERENCES PharmacyStock(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS PharmacyBatches (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            stockId TEXT NOT NULL,
            batchNumber TEXT NOT NULL,
            expiryDate DATE NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            costPerUnit REAL DEFAULT 0,
            manufacturer TEXT,
            receivedDate DATE,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'recalled', 'depleted')),
            barcode TEXT,
            notes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stockId) REFERENCES PharmacyStock(id),
            UNIQUE(tenantId, stockId, batchNumber)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS PurchaseOrders (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            stockId TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT CHECK(status IN ('pending', 'ordered', 'received', 'cancelled')) DEFAULT 'pending',
            generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            orderedAt DATETIME,
            receivedAt DATETIME,
            createdBy TEXT,
            notes TEXT,
            FOREIGN KEY (stockId) REFERENCES PharmacyStock(id)
          )
        `);

        // WasteRecords
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

        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_tenant ON WasteRecords(tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_status ON WasteRecords(status, tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wasterecords_stock ON WasteRecords(stockId, tenantId);`);
        
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacystock_barcode ON PharmacyStock(barcode) WHERE barcode IS NOT NULL;`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacybatches_barcode ON PharmacyBatches(barcode) WHERE barcode IS NOT NULL;`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_barcoderegistrations_tenant ON BarcodeRegistrations(tenantId);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_barcoderegistrations_barcode ON BarcodeRegistrations(barcode);`);
        
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

        db.run(`CREATE INDEX IF NOT EXISTS idx_auditlogs_patientid ON AuditLogs(patientId) WHERE patientId IS NOT NULL`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_correction_req_tenant ON DpdpaCorrectionRequests(tenantId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_correction_req_patient ON DpdpaCorrectionRequests(patientId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_grievances_tenant ON DpdpaGrievances(tenantId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_sharing_log_tenant ON DpdpaDataSharingLog(tenantId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_sharing_log_patient ON DpdpaDataSharingLog(patientId)`);
        
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

module.exports = { initDb, DEFAULT_TENANT_ID };
