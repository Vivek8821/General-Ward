const crypto = require('crypto');
const lineRepo = require('../../repositories/billing/InvoiceLineRepository');
const logger = require('../../utils/logger');
const { findOrCreateOpenInvoice } = require('./InvoiceHelpers');

// Idempotent on (tenantId, 'pharmacy', sourceRef) via the unique index on InvoiceLines.
// Designed to be best-effort: if billing throws, the clinical caller should swallow it.
async function recordDispenseCharge({ patientId, tenantId, sourceRef, description, quantity, unitPrice, createdBy }) {
  if (!patientId || !tenantId || !sourceRef) return null;
  const price = Number(unitPrice);
  if (!(price > 0)) return null;          // skip zero-priced or unknown-priced dispenses
  const qty = Number(quantity);
  if (!(qty > 0)) return null;

  const invoice = await findOrCreateOpenInvoice(patientId, tenantId, createdBy);
  const lineId = crypto.randomUUID();
  return lineRepo.create({
    id: lineId,
    tenantId,
    invoiceId: invoice.id,
    source: 'pharmacy',
    sourceRef,
    description,
    quantity: qty,
    unitPrice: price,
  });
}

// Best-effort wrapper: errors here must never block the clinical caller.
async function safeRecordDispenseCharge(opts) {
  try {
    return await recordDispenseCharge(opts);
  } catch (err) {
    logger.warn('billing_pharmacy_hook_failed', {
      event: 'billing_hook_failed',
      patientId: opts.patientId,
      sourceRef: opts.sourceRef,
      message: err.message,
    });
    return null;
  }
}

module.exports = { recordDispenseCharge, safeRecordDispenseCharge };
