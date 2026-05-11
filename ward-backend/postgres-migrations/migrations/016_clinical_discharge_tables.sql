-- Migration 016: New clinical data tables for discharge report

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
