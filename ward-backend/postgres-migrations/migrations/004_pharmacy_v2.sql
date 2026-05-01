-- Migration: 004_pharmacy_v2
-- Enterprise Pharmacy Schema for Postgres

CREATE TABLE IF NOT EXISTS PharmacyStock (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  composition TEXT,
  type TEXT,
  category TEXT,
  quantityPerUnit INTEGER DEFAULT 1,
  totalUnits INTEGER DEFAULT 0,
  totalQuantity INTEGER DEFAULT 0,
  unit TEXT,
  itemUnit TEXT,
  costPerUnit REAL DEFAULT 0,
  expiryDate DATE,
  manufacturer TEXT,
  minThreshold INTEGER DEFAULT 10,
  lastUpdated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenantId, name, composition)
);

CREATE TABLE IF NOT EXISTS PharmacyTransactions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  medicationId TEXT NOT NULL REFERENCES PharmacyStock(id),
  type TEXT NOT NULL CHECK(type IN ('restock', 'dispense', 'adjustment', 'waste')),
  quantity INTEGER NOT NULL,
  userId TEXT NOT NULL,
  userName TEXT NOT NULL,
  patientId TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Default Trigger
DROP TRIGGER IF EXISTS trg_pharmacystock_tenant_default ON PharmacyStock;
CREATE TRIGGER trg_pharmacystock_tenant_default
BEFORE INSERT OR UPDATE ON PharmacyStock
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_pharmacytransactions_tenant_default ON PharmacyTransactions;
CREATE TRIGGER trg_pharmacytransactions_tenant_default
BEFORE INSERT OR UPDATE ON PharmacyTransactions
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_tenant_name ON PharmacyStock(tenantId, name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_med ON PharmacyTransactions(medicationId);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tx_tenant_time ON PharmacyTransactions(tenantId, timestamp DESC);
