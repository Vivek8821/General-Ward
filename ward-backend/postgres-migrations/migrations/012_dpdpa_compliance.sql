-- DPDPA 2023 Compliance Schema Extension
-- Adds compliance columns and tables required under DPDPA Rules 2025.
-- Effective enforcement date: 13 May 2027.

-- Patients: admission notice (Section 5), minor flag (Section 9), nominee (Section 14), retention (Rule 8)
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS notice_given_at TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS notice_given_by TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS is_minor INTEGER DEFAULT 0;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS guardian_contact TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS guardian_notice_at TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS data_nominee TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS data_nominee_relationship TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS retention_due_at TEXT;

-- AuditLogs: patient-level access tracking (Rule 6)
ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS patientId TEXT;
CREATE INDEX IF NOT EXISTS idx_auditlogs_patientid ON AuditLogs(patientId) WHERE patientId IS NOT NULL;

-- Section 12: Correction and Erasure Requests
CREATE TABLE IF NOT EXISTS DpdpaCorrectionRequests (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  patientId TEXT NOT NULL,
  requestedBy TEXT NOT NULL,
  requestedAt TEXT NOT NULL,
  requestType TEXT NOT NULL CHECK(requestType IN ('correction', 'erasure')),
  fieldsAffected TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'resolved', 'rejected')),
  reviewedBy TEXT,
  resolvedAt TEXT,
  resolutionNotes TEXT,
  createdAt TEXT NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_correction_req_tenant ON DpdpaCorrectionRequests(tenantId);
CREATE INDEX IF NOT EXISTS idx_correction_req_patient ON DpdpaCorrectionRequests(patientId);

-- Section 13: Grievance Redressal
CREATE TABLE IF NOT EXISTS DpdpaGrievances (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  patientId TEXT,
  complainantName TEXT NOT NULL,
  complainantContact TEXT,
  description TEXT NOT NULL,
  category TEXT CHECK(category IN ('data_access', 'correction_delay', 'breach', 'other')),
  filedAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'escalated')),
  assignedTo TEXT,
  resolvedAt TEXT,
  resolutionNotes TEXT,
  createdAt TEXT NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grievances_tenant ON DpdpaGrievances(tenantId);

-- Section 11: Data Sharing Log
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
  createdAt TEXT NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sharing_log_tenant ON DpdpaDataSharingLog(tenantId);
CREATE INDEX IF NOT EXISTS idx_sharing_log_patient ON DpdpaDataSharingLog(patientId);
