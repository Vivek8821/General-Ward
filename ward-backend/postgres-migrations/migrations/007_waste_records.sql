-- Migration 007: Waste Records (Clinical Waste & Spillage Management)
-- Purpose: Track medication waste/spillage with dual sign-off workflow (initiator + witness).

CREATE TABLE IF NOT EXISTS "WasteRecords" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "batchId" TEXT,
  "quantityWasted" INTEGER NOT NULL CHECK ("quantityWasted" > 0),
  "unit" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL CHECK ("reasonCode" IN ('EXPIRED','DAMAGED','CONTAMINATED','SPILL','OTHER')),
  "reasonNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','CONFIRMED','CANCELLED')),
  "initiatedByUserId" TEXT NOT NULL,
  "initiatedByUserName" TEXT NOT NULL,
  "initiatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "witnessUserId" TEXT,
  "witnessUserName" TEXT,
  "witnessedAt" TIMESTAMP WITH TIME ZONE,
  "pharmacyTransactionId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waste_stock FOREIGN KEY ("stockId") REFERENCES "PharmacyStock"("id") ON DELETE CASCADE,
  CONSTRAINT fk_waste_batch FOREIGN KEY ("batchId") REFERENCES "PharmacyBatches"("id"),
  CONSTRAINT fk_waste_txn FOREIGN KEY ("pharmacyTransactionId") REFERENCES "PharmacyTransactions"("id")
);

CREATE INDEX IF NOT EXISTS idx_wasterecords_tenant ON "WasteRecords"("tenantId");
CREATE INDEX IF NOT EXISTS idx_wasterecords_status ON "WasteRecords"("status", "tenantId");
CREATE INDEX IF NOT EXISTS idx_wasterecords_stock ON "WasteRecords"("stockId", "tenantId");
