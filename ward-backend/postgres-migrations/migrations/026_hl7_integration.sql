-- Migration: 026_hl7_integration
-- MLLP/HL7 v2.x inbound message store, orphan queue, and audit columns on
-- LabInvestigations and ImagingReports for machine-sourced records.

-- Inbound message log (all received HL7 messages, regardless of processing outcome)
CREATE TABLE IF NOT EXISTS Hl7InboundMessages (
  id             TEXT PRIMARY KEY,
  tenantId       TEXT NOT NULL,
  messageId      TEXT NOT NULL,             -- MSH-10 control ID
  messageType    TEXT NOT NULL,             -- e.g. ORU^R01
  sendingApp     TEXT,                      -- MSH-3
  sendingFacility TEXT,                     -- MSH-4
  rawMessage     TEXT NOT NULL,             -- full HL7 text for auditability
  patientId      TEXT,                      -- NULL if orphaned / unmatched
  labRecordId    TEXT,                      -- NULL until processed
  status         TEXT NOT NULL DEFAULT 'processed'
                   CHECK (status IN ('processed','orphaned','duplicate')),
  receivedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt    DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hl7_tenant_msgid
  ON Hl7InboundMessages(tenantId, messageId);

CREATE INDEX IF NOT EXISTS idx_hl7_tenant_status
  ON Hl7InboundMessages(tenantId, status);

-- Orphan queue — messages that arrived with an unrecognized/unresolvable patient ID
CREATE TABLE IF NOT EXISTS Hl7OrphanedMessages (
  id             TEXT PRIMARY KEY,
  tenantId       TEXT NOT NULL,
  inboundId      TEXT NOT NULL REFERENCES Hl7InboundMessages(id) ON DELETE CASCADE,
  sendingApp     TEXT,
  rawMrn         TEXT,                      -- the MRN as received from the machine
  messageType    TEXT,
  rawMessage     TEXT NOT NULL,
  linkedPatientId TEXT,                     -- set when an admin links the record
  linkedAt       DATETIME,
  linkedBy       TEXT,
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hl7orphan_tenant_linked
  ON Hl7OrphanedMessages(tenantId, linkedPatientId);

-- Extend LabInvestigations with machine-source tracking
ALTER TABLE LabInvestigations ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'manual';
ALTER TABLE LabInvestigations ADD COLUMN IF NOT EXISTS externalMsgId  TEXT;
ALTER TABLE LabInvestigations ADD COLUMN IF NOT EXISTS isMachineGenerated BOOLEAN DEFAULT FALSE;

-- Extend ImagingReports with machine-source tracking
ALTER TABLE ImagingReports ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'manual';
ALTER TABLE ImagingReports ADD COLUMN IF NOT EXISTS externalMsgId  TEXT;
ALTER TABLE ImagingReports ADD COLUMN IF NOT EXISTS isMachineGenerated BOOLEAN DEFAULT FALSE;
