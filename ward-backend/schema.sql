-- Users Table
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
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
  status TEXT DEFAULT 'active'
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

-- Auth Lockout State
CREATE TABLE IF NOT EXISTS AuthLoginAttempts (
  username TEXT NOT NULL,
  ipAddress TEXT NOT NULL,
  attemptCount INTEGER NOT NULL,
  firstAttemptAt DATETIME NOT NULL,
  lockedUntil DATETIME,
  PRIMARY KEY (username, ipAddress)
);

-- Indexes
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
