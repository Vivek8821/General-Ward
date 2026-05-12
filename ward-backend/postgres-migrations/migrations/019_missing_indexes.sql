-- Indexes missing from high-traffic tables.
-- MedicationAdministrations — used on every MAR page load, had zero indexes.
CREATE INDEX IF NOT EXISTS idx_med_admins_patient   ON MedicationAdministrations(patientId, tenantId);
CREATE INDEX IF NOT EXISTS idx_med_admins_med       ON MedicationAdministrations(medicationId);
CREATE INDEX IF NOT EXISTS idx_med_admins_timestamp ON MedicationAdministrations(timestamp DESC);

-- PharmacyTransactions — queried by medicationId and tenant+time in analytics.
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_med    ON PharmacyTransactions(medicationId);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_tenant ON PharmacyTransactions(tenantId, timestamp DESC);

-- WasteRecords — batch-level recall trace query scans batchId without index.
CREATE INDEX IF NOT EXISTS idx_waste_batch ON WasteRecords(batchId);

-- Medications — tenant+patient composite used in MAR join, single-column index was insufficient.
CREATE INDEX IF NOT EXISTS idx_medications_tenant ON Medications(tenantId, patientId);
