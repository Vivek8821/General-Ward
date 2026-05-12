-- Add soft-delete support to clinical record tables.
-- Legal requirement: clinical records must not be physically erased (audit trail).
ALTER TABLE LabInvestigations ADD COLUMN deletedAt TEXT;
ALTER TABLE ImagingReports ADD COLUMN deletedAt TEXT;
ALTER TABLE StructuredAllergies ADD COLUMN deletedAt TEXT;
ALTER TABLE ClinicalProcedures ADD COLUMN deletedAt TEXT;
ALTER TABLE ClinicalTeam ADD COLUMN deletedAt TEXT;
ALTER TABLE MedicationAdministrations ADD COLUMN deletedAt TEXT;
