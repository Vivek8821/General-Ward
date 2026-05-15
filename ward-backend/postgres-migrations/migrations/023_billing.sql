-- Migration: 023_billing
-- Revenue Cycle Management (Private edition)
-- Tables: ServiceCatalog, Invoices, InvoiceLines, Payments

CREATE TABLE IF NOT EXISTS ServiceCatalog (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('consultation','ward','procedure','lab','imaging','misc')),
  unitPrice NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenantId, code)
);

CREATE TABLE IF NOT EXISTS Invoices (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  patientId TEXT NOT NULL REFERENCES Patients(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','finalized','paid','cancelled')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discountTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  grandTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  paidTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  balanceDue NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  createdBy TEXT NOT NULL,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizedAt TIMESTAMPTZ,
  paidAt TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS InvoiceLines (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  invoiceId TEXT NOT NULL REFERENCES Invoices(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual','pharmacy','ward','consultation','lab','imaging','procedure')),
  sourceRef TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unitPrice NUMERIC(12,2) NOT NULL DEFAULT 0,
  lineTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Payments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  invoiceId TEXT NOT NULL REFERENCES Invoices(id),
  method TEXT NOT NULL CHECK (method IN ('cash','card','upi','razorpay','bank_transfer','other')),
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','captured','refunded','failed')),
  capturedAt TIMESTAMPTZ,
  refundedAt TIMESTAMPTZ,
  recordedBy TEXT NOT NULL,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_servicecatalog_tenant_default ON ServiceCatalog;
CREATE TRIGGER trg_servicecatalog_tenant_default
BEFORE INSERT OR UPDATE ON ServiceCatalog
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_invoices_tenant_default ON Invoices;
CREATE TRIGGER trg_invoices_tenant_default
BEFORE INSERT OR UPDATE ON Invoices
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_invoicelines_tenant_default ON InvoiceLines;
CREATE TRIGGER trg_invoicelines_tenant_default
BEFORE INSERT OR UPDATE ON InvoiceLines
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

DROP TRIGGER IF EXISTS trg_payments_tenant_default ON Payments;
CREATE TRIGGER trg_payments_tenant_default
BEFORE INSERT OR UPDATE ON Payments
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant();

CREATE INDEX IF NOT EXISTS idx_servicecatalog_tenant_category ON ServiceCatalog(tenantId, category);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_patient ON Invoices(tenantId, patientId);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON Invoices(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_invoicelines_invoice ON InvoiceLines(invoiceId);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON Payments(invoiceId);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON Payments(tenantId, status);

-- Idempotency for auto-linked charges: a given (tenantId, source, sourceRef)
-- can appear on at most one InvoiceLine. Manual lines (sourceRef NULL) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoicelines_source_ref
  ON InvoiceLines(tenantId, source, sourceRef) WHERE sourceRef IS NOT NULL;
