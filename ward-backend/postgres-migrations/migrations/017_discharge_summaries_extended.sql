-- Migration 017: Extended DischargeSummaries columns for clinical discharge report
ALTER TABLE DischargeSummaries ADD COLUMN admissionDiagnosis TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeDiagnosis TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN conditionAtDischarge TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeMode TEXT CHECK(dischargeMode IS NULL OR dischargeMode IN ('home','ama','transferred','lama','expired'));
ALTER TABLE DischargeSummaries ADD COLUMN dischargePrescription TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN followUpSchedule TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dischargeInstructions TEXT;
ALTER TABLE DischargeSummaries ADD COLUMN dietaryRestrictions TEXT;
