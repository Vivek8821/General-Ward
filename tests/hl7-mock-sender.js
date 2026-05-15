/**
 * HL7 Mock Sender — integration tests for the MLLP/HL7 integration.
 *
 * Requires:
 *   HL7_ENABLED=true HL7_PORT=2575 HL7_TENANT_ID=<tenantId> already started,
 *   or run via: node tests/hl7-mock-sender.js
 *
 * Tests:
 *   1. Happy path       — valid MRN, lab result created in DB.
 *   2. Idempotency trap — same message twice, only one DB record created.
 *   3. Fuzzy orphan     — malformed MRN (spaces + dashes), routed to orphan queue.
 *
 * Usage:
 *   HL7_TENANT_ID=tenant_default node tests/hl7-mock-sender.js
 *
 * The script reads HL7_PORT (default 2575) and HL7_TENANT_ID from env.
 * It connects to the running server and verifies DB state after each test.
 */

const net = require('net');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../ward-backend/.env') });

// Set dialect for db-adapter before requiring it.
process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';

const dbAdapter = require('../ward-backend/db-adapter');
const { initDb } = require('../ward-backend/db');

const PORT      = parseInt(process.env.HL7_PORT     || '2575', 10);
const TENANT_ID = process.env.HL7_TENANT_ID;

if (!TENANT_ID) {
  console.error('ERROR: HL7_TENANT_ID env var is required');
  process.exit(1);
}

const VT = 0x0b;
const FS = 0x1c;
const CR = 0x0d;

function wrapMllp(text) {
  return Buffer.concat([Buffer.from([VT]), Buffer.from(text, 'utf8'), Buffer.from([FS, CR])]);
}

function buildOruR01(controlId, mrn, testName, value, units) {
  const now = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return [
    `MSH|^~\\&|TEST_LIMS|TEST_LAB|GeneralWard|Hospital|${now}||ORU^R01|${controlId}|P|2.5`,
    `PID|1||${mrn}^^^LAB^MR||Doe^John|||M`,
    `OBR|1|ORD001|${controlId}|${testName}^${testName}|||${now}`,
    `OBX|1|NM|${testName}^${testName}||${value}|${units}|Normal|||F`,
  ].join('\r') + '\r';
}

async function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(PORT, '127.0.0.1', () => {
      sock.write(wrapMllp(text));
    });

    let buf = Buffer.alloc(0);
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const fsIdx = buf.indexOf(FS);
      if (fsIdx !== -1) {
        const ack = buf.slice(1, fsIdx).toString('utf8');
        sock.destroy();
        resolve(ack);
      }
    });

    sock.on('error', reject);
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('Timeout')); });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ── Test 1: Happy path ────────────────────────────────────────────────────────
async function test1_happyPath(mrn) {
  console.log('\nTest 1: Happy path — valid MRN');
  const controlId = `TEST-HAPPY-${Date.now()}`;
  const msg = buildOruR01(controlId, mrn, 'CBC', '12.5', 'g/dL');

  const ack = await sendMessage(msg);
  assert('ACK received', ack.includes('MSA'));
  assert('ACK code is AA', ack.includes('|AA|'));

  await sleep(400); // allow async processing

  const inbound = await dbAdapter.queryOne(
    `SELECT * FROM Hl7InboundMessages WHERE tenantId = ? AND messageId = ?`,
    [TENANT_ID, controlId]
  );
  assert('Inbound message recorded', !!inbound);
  assert('Status is processed', inbound?.status === 'processed', inbound?.status);
  assert('Lab record created', !!inbound?.labRecordId);

  if (inbound?.labRecordId) {
    const lab = await dbAdapter.queryOne(
      `SELECT * FROM LabInvestigations WHERE id = ? AND tenantId = ?`,
      [inbound.labRecordId, TENANT_ID]
    );
    assert('LabInvestigation row exists', !!lab);
    assert('isMachineGenerated = 1', lab?.isMachineGenerated === 1, String(lab?.isMachineGenerated));
    assert('externalMsgId matches controlId', lab?.externalMsgId === controlId, lab?.externalMsgId);
    assert('source = hl7', lab?.source === 'hl7', lab?.source);

    const changelog = await dbAdapter.queryOne(
      `SELECT * FROM ClinicalChangeLog WHERE entityId = ? AND tenantId = ?`,
      [inbound.labRecordId, TENANT_ID]
    );
    assert('ClinicalChangeLog entry created', !!changelog);
    assert('userId is HL7_SERVICE', changelog?.userId === 'HL7_SERVICE', changelog?.userId);
    assert('action is HL7_INGEST', changelog?.action === 'HL7_INGEST', changelog?.action);
  }
}

