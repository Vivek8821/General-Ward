const crypto = require('crypto');
const invoiceRepo = require('../../repositories/billing/InvoiceRepository');

async function findOrCreateOpenInvoice(patientId, tenantId, createdBy = 'system') {
  const existing = await invoiceRepo.findOpenForPatient(patientId, tenantId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await invoiceRepo.create({
    id,
    tenantId,
    patientId,
    createdBy,
    notes: 'Auto-created on first chargeable event',
  });
  return invoiceRepo.findById(id, tenantId);
}

module.exports = { findOrCreateOpenInvoice };
