-- Migration: 005_pharmacy_batches
-- Batch & Lot Tracking for Pharmacy Inventory

CREATE TABLE IF NOT EXISTS PharmacyBatches (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  stockId TEXT NOT NULL REFERENCES PharmacyStock(id),
  batchNumber TEXT NOT NULL,
  expiryDate DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  costPerUnit REAL DEFAULT 0,
  manufacturer TEXT,
  receivedDate DATE,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'recalled', 'depleted')),
  notes TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  lastUpdated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenantId, stockId, batchNumber)
);

-- Tenant Default Trigger
DROP TRIGGER IF EXISTS trg_pharmacybatches_tenant_default ON PharmacyBatches;
CREATE TRIGGER trg_pharmacybatches_tenant_default
BEFORE INSERT OR UPDATE ON PharmacyBatches
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batches_stock ON PharmacyBatches(stockId);
CREATE INDEX IF NOT EXISTS idx_batches_tenant_expiry ON PharmacyBatches(tenantId, expiryDate ASC);
CREATE INDEX IF NOT EXISTS idx_batches_lot ON PharmacyBatches(tenantId, batchNumber);
CREATE INDEX IF NOT EXISTS idx_batches_status ON PharmacyBatches(tenantId, status);
