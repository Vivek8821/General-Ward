/**
 * HL7 domain mapping service.
 *
 * Responsibilities:
 * - Idempotency: duplicate messages are recorded but not re-processed.
 * - Fuzzy patient matching: normalizes MRN before lookup to handle spaces/dashes/zeros.
 * - Orphan protocol: unmatched messages go to Hl7OrphanedMessages for later linking.
 * - Clinical records: creates LabInvestigation rows via the repository.
 * - Audit: writes to ClinicalChangeLog for every ingested result.
 */

const crypto = require('crypto');
const dbAdapter = require('../../db-adapter');
const labRepo = require('../../repositories/LabInvestigationRepository');
const logger = require('../../utils/logger');

// Strip spaces, dashes, and leading zeros for fuzzy comparison.
function normalizeId(id) {
  if (!id) return '';
  return id.replace(/[\s\-]/g, '').replace(/^0+/, '').toLowerCase();
}

async function findPatientFuzzy(tenantId, rawMrn) {
  const normalized = normalizeId(rawMrn);
  if (!normalized) return null;

  // Normalize at the DB side too: strip dashes and spaces, then compare lowercased.
  const row = await dbAdapter.queryOne(
    `SELECT id, mrn, name FROM Patients
      WHERE tenantId = ?
        AND LOWER(REPLACE(REPLACE(mrn, '-', ''), ' ', '')) = ?
        AND status != 'archived'
      LIMIT 1`,
    [tenantId, normalized]
  );
  return row || null;
}

async function checkIdempotency(tenantId, messageId) {
  const existing = await dbAdapter.queryOne(
    `SELECT id, status FROM Hl7InboundMessages WHERE tenantId = ? AND messageId = ?`,
    [tenantId, messageId]
  );
  return existing; // null = not seen before
}

