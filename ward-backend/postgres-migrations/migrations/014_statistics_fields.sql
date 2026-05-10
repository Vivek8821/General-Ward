-- 014_statistics_fields.sql
-- Add residence classification and statistics indexes for hospital analytics

ALTER TABLE Patients ADD COLUMN residence TEXT
  CHECK(residence IS NULL OR residence IN ('rural', 'suburban', 'urban'));

CREATE INDEX IF NOT EXISTS idx_patients_residence ON Patients(residence)
  WHERE residence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_dob ON Patients(dob);
CREATE INDEX IF NOT EXISTS idx_patients_gender ON Patients(gender)
  WHERE gender IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_admitted_at ON Patients(admittedAt);
CREATE INDEX IF NOT EXISTS idx_archives_duration ON HospitalArchives(tenantId, archivedAt);
