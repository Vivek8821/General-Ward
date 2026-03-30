-- Immutable discharge snapshots for hospital archive (full patient file at discharge).

CREATE TABLE IF NOT EXISTS HospitalArchives (
  id TEXT PRIMARY KEY,
  tenantId TEXT,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  dischargeSummaryId TEXT NOT NULL REFERENCES DischargeSummaries(id),
  archivedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dischargedBy TEXT NOT NULL,
  patientName TEXT NOT NULL,
  mrn TEXT NOT NULL,
  bedNumber TEXT NOT NULL,
  snapshotJson TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hospital_archives_tenant_time ON HospitalArchives(tenantId, archivedAt DESC);

DROP TRIGGER IF EXISTS trg_hospitalarchives_tenant_default ON HospitalArchives;
CREATE TRIGGER trg_hospitalarchives_tenant_default
BEFORE INSERT OR UPDATE ON HospitalArchives
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

UPDATE HospitalArchives SET tenantId = 'tenant-default' WHERE tenantId IS NULL;
