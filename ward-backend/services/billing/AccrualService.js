const crypto = require('crypto');
const dbAdapter = require('../../db-adapter');
const patientRepository = require('../../repositories/PatientRepository');
const lineRepo = require('../../repositories/billing/InvoiceLineRepository');
const logger = require('../../utils/logger');
const { findOrCreateOpenInvoice } = require('./InvoiceHelpers');

const DEFAULT_WARD_RATES = { 1: 500, 2: 1000, 3: 2500, 4: 5000 };
const DEFAULT_CONSULTATION_FEE = 500;

// Inclusive list of YYYY-MM-DD strings from `start` (Date) to `end` (Date), UTC.
function dateRangeUTC(start, end) {
  const days = [];
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function getWardRate(tenantId, careIntensity) {
  const row = await dbAdapter.get(
    `SELECT dailyRate FROM WardRates WHERE tenantId = ? AND careIntensity = ?`,
    [tenantId, careIntensity]
  );
  if (row) return Number(row.dailyRate);
  const fallback = await dbAdapter.get(
    `SELECT dailyRate FROM WardRates WHERE tenantId = 'tenant-default' AND careIntensity = ?`,
    [careIntensity]
  );
  if (fallback) return Number(fallback.dailyRate);
  return DEFAULT_WARD_RATES[careIntensity] || 0;
}

async function getConsultationFee(tenantId) {
  const row = await dbAdapter.get(
    `SELECT fee FROM ConsultationRate WHERE tenantId = ?`,
    [tenantId]
  );
  if (row) return Number(row.fee);
  const fallback = await dbAdapter.get(
    `SELECT fee FROM ConsultationRate WHERE tenantId = 'tenant-default'`,
    []
  );
  if (fallback) return Number(fallback.fee);
  return DEFAULT_CONSULTATION_FEE;
}

// Add one ward-day line per calendar day from admittedAt through today (UTC),
// only for active patients. Idempotent via the unique (tenantId, source, sourceRef) index.
async function accrueWardCharges(patient, tenantId) {
  if (!patient || patient.status === 'discharged') return 0;
  if (!patient.admittedAt) return 0;

  const admit = new Date(patient.admittedAt);
  const today = new Date();
  if (isNaN(admit.getTime()) || admit > today) return 0;

  const dailyRate = await getWardRate(tenantId, patient.careIntensity || 1);
  if (!(dailyRate > 0)) return 0;

  const invoice = await findOrCreateOpenInvoice(patient.id, tenantId, 'system');
  const days = dateRangeUTC(admit, today);

  let added = 0;
  for (const day of days) {
    const sourceRef = `ward-${patient.id}-${day}`;
    const lineId = crypto.randomUUID();
    try {
      const line = await lineRepo.create({
        id: lineId,
        tenantId,
        invoiceId: invoice.id,
        source: 'ward',
        sourceRef,
        description: `Ward charge — ${day} (care level ${patient.careIntensity || 1})`,
        quantity: 1,
        unitPrice: dailyRate,
      });
      // If the line returned an existing row (idempotent hit), id won't match the one we generated.
      if (line && line.id === lineId) added += 1;
    } catch (err) {
      // If the invoice has been finalized since our findOrCreate, lineRepo will refuse.
      // That's the correct behavior — stop accruing on a locked invoice.
      logger.warn('billing_ward_accrual_failed', {
        event: 'ward_accrual_failed',
        patientId: patient.id,
        day,
        message: err.message,
      });
      break;
    }
  }
  return added;
}

async function accrueConsultationFee({ patientId, tenantId, doctorId }) {
  if (!patientId || !tenantId || !doctorId) return null;
  const fee = await getConsultationFee(tenantId);
  if (!(fee > 0)) return null;

  const day = new Date().toISOString().slice(0, 10);
  const sourceRef = `cons-${doctorId}-${patientId}-${day}`;

  const invoice = await findOrCreateOpenInvoice(patientId, tenantId, 'system');
  const lineId = crypto.randomUUID();
  return lineRepo.create({
    id: lineId,
    tenantId,
    invoiceId: invoice.id,
    source: 'consultation',
    sourceRef,
    description: `Doctor consultation — ${day}`,
    quantity: 1,
    unitPrice: fee,
  });
}

async function safeAccrueForPatient(patientId, tenantId) {
  try {
    const patient = await patientRepository.findById(patientId, tenantId);
    if (!patient) return;
    await accrueWardCharges(patient, tenantId);
  } catch (err) {
    logger.warn('billing_accrual_failed', {
      event: 'accrual_failed',
      patientId,
      message: err.message,
    });
  }
}

async function safeAccrueConsultation(opts) {
  try {
    return await accrueConsultationFee(opts);
  } catch (err) {
    logger.warn('billing_consultation_hook_failed', {
      event: 'consultation_hook_failed',
      patientId: opts.patientId,
      message: err.message,
    });
    return null;
  }
}

module.exports = { accrueWardCharges, accrueConsultationFee, safeAccrueForPatient, safeAccrueConsultation };
