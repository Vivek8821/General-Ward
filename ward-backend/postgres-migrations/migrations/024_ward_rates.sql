-- Migration: 024_ward_rates
-- Per-tenant ward day rate by careIntensity tier (Private edition billing).

CREATE TABLE IF NOT EXISTS WardRates (
  tenantId TEXT NOT NULL,
  careIntensity INTEGER NOT NULL CHECK (careIntensity IN (1,2,3,4)),
  dailyRate NUMERIC(12,2) NOT NULL,
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenantId, careIntensity)
);

-- Seed defaults for tenant-default. Other tenants will fall back to these
-- in application code; this row is the canonical default set.
INSERT INTO WardRates (tenantId, careIntensity, dailyRate) VALUES
  ('tenant-default', 1, 500),
  ('tenant-default', 2, 1000),
  ('tenant-default', 3, 2500),
  ('tenant-default', 4, 5000)
ON CONFLICT (tenantId, careIntensity) DO NOTHING;

DROP TRIGGER IF EXISTS trg_wardrates_tenant_default ON WardRates;
CREATE TRIGGER trg_wardrates_tenant_default
BEFORE INSERT OR UPDATE ON WardRates
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

-- Consultation rate is a single per-tenant value for MVP; same table is fine.
CREATE TABLE IF NOT EXISTS ConsultationRate (
  tenantId TEXT PRIMARY KEY,
  fee NUMERIC(12,2) NOT NULL,
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ConsultationRate (tenantId, fee) VALUES ('tenant-default', 500)
ON CONFLICT (tenantId) DO NOTHING;

DROP TRIGGER IF EXISTS trg_consultationrate_tenant_default ON ConsultationRate;
CREATE TRIGGER trg_consultationrate_tenant_default
BEFORE INSERT OR UPDATE ON ConsultationRate
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();
