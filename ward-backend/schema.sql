-- Users Table
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT CHECK(role IN ('doctor', 'nurse', 'pharmacist', 'admin')) NOT NULL,
  tenantId TEXT,
  passwordHash TEXT NOT NULL
);

-- Tenants Table
CREATE TABLE IF NOT EXISTS Tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Patients Table
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
  status TEXT DEFAULT 'active',
  admittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Stats Table
CREATE TABLE IF NOT EXISTS DailyStats (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT,
  type TEXT CHECK(type IN ('vital', 'symptom', 'diet', 'sleep', 'history')) NOT NULL,
  data TEXT NOT NULL,
  recordedBy TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

-- Medications Table
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
);

-- Medication Administrations Table
CREATE TABLE IF NOT EXISTS MedicationAdministrations (
  id TEXT PRIMARY KEY,
  medicationId TEXT NOT NULL,
  patientId TEXT NOT NULL,
  tenantId TEXT,
  status TEXT CHECK(status IN ('given', 'refused', 'missed')) NOT NULL,
  notes TEXT,
  administeredBy TEXT NOT NULL,
  doseActuallyGiven TEXT,
  reasonCode TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (medicationId) REFERENCES Medications(id),
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

-- Escalations Table
CREATE TABLE IF NOT EXISTS Escalations (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT,
  reason TEXT NOT NULL,
  escalatedBy TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'reviewed')) DEFAULT 'pending',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

-- Discharge Summaries Table
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
);

-- Hospital Archives
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
);

-- Tasks Table
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
);

-- Handover Notes
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
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS AuditLogs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  userRole TEXT NOT NULL,
  tenantId TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  ipAddress TEXT NOT NULL,
  statusCode INTEGER,
  success INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clinical Change Log
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
);

-- Idempotency Keys
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
);

-- Pharmacy Stock (Essential Drug List - Enterprise)
CREATE TABLE IF NOT EXISTS PharmacyStock (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  composition TEXT, -- Chemical Composition
  type TEXT, -- e.g. Tablet, Syrup, Injection
  category TEXT,
  quantityPerUnit INTEGER DEFAULT 1, -- e.g. 10 tablets per strip
  totalUnits INTEGER DEFAULT 0, -- e.g. 50 strips
  totalQuantity INTEGER DEFAULT 0, -- Calculated: totalUnits * quantityPerUnit
  unit TEXT, -- e.g. Strips, Bottles, Vials
  itemUnit TEXT, -- e.g. Tablets, ml, mg
  costPerUnit REAL DEFAULT 0,
  expiryDate DATE,
  manufacturer TEXT,
  minThreshold INTEGER DEFAULT 10,
  barcode TEXT,
  lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenantId, name, composition)
);

-- Pharmacy Transactions (Audit Trail)
CREATE TABLE IF NOT EXISTS PharmacyTransactions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  medicationId TEXT NOT NULL,
  type TEXT CHECK(type IN ('restock', 'dispense', 'adjustment', 'waste')) NOT NULL,
  quantity INTEGER NOT NULL, -- positive for restock/adj, negative for dispense/waste
  userId TEXT NOT NULL,
  userName TEXT NOT NULL,
  patientId TEXT, -- only for 'dispense'
  notes TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicationId) REFERENCES PharmacyStock(id)
);

-- Pharmacy Batches (Lot/Batch Tracking)
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
);

-- Auth Lockout State
CREATE TABLE IF NOT EXISTS AuthLoginAttempts (
  username TEXT NOT NULL,
  ipAddress TEXT NOT NULL,
  attemptCount INTEGER NOT NULL,
  firstAttemptAt DATETIME NOT NULL,
  lockedUntil DATETIME,
  PRIMARY KEY (username, ipAddress)
);

CREATE TABLE IF NOT EXISTS RefreshTokens (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  tenantId  TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON RefreshTokens(userId);

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  tenantId  TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  usedAt    TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON PasswordResetTokens(userId);
CREATE INDEX IF NOT EXISTS idx_prt_hash ON PasswordResetTokens(tokenHash);

-- Purchase Orders (Automated Procurement)
CREATE TABLE IF NOT EXISTS PurchaseOrders (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  stockId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'ordered', 'received', 'cancelled')) DEFAULT 'pending',
  generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  orderedAt DATETIME,
  receivedAt DATETIME,
  createdBy TEXT, -- 'system' or userId
  notes TEXT,
  FOREIGN KEY (stockId) REFERENCES PharmacyStock(id)
);

-- Waste Records (Clinical Waste & Spillage Management)
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
);

-- Barcode Registrations (Audit & History — Phase 10)
CREATE TABLE IF NOT EXISTS BarcodeRegistrations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenantId      TEXT    NOT NULL,
  targetType    TEXT    NOT NULL CHECK(targetType IN ('STOCK','BATCH')),
  targetId      TEXT    NOT NULL, -- UUID string
  barcode       TEXT    NOT NULL,
  registeredBy  TEXT    NOT NULL, -- userId
  registeredAt  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes         TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_stock ON PurchaseOrders(tenantId, stockId, status);
