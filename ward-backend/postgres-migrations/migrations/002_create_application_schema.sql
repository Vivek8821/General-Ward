-- Phase SYNC.1.2
-- Full application schema parity for Postgres based on ward-backend/db.js.

CREATE TABLE IF NOT EXISTS Tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO Tenants (id, name)
VALUES ('tenant-default', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'admin')),
  tenantId TEXT,
  passwordHash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Patients (
  id TEXT PRIMARY KEY,
  tenantId TEXT,
  name TEXT NOT NULL,
  mrn TEXT UNIQUE NOT NULL,
  bedNumber TEXT NOT NULL,
  dob TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  allergies TEXT,
  careIntensity INTEGER DEFAULT 1 CHECK (careIntensity IN (1, 2, 3, 4)),
  status TEXT DEFAULT 'active',
  admittedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS DailyStats (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  type TEXT NOT NULL CHECK (type IN ('vital', 'symptom', 'diet', 'sleep', 'history')),
  data JSONB NOT NULL,
  recordedBy TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Medications (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  scheduledTimes TEXT,
  prn BOOLEAN DEFAULT FALSE,
  startDate DATE NOT NULL,
  prescribedBy TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS MedicationAdministrations (
  id TEXT PRIMARY KEY,
  medicationId TEXT NOT NULL REFERENCES Medications(id),
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  status TEXT NOT NULL CHECK (status IN ('given', 'refused', 'missed')),
  notes TEXT,
  administeredBy TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  doseActuallyGiven TEXT,
  reasonCode TEXT
);

CREATE TABLE IF NOT EXISTS Escalations (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  reason TEXT NOT NULL,
  escalatedBy TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS DischargeSummaries (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  reasonForAdmission TEXT NOT NULL,
  duration TEXT NOT NULL,
  medicationsDuringAdmission TEXT,
  dischargeVitals JSONB NOT NULL,
  dischargeRecommendations TEXT,
  dischargedBy TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Tasks (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  type TEXT NOT NULL CHECK (type IN ('vital', 'assessment', 'followup')),
  dueAt TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  assignee TEXT,
  notes TEXT,
  createdBy TEXT,
  completedBy TEXT,
  completedAt TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS HandoverNotes (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  tenantId TEXT,
  shift TEXT NOT NULL,
  note TEXT NOT NULL,
  tags TEXT,
  createdBy TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS AuditLogs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  userRole TEXT NOT NULL,
  tenantId TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  ipAddress TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statusCode INTEGER,
  success INTEGER
);

CREATE TABLE IF NOT EXISTS ClinicalChangeLog (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  userId TEXT NOT NULL,
  userRole TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS IdempotencyKeys (
  idempotencyKey TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  userId TEXT NOT NULL,
  patientId TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  responseStatus INTEGER,
  responseJson JSONB,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (idempotencyKey, tenantId, userId, patientId, endpoint)
);

CREATE TABLE IF NOT EXISTS AuthLoginAttempts (
  username TEXT NOT NULL,
  ipAddress TEXT NOT NULL,
  attemptCount INTEGER NOT NULL,
  firstAttemptAt TIMESTAMPTZ NOT NULL,
  lockedUntil TIMESTAMPTZ,
  PRIMARY KEY (username, ipAddress)
);

CREATE OR REPLACE FUNCTION set_default_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenantid IS NULL THEN
    NEW.tenantid := 'tenant-default';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_tenant_default ON Users;
CREATE TRIGGER trg_users_tenant_default
BEFORE INSERT OR UPDATE ON Users
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_patients_tenant_default ON Patients;
CREATE TRIGGER trg_patients_tenant_default
BEFORE INSERT OR UPDATE ON Patients
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_dailystats_tenant_default ON DailyStats;
CREATE TRIGGER trg_dailystats_tenant_default
BEFORE INSERT OR UPDATE ON DailyStats
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_medications_tenant_default ON Medications;
CREATE TRIGGER trg_medications_tenant_default
BEFORE INSERT OR UPDATE ON Medications
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_medicationadministrations_tenant_default ON MedicationAdministrations;
CREATE TRIGGER trg_medicationadministrations_tenant_default
BEFORE INSERT OR UPDATE ON MedicationAdministrations
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_escalations_tenant_default ON Escalations;
CREATE TRIGGER trg_escalations_tenant_default
BEFORE INSERT OR UPDATE ON Escalations
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_dischargesummaries_tenant_default ON DischargeSummaries;
CREATE TRIGGER trg_dischargesummaries_tenant_default
BEFORE INSERT OR UPDATE ON DischargeSummaries
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_tasks_tenant_default ON Tasks;
CREATE TRIGGER trg_tasks_tenant_default
BEFORE INSERT OR UPDATE ON Tasks
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_handovernotes_tenant_default ON HandoverNotes;
CREATE TRIGGER trg_handovernotes_tenant_default
BEFORE INSERT OR UPDATE ON HandoverNotes
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_auditlogs_tenant_default ON AuditLogs;
CREATE TRIGGER trg_auditlogs_tenant_default
BEFORE INSERT OR UPDATE ON AuditLogs
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_clinicalchangelog_tenant_default ON ClinicalChangeLog;
CREATE TRIGGER trg_clinicalchangelog_tenant_default
BEFORE INSERT OR UPDATE ON ClinicalChangeLog
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

UPDATE Users SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE Patients SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE DailyStats SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE Medications SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE MedicationAdministrations SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE Escalations SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE DischargeSummaries SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE Tasks SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE HandoverNotes SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE AuditLogs SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
UPDATE ClinicalChangeLog SET tenantId = 'tenant-default' WHERE tenantId IS NULL;

CREATE INDEX IF NOT EXISTS idx_dailystats_patient ON DailyStats(patientId);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON Medications(patientId);
CREATE INDEX IF NOT EXISTS idx_escalations_patient ON Escalations(patientId);
CREATE INDEX IF NOT EXISTS idx_discharges_patient ON DischargeSummaries(patientId);
CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(timestamp);
CREATE INDEX IF NOT EXISTS idx_auditlogs_tenant_timestamp ON AuditLogs(tenantId, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_tenant_time ON ClinicalChangeLog(tenantId, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clinicalchangelog_entity ON ClinicalChangeLog(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_tasks_patient ON Tasks(patientId);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON Tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON Tasks(status);
CREATE INDEX IF NOT EXISTS idx_handovernots_patient ON HandoverNotes(patientId);
CREATE INDEX IF NOT EXISTS idx_handovernots_timestamp ON HandoverNotes(timestamp);
