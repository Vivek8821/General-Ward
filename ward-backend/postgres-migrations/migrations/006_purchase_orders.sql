-- Migration 006: Purchase Orders (Automated Procurement)
-- Purpose: Track automated and manual procurement events for pharmacy stock.

CREATE TABLE IF NOT EXISTS "PurchaseOrders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" TEXT CHECK ("status" IN ('pending', 'ordered', 'received', 'cancelled')) DEFAULT 'pending',
  "generatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "orderedAt" TIMESTAMP WITH TIME ZONE,
  "receivedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT,
  "notes" TEXT,
  CONSTRAINT fk_stock FOREIGN KEY ("stockId") REFERENCES "PharmacyStock"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_stock ON "PurchaseOrders"("tenantId", "stockId", "status");