// ── Test 2: Idempotency trap ──────────────────────────────────────────────────
async function test2_idempotency(mrn) {
  console.log('\nTest 2: Idempotency trap — same message twice');
  const controlId = `TEST-IDEM-${Date.now()}`;
  const msg = buildOruR01(controlId, mrn, 'HBA1C', '6.5', '%');

  const ack1 = await sendMessage(msg);
  assert('First ACK is AA', ack1.includes('|AA|'));
  await sleep(400);

  const ack2 = await sendMessage(msg);
  assert('Second ACK is AA (always)', ack2.includes('|AA|'));
  await sleep(400);

  const count = await dbAdapter.queryOne(
    `SELECT COUNT(*) AS n FROM LabInvestigations WHERE tenantId = ? AND externalMsgId = ?`,
    [TENANT_ID, controlId]
  );
  assert('Only one LabInvestigation created', Number(count?.n) === 1, String(count?.n));

  const inboundCount = await dbAdapter.queryOne(
    `SELECT COUNT(*) AS n FROM Hl7InboundMessages WHERE tenantId = ? AND messageId = ?`,
    [TENANT_ID, controlId]
  );
  assert('Only one Hl7InboundMessages row (unique index)', Number(inboundCount?.n) === 1, String(inboundCount?.n));
}

// ── Test 3: Fuzzy orphan ──────────────────────────────────────────────────────
async function test3_fuzzyOrphan() {
  console.log('\nTest 3: Fuzzy orphan — malformed MRN (spaces + dashes)');
  const controlId  = `TEST-ORPHAN-${Date.now()}`;
  // Deliberately malformed MRN that should NOT match any patient.
  const badMrn     = 'XX - 99999 - UNKNOWN';
  const msg = buildOruR01(controlId, badMrn, 'LFT', '45', 'U/L');

  const ack = await sendMessage(msg);
  assert('ACK received', ack.includes('MSA'));
  assert('ACK code is AA even for orphan', ack.includes('|AA|'));

  await sleep(400);

  const inbound = await dbAdapter.queryOne(
    `SELECT * FROM Hl7InboundMessages WHERE tenantId = ? AND messageId = ?`,
    [TENANT_ID, controlId]
  );
  assert('Inbound message recorded', !!inbound);
  assert('Status is orphaned', inbound?.status === 'orphaned', inbound?.status);
  assert('No lab record created', !inbound?.labRecordId);

  if (inbound) {
    const orphan = await dbAdapter.queryOne(
      `SELECT * FROM Hl7OrphanedMessages WHERE tenantId = ? AND inboundId = ?`,
      [TENANT_ID, inbound.id]
    );
    assert('Orphan row created', !!orphan);
    assert('rawMrn stored', orphan?.rawMrn === badMrn, orphan?.rawMrn);
    assert('linkedPatientId is null', orphan?.linkedPatientId === null || orphan?.linkedPatientId === undefined);
  }
}

async function run() {
  console.log(`\nHL7 Mock Sender — connecting to 127.0.0.1:${PORT}`);
  console.log(`Tenant: ${TENANT_ID}\n`);

  // Initialize SQLite (needed for direct DB queries).
  if (process.env.DB_DIALECT !== 'postgres') {
    await initDb();
  }

  // Find a real patient MRN from the DB to use in tests 1 and 2.
  const patient = await dbAdapter.queryOne(
    `SELECT id, mrn FROM Patients WHERE tenantId = ? AND status = 'active' LIMIT 1`,
    [TENANT_ID]
  );

  if (!patient) {
    console.error('ERROR: No active patients found for tenant. Seed the DB first.');
    process.exit(1);
  }

  console.log(`Using patient MRN: ${patient.mrn} (id: ${patient.id})`);

  await test1_happyPath(patient.mrn);
  await test2_idempotency(patient.mrn);
  await test3_fuzzyOrphan();

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