async function logToChangeLog(tx, { tenantId, entityType, entityId, action, summary }) {
  const id = crypto.randomUUID();
  await tx.execute(
    `INSERT INTO ClinicalChangeLog (id, tenantId, userId, userRole, entityType, entityId, action, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, 'HL7_SERVICE', 'system', entityType, entityId, action, summary]
  );
}

async function recordInboundMessage(tx, { id, tenantId, msh, rawText, patientId, labRecordId, status }) {
  await tx.execute(
    `INSERT INTO Hl7InboundMessages
       (id, tenantId, messageId, messageType, sendingApp, sendingFacility, rawMessage, patientId, labRecordId, status, processedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [id, tenantId, msh.controlId, msh.messageType, msh.sendingApp, msh.sendingFacility, rawText, patientId || null, labRecordId || null, status]
  );
}

async function ingestOrphan(tx, { inboundId, tenantId, msh, pid, rawText }) {
  const id = crypto.randomUUID();
  await tx.execute(
    `INSERT INTO Hl7OrphanedMessages
       (id, tenantId, inboundId, sendingApp, rawMrn, messageType, rawMessage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, inboundId, msh.sendingApp, pid?.mrn || null, msh.messageType, rawText]
  );
  logger.warn('HL7 orphan: patient not found', {
    controlId:  msh.controlId,
    rawMrn:     pid?.mrn,
    sendingApp: msh.sendingApp,
  });
  return id;
}

function buildLabResults(obr, obxList) {
  const tests = obxList.map((o) => ({
    test:     o.name || o.code,
    value:    o.value,
    units:    o.units || '',
    refRange: o.refRange || '',
    flag:     o.abnFlag || '',
  }));
  return {
    source:  'HL7_LIMS',
    orderId: obr?.orderId || null,
    panel:   obr?.testName || obr?.testCode || 'Unknown Panel',
    tests,
  };
}

/**
 * Main entry point. Called once per valid MLLP message.
 * Only ORU^R01 is handled; others are logged and skipped.
 */
async function processOruR01(tenantId, parsed) {
  const { msh, pid, obr, obxList, rawText } = parsed;

  if (!msh.messageType.startsWith('ORU')) {
    logger.info('HL7 message type not handled', { messageType: msh.messageType, controlId: msh.controlId });
    return;
  }

  // Idempotency check outside transaction (read-only).
  const existing = await checkIdempotency(tenantId, msh.controlId);
  if (existing) {
    logger.info('HL7 duplicate message — skipped', { controlId: msh.controlId, status: existing.status });

    // Record duplicate marker without re-inserting (unique index enforces uniqueness).
    return;
  }

  const patient = pid?.mrn ? await findPatientFuzzy(tenantId, pid.mrn) : null;

  if (!patient) {
    // Orphan path — still record to inbound log then orphan table.
    await dbAdapter.withTransaction(async (tx) => {
      const inboundId = crypto.randomUUID();
      await recordInboundMessage(tx, { id: inboundId, tenantId, msh, rawText, patientId: null, labRecordId: null, status: 'orphaned' });
      await ingestOrphan(tx, { inboundId, tenantId, msh, pid, rawText });
    });
    return;
  }

  // Happy path — create lab record and audit entry.
  await dbAdapter.withTransaction(async (tx) => {
    const inboundId = crypto.randomUUID();

    const labRecord = await labRepo.createFromHl7(tx, {
      patientId:    patient.id,
      tenantId,
      investigationDate: obr?.specimenAt
        ? parseHl7Date(obr.specimenAt)
        : new Date().toISOString().slice(0, 10),
      dayLabel:     null,
      results:      buildLabResults(obr, obxList),
      recordedBy:   msh.sendingApp || 'HL7_LIMS',
      externalMsgId: msh.controlId,
    });

    await recordInboundMessage(tx, {
      id: inboundId, tenantId, msh, rawText,
      patientId: patient.id, labRecordId: labRecord.id, status: 'processed',
    });

    await logToChangeLog(tx, {
      tenantId,
      entityType: 'LabInvestigation',
      entityId:   labRecord.id,
      action:     'HL7_INGEST',
      summary:    `Received ${obr?.testName || 'lab result'} from ${msh.sendingApp} (${obxList.length} observations)`,
    });
  });

  logger.info('HL7 lab result ingested', {
    controlId:   msh.controlId,
    patientId:   patient.id,
    mrn:         patient.mrn,
    sendingApp:  msh.sendingApp,
    obsCount:    obxList.length,
  });
}

/**
 * Parse HL7 DTM format to a UTC calendar date string (YYYY-MM-DD).
 *
 * HL7 DTM: YYYY[MM[DD[HH[MM[SS]]]]][+/-ZZZZ]
 *   - Timezone offset (+HHMM/-HHMM) is optional.
 *   - When present: apply offset and return the UTC date.
 *   - When absent: HL7 spec says local time of the sender. We cannot recover
 *     that timezone, so we treat the value as UTC. Operators should configure
 *     analyzers to either send UTC timestamps or include the UTC offset.
 */
function parseHl7Date(dtm) {
  if (!dtm || dtm.length < 8) { const n = new Date().toISOString(); return `${n.slice(8,10)}-${n.slice(5,7)}-${n.slice(0,4)}`; }

  const y = dtm.slice(0, 4);
  const mo = dtm.slice(4, 6);
  const d = dtm.slice(6, 8);

  // Date-only — no time component, no conversion needed.
  if (dtm.length < 10) return `${d}-${mo}-${y}`;

  const hh = dtm.slice(8, 10);
  const mm = (dtm.slice(10, 12) || '00').padEnd(2, '0');
  const ss = (dtm.slice(12, 14) || '00').padEnd(2, '0');

  // Timezone offset is the last 5 chars if it matches [+-]HHMM.
  const tzMatch = dtm.match(/([+-]\d{4})$/);
  let isoStr;
  if (tzMatch) {
    const tz = tzMatch[1];                          // e.g. +0530
    isoStr = `${y}-${mo}-${d}T${hh}:${mm}:${ss}${tz.slice(0, 3)}:${tz.slice(3)}`;
  } else {
    // No offset supplied — treat as UTC (see note above).
    isoStr = `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`;
  }

  const date = new Date(isoStr);
  // Guard against malformed DTM values — fall back to the raw date component.
  if (isNaN(date.getTime())) return `${d}-${mo}-${y}`;
  const utc = date.toISOString(); // always UTC
  return `${utc.slice(8, 10)}-${utc.slice(5, 7)}-${utc.slice(0, 4)}`; // DD-MM-YYYY
}

module.exports = { processOruR01, normalizeId, findPatientFuzzy };
