-- Migration: 025_service_subtypes
-- Granular catalog: one subtype table per kind of charge (lab/imaging/procedure/consumable).
-- Each subtype row is 1:1 with a ServiceCatalog row via serviceId (PK + FK + cascade).
--
-- Medications continue to live in PharmacyStock (already has costPerUnit, composition, etc.).
-- Ward stays continue to use WardRates per careIntensity.

-- Note: the ServiceCatalog.category enum stays as it was in migration 023.
-- Consumables are recorded with category='misc' and discriminated by the existence
-- of a matching row in ServiceConsumable. Same model on both Postgres and SQLite.

CREATE TABLE IF NOT EXISTS ServiceLab (
  serviceId        TEXT PRIMARY KEY REFERENCES ServiceCatalog(id) ON DELETE CASCADE,
  specimenType     TEXT,          -- blood, urine, csf, stool, swab, tissue
  container        TEXT,          -- EDTA, plain, fluoride, sterile, ...
  methodology      TEXT,          -- e.g. Spectrophotometry, ELISA, PCR
  unitsOfMeasure   TEXT,          -- e.g. mg/dL, mmol/L
  normalLow        NUMERIC(14,4),
  normalHigh       NUMERIC(14,4),
  turnaroundHours  INTEGER,
  fastingRequired  BOOLEAN
);

CREATE TABLE IF NOT EXISTS ServiceImaging (
  serviceId        TEXT PRIMARY KEY REFERENCES ServiceCatalog(id) ON DELETE CASCADE,
  modality         TEXT,          -- xray, ct, mri, ultrasound, ecg, echo, mammography
  bodyRegion       TEXT,          -- head, chest, abdomen, spine, ...
  contrast         TEXT,          -- none, oral, iv, both
  durationMinutes  INTEGER,
  prepInstructions TEXT,
  radiationDoseMsv NUMERIC(8,4)
);

CREATE TABLE IF NOT EXISTS ServiceProcedure (
  serviceId        TEXT PRIMARY KEY REFERENCES ServiceCatalog(id) ON DELETE CASCADE,
  anaesthesiaType  TEXT,          -- none, local, regional, spinal, general
  otRequired       BOOLEAN,       -- needs operating theatre
  durationMinutes  INTEGER,
  postOpStayDays   INTEGER,
  surgeonGrade     TEXT,          -- consultant, senior_consultant, registrar
  specialty        TEXT           -- general_surgery, ortho, ob_gyn, cardiology, ...
);

CREATE TABLE IF NOT EXISTS ServiceConsumable (
  serviceId        TEXT PRIMARY KEY REFERENCES ServiceCatalog(id) ON DELETE CASCADE,
  sku              TEXT,
  size             TEXT,          -- 18G, 14F, 4x4cm, ...
  sterile          BOOLEAN,
  singleUse        BOOLEAN,
  unit             TEXT           -- piece, pair, set, pack
);

CREATE INDEX IF NOT EXISTS idx_servicelab_methodology ON ServiceLab(methodology);
CREATE INDEX IF NOT EXISTS idx_serviceimaging_modality ON ServiceImaging(modality);
CREATE INDEX IF NOT EXISTS idx_serviceprocedure_specialty ON ServiceProcedure(specialty);
CREATE INDEX IF NOT EXISTS idx_serviceconsumable_sku ON ServiceConsumable(sku);