CREATE INDEX IF NOT EXISTS idx_wasterecords_tenant ON WasteRecords(tenantId);
CREATE INDEX IF NOT EXISTS idx_wasterecords_status ON WasteRecords(status, tenantId);
CREATE INDEX IF NOT EXISTS idx_wasterecords_stock ON WasteRecords(stockId, tenantId);
CREATE INDEX IF NOT EXISTS idx_dailystats_patient ON DailyStats(patientId);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON Medications(patientId);
CREATE INDEX IF NOT EXISTS idx_escalations_patient ON Escalations(patientId);
CREATE INDEX IF NOT EXISTS idx_discharges_patient ON DischargeSummaries(patientId);
CREATE INDEX IF NOT EXISTS idx_hospital_archives_tenant_time ON HospitalArchives(tenantId, archivedAt DESC);
CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(timestamp);
CREATE INDEX IF NOT EXISTS idx_auditlogs_tenant_timestamp ON AuditLogs(tenantId, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_tenant_time ON ClinicalChangeLog(tenantId, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_entity ON ClinicalChangeLog(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_tasks_patient ON Tasks(patientId);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON Tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON Tasks(status);
CREATE INDEX IF NOT EXISTS idx_handovernots_patient ON HandoverNotes(patientId);
CREATE INDEX IF NOT EXISTS idx_handovernots_timestamp ON HandoverNotes(timestamp);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tenant_name ON PharmacyStock(tenantId, name);
CREATE INDEX IF NOT EXISTS idx_batches_stock ON PharmacyBatches(stockId);
CREATE INDEX IF NOT EXISTS idx_batches_tenant_expiry ON PharmacyBatches(tenantId, expiryDate ASC);
CREATE INDEX IF NOT EXISTS idx_batches_lot ON PharmacyBatches(tenantId, batchNumber);
CREATE INDEX IF NOT EXISTS idx_batches_status ON PharmacyBatches(tenantId, status);

-- Missing high-traffic indexes (added migration 019)
CREATE INDEX IF NOT EXISTS idx_med_admins_patient   ON MedicationAdministrations(patientId, tenantId);
CREATE INDEX IF NOT EXISTS idx_med_admins_med       ON MedicationAdministrations(medicationId);
CREATE INDEX IF NOT EXISTS idx_med_admins_timestamp ON MedicationAdministrations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_med    ON PharmacyTransactions(medicationId);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_tenant ON PharmacyTransactions(tenantId, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waste_batch        ON WasteRecords(batchId);
CREATE INDEX IF NOT EXISTS idx_medications_tenant ON Medications(tenantId, patientId);

-- Barcode Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacystock_barcode
    ON PharmacyStock(barcode) WHERE barcode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacybatches_barcode
    ON PharmacyBatches(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_barcoderegistrations_tenant
    ON BarcodeRegistrations(tenantId);

CREATE INDEX IF NOT EXISTS idx_barcode_registrations_barcode
    ON BarcodeRegistrations(barcode, tenantId);

-- ── Patient Treatment Reports ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS PatientReports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenantId        TEXT    NOT NULL,
  patientId       TEXT    NOT NULL REFERENCES Patients(id),
  reportType      TEXT    NOT NULL DEFAULT 'FULL_TREATMENT'
                      CHECK(reportType IN ('FULL_TREATMENT','DISCHARGE_SUMMARY')),
  reportHash      TEXT    NOT NULL, -- HMAC-SHA256 of report data
  generatedByUserId TEXT  NOT NULL REFERENCES Users(id),
  generatedAt     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  periodFrom      TEXT    NOT NULL, -- admission date
  periodTo        TEXT    NOT NULL, -- discharge date or report gen date
  pdfStoredAt     TEXT,             -- local file path if persisted
  metadata        TEXT              -- JSON blob: page count, section flags
);

CREATE INDEX IF NOT EXISTS idx_patientreports_patient
    ON PatientReports(patientId, tenantId);

CREATE INDEX IF NOT EXISTS idx_patientreports_hash
    ON PatientReports(reportHash);

-- Migration for admittedAt
ALTER TABLE Patients ADD COLUMN admittedAt DATETIME;

-- Migration: Users email, employeeCode, tokenVersion
ALTER TABLE Users ADD COLUMN email TEXT;
ALTER TABLE Users ADD COLUMN employeeCode TEXT;
ALTER TABLE Users ADD COLUMN tokenVersion INTEGER DEFAULT 0;

-- Migration: Tenants code
ALTER TABLE Tenants ADD COLUMN code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON Tenants(code) WHERE code IS NOT NULL;

-- Migration: residence + statistics indexes (014)
ALTER TABLE Patients ADD COLUMN residence TEXT
  CHECK(residence IS NULL OR residence IN ('rural', 'suburban', 'urban'));
CREATE INDEX IF NOT EXISTS idx_patients_residence ON Patients(residence) WHERE residence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_dob ON Patients(dob);
CREATE INDEX IF NOT EXISTS idx_patients_gender ON Patients(gender) WHERE gender IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_admitted_at ON Patients(admittedAt);
CREATE INDEX IF NOT EXISTS idx_archives_duration ON HospitalArchives(tenantId, archivedAt);

-- Migration 015: Extended patient demographics
ALTER TABLE Patients ADD COLUMN uhid TEXT;
ALTER TABLE Patients ADD COLUMN nationality TEXT;
ALTER TABLE Patients ADD COLUMN occupation TEXT;
ALTER TABLE Patients ADD COLUMN maritalStatus TEXT CHECK(maritalStatus IS NULL OR maritalStatus IN ('single','married','widowed','divorced','other'));
ALTER TABLE Patients ADD COLUMN codeStatus TEXT CHECK(codeStatus IS NULL OR codeStatus IN ('full_code','dnr','dni','comfort_only')) DEFAULT 'full_code';
ALTER TABLE Patients ADD COLUMN insuranceProvider TEXT;
ALTER TABLE Patients ADD COLUMN insurancePolicyNo TEXT;
ALTER TABLE Patients ADD COLUMN tpaName TEXT;
ALTER TABLE Patients ADD COLUMN tpaClaimNo TEXT;

-- Migration 016: Clinical discharge tables
CREATE TABLE IF NOT EXISTS MedicalHistory (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL UNIQUE,
  tenantId TEXT NOT NULL,
  comorbidities TEXT,
  surgicalHistory TEXT,
  familyHistory TEXT,
  socialHistory TEXT,
  createdBy TEXT NOT NULL,
  updatedBy TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

CREATE TABLE IF NOT EXISTS StructuredAllergies (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  allergen TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('drug','food','environmental','other')),
  reaction TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('mild','moderate','severe','high')),
  verificationMethod TEXT,
  recordedBy TEXT NOT NULL,
  recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON StructuredAllergies(patientId, tenantId);

CREATE TABLE IF NOT EXISTS ClinicalPresentation (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL UNIQUE,
  tenantId TEXT NOT NULL,
  historyOfPresentingIllness TEXT,
  physicalExamFindings TEXT,
  examinedBy TEXT NOT NULL,
  examinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

CREATE TABLE IF NOT EXISTS LabInvestigations (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  investigationDate DATE NOT NULL,
  dayLabel TEXT,
  results TEXT NOT NULL,
  recordedBy TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);
CREATE INDEX IF NOT EXISTS idx_labs_patient ON LabInvestigations(patientId, tenantId, investigationDate);

CREATE TABLE IF NOT EXISTS ImagingReports (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  modalityType TEXT NOT NULL CHECK(modalityType IN ('ecg','xray','usg','ct','mri','pet','echo','spirometry','other')),
  investigationDate DATE NOT NULL,
  equipment TEXT,
  findings TEXT NOT NULL,
  impression TEXT,
  reportedBy TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);
CREATE INDEX IF NOT EXISTS idx_imaging_patient ON ImagingReports(patientId, tenantId);

CREATE TABLE IF NOT EXISTS ClinicalProcedures (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  procedureDate DATE NOT NULL,
  procedureName TEXT NOT NULL,
  performedBy TEXT NOT NULL,
  outcome TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);
CREATE INDEX IF NOT EXISTS idx_procedures_patient ON ClinicalProcedures(patientId, tenantId);

CREATE TABLE IF NOT EXISTS ClinicalTeam (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  registrationNo TEXT,
  qualification TEXT,
  clinicalRemarks TEXT,
  remarksDate DATE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);
CREATE INDEX IF NOT EXISTS idx_team_patient ON ClinicalTeam(patientId, tenantId);

CREATE TABLE IF NOT EXISTS ToxicologyScreens (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL UNIQUE,
  tenantId TEXT NOT NULL,
  screenDate DATE NOT NULL,
  bac TEXT,
  drugScreen TEXT,
  poisonScreen TEXT,
  heavyMetals TEXT,
  recordedBy TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patientId) REFERENCES Patients(id)
);

-- Migration 017: Extended DischargeSummaries columns
ALTER TABLE DischargeSummaries ADD COLUMN admissionDiagnosis TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeDiagnosis TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN conditionAtDischarge TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeMode TEXT CHECK(dischargeMode IS NULL OR dischargeMode IN ('home','ama','transferred','lama','expired'));
ALTER TABLE DischargeSummaries ADD COLUMN dischargePrescription TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN followUpSchedule TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeInstructions TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dietaryRestrictions TEXT;
