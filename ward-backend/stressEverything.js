/* eslint-disable no-console */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

const API_BASE = process.env.WARD_API_BASE || 'http://localhost:3001/api';
const DB_PATH = process.env.WARD_DB_PATH || path.resolve(__dirname, 'ward.db');

const DURATION_SEC = Number(process.env.DURATION_SEC || 20);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const REQ_TIMEOUT_MS = Number(process.env.REQ_TIMEOUT_MS || 10000);
const STRESS_SEED_DB = String(process.env.STRESS_SEED_DB || '0') === '1';

// If the backend is running, mutating `ward.db` from this script is unsafe (can corrupt the DB).
// Seeding is therefore opt-in and refused while the server is reachable.
async function isBackendUp() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/health`, { method: 'GET', signal: controller.signal });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function ensureFixture(db) {
  const tenantA = 'tenant-default';
  const tenantB = 'tenant-b';

  const doctorA = { id: 'sdA', name: 'StressDocA', role: 'doctor', tenantId: tenantA, password: 'A-1234' };
  const doctorB = { id: 'sdB', name: 'StressDocB', role: 'doctor', tenantId: tenantB, password: 'B-1234' };

  const patients = {
    A: { id: 'stress-pA', mrn: 'MRN-STRESS-A', bedNumber: 'A-1', name: 'Stress Patient A', dob: '1990-01-01', diagnosis: 'Stress Dx A', allergies: 'None', careIntensity: 2, status: 'active' },
    B: { id: 'stress-pB', mrn: 'MRN-STRESS-B', bedNumber: 'B-1', name: 'Stress Patient B', dob: '1991-01-01', diagnosis: 'Stress Dx B', allergies: 'None', careIntensity: 2, status: 'active' }
  };

  await dbRun(db, 'PRAGMA foreign_keys = OFF;');

  const saltRounds = 10;
  const drAH = await bcrypt.hash(doctorA.password, saltRounds);
  const drBH = await bcrypt.hash(doctorB.password, saltRounds);

  await dbRun(db, `INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)`, [tenantA, 'Tenant A']);
  await dbRun(db, `INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)`, [tenantB, 'Tenant B']);

  await dbRun(db, `DELETE FROM Users WHERE id IN (?, ?)`, [doctorA.id, doctorB.id]);
  await dbRun(db, `INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`, [doctorA.id, doctorA.name, doctorA.role, doctorA.tenantId, drAH]);
  await dbRun(db, `INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`, [doctorB.id, doctorB.name, doctorB.role, doctorB.tenantId, drBH]);

  for (const t of ['A', 'B']) {
    const p = patients[t];
    const tenantId = t === 'A' ? tenantA : tenantB;

    await dbRun(db, `DELETE FROM Patients WHERE id = ?`, [p.id]);
    await dbRun(
      db,
      `INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, tenantId, p.name, p.mrn, p.bedNumber, p.dob, p.diagnosis, p.allergies, p.careIntensity, p.status]
    );

    await dbRun(db, `DELETE FROM DailyStats WHERE patientId = ?`, [p.id]);
    await dbRun(db, `DELETE FROM HandoverNotes WHERE patientId = ?`, [p.id]);
    await dbRun(db, `DELETE FROM Tasks WHERE patientId = ?`, [p.id]);
    await dbRun(db, `DELETE FROM Medications WHERE patientId = ?`, [p.id]);
    await dbRun(db, `DELETE FROM MedicationAdministrations WHERE patientId = ?`, [p.id]);
    await dbRun(db, `DELETE FROM Escalations WHERE patientId = ?`, [p.id]);
  }

  // Vitals
  const vital1 = JSON.stringify({ bpSystolic: 120, bpDiastolic: 70, temp: 37.0, pulse: 70, respRate: 16, spo2: 98 });
  const vital2 = JSON.stringify({ bpSystolic: 128, bpDiastolic: 74, temp: 37.4, pulse: 82, respRate: 17, spo2: 97 });

  for (const t of ['A', 'B']) {
    const p = patients[t];
    const tenantId = t === 'A' ? tenantA : tenantB;
    const recordedBy = t === 'A' ? doctorA.name : doctorB.name;

    await dbRun(
      db,
      `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp)
       VALUES (?, ?, ?, 'vital', ?, ?, ?)`,
      [crypto.randomUUID(), tenantId, p.id, vital1, recordedBy, new Date(Date.now() - 60 * 60 * 1000).toISOString()]
    );
    await dbRun(
      db,
      `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp)
       VALUES (?, ?, ?, 'vital', ?, ?, ?)`,
      [crypto.randomUUID(), tenantId, p.id, vital2, recordedBy, new Date(Date.now() - 10 * 60 * 1000).toISOString()]
    );

    await dbRun(
      db,
      `INSERT INTO HandoverNotes (id, tenantId, patientId, shift, note, tags, createdBy, timestamp)
       VALUES (?, ?, ?, 'morning', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [crypto.randomUUID(), tenantId, p.id, 'Stress note: initial', 'stress', recordedBy]
    );
  }

  // Tasks
  for (const t of ['A', 'B']) {
    const p = patients[t];
    const tenantId = t === 'A' ? tenantA : tenantB;
    const createdBy = t === 'A' ? doctorA.name : doctorB.name;
    const assignee = createdBy;
    const taskCount = 8;

    for (let i = 0; i < taskCount; i++) {
      const taskId = `stress-task-${t}-${i}`;
      await dbRun(db, `DELETE FROM Tasks WHERE id = ?`, [taskId]);
      await dbRun(
        db,
        `INSERT INTO Tasks (id, tenantId, patientId, type, dueAt, status, assignee, notes, createdBy, timestamp)
         VALUES (?, ?, ?, 'vital', ?, 'open', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [taskId, tenantId, p.id, new Date(Date.now() + (i + 1) * 60 * 1000).toISOString(), assignee, `stress task notes ${i}`, createdBy]
      );
    }
  }

  // Medications + Pharmacy Integration
  for (const t of ['A', 'B']) {
    const p = patients[t];
    const tenantId = t === 'A' ? tenantA : tenantB;
    const prescribedBy = t === 'A' ? doctorA.name : doctorB.name;
    const medId = `stress-med-${t}`;
    
    await dbRun(db, `DELETE FROM MedicationAdministrations WHERE medicationId = ?`, [medId]);
    await dbRun(db, `DELETE FROM Medications WHERE id = ?`, [medId]);
    await dbRun(
      db,
      `INSERT INTO Medications (id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, prescribedBy, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
      [medId, tenantId, p.id, `StressMed-${t}`, '10mg', 'Oral', 'BID', '08:00, 20:00', 0, new Date().toISOString().slice(0, 10), prescribedBy]
    );

    // Pharmacy Item for integration test
    const pharmId = `stress-pharm-${t}`;
    await dbRun(db, `DELETE FROM PharmacyBatches WHERE stockId = ?`, [pharmId]);
    await dbRun(db, `DELETE FROM PharmacyTransactions WHERE medicationId = ?`, [pharmId]);
    await dbRun(db, `DELETE FROM PharmacyStock WHERE id = ?`, [pharmId]);
    await dbRun(
      db,
      `INSERT INTO PharmacyStock (id, tenantId, name, composition, type, category, quantityPerUnit, totalUnits, totalQuantity, unit, itemUnit, costPerUnit, lastUpdated)
       VALUES (?, ?, ?, ?, 'Tablet', 'Analgesics', 10, 100, 1000, 'Strips', 'Tablets', 1.5, CURRENT_TIMESTAMP)`,
      [pharmId, tenantId, `StressMed-${t}`, '10mg']
    );
    // Add batches for each pharmacy item
    for (let bi = 1; bi <= 3; bi++) {
      const batchId = `stress-batch-${t}-${bi}`;
      const expMonth = String(5 + bi).padStart(2, '0');
      await dbRun(db,
        `INSERT INTO PharmacyBatches (id, tenantId, stockId, batchNumber, expiryDate, quantity, costPerUnit, manufacturer, receivedDate, status)
         VALUES (?, ?, ?, ?, ?, ?, 1.5, 'StressPharma', '2026-01-01', 'active')`,
        [batchId, tenantId, pharmId, `STRESS-LOT-${t}${bi}`, `2026-${expMonth}-28`, Math.floor(1000 / 3)]
      );
    }

    const escId = `stress-esc-${t}`;
    await dbRun(db, `DELETE FROM Escalations WHERE id = ?`, [escId]);
    await dbRun(
      db,
      `INSERT INTO Escalations (id, tenantId, patientId, reason, escalatedBy, status, timestamp)
       VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [escId, tenantId, p.id, `Stress escalation ${t}`, prescribedBy]
    );
  }

  await dbRun(db, 'PRAGMA foreign_keys = ON;');

  return {
    users: { A: doctorA, B: doctorB },
    patients,
    tenant: { A: tenantA, B: tenantB }
  };
}

function makeToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
}

function pickWeighted(items) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.fn;
  }
  return items[items.length - 1].fn;
}

async function authedFetch(token, method, endpointPath, body) {
  const url = `${API_BASE}${endpointPath}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function stress() {
  let tokenA;
  let tokenB;
  let patientsA;
  let patientsB;
  let db = null;

  try {
    if (STRESS_SEED_DB) {
      if (await isBackendUp()) {
        throw new Error('Refusing to seed DB while backend is running. Stop server or set STRESS_SEED_DB=0.');
      }

      db = new sqlite3.Database(DB_PATH);
      const fixture = await ensureFixture(db);
      tokenA = makeToken(fixture.users.A);
      tokenB = makeToken(fixture.users.B);

      patientsA = fixture.patients.A;
      patientsB = fixture.patients.B;
    } else {
      patientsA = { id: 'stress-pA' };
      patientsB = { id: 'stress-pB' };

      const doctorA = { id: 'sdA', name: 'StressDocA', role: 'doctor', tenantId: 'tenant-default' };
      const doctorB = { id: 'sdB', name: 'StressDocB', role: 'doctor', tenantId: 'tenant-b' };
      tokenA = makeToken(doctorA);
      tokenB = makeToken(doctorB);
    }

    const opDefs = [
      { weight: 4, fn: () => authedFetch(tokenA, 'GET', '/patients') },
      { weight: 4, fn: () => authedFetch(tokenA, 'GET', `/patients/${patientsA.id}/stats?type=vital`) },
      { weight: 2, fn: () => authedFetch(tokenA, 'GET', `/patients/${patientsA.id}/medications`) },
      { weight: 2, fn: () => authedFetch(tokenA, 'GET', '/tasks/my') },
      { weight: 1, fn: () => authedFetch(tokenA, 'GET', '/api/admin/clinical-changes') },
      
      // Pharmacy specific
      { weight: 4, fn: () => authedFetch(tokenA, 'GET', '/pharmacy/inventory') },
      { weight: 2, fn: () => authedFetch(tokenA, 'GET', '/pharmacy/history') },
      // Batch-specific operations
      { weight: 3, fn: () => authedFetch(tokenA, 'GET', `/pharmacy/inventory/stress-pharm-A/batches`) },
      { weight: 2, fn: () => authedFetch(tokenA, 'GET', `/pharmacy/batches/search?lotNumber=STRESS-LOT-A1`) },

      // Writes + Pharmacy Interop
      {
        weight: 3,
        fn: () =>
          authedFetch(tokenA, 'POST', `/patients/${patientsA.id}/medications/stress-med-A/administer`, {
            status: 'given',
            notes: 'stress test administration',
            timestamp: new Date().toISOString()
          })
      },
      {
        weight: 1,
        fn: () =>
          authedFetch(tokenA, 'POST', `/patients/${patientsA.id}/notes`, {
            shift: 'morning',
            note: 'stress note ' + crypto.randomUUID().slice(0, 8),
            tags: 'stress'
          })
      },

      // Tenant negative
      { weight: 2, fn: () => authedFetch(tokenA, 'GET', `/patients/${patientsB.id}/stats?type=vital`) }
    ];

    const startAt = Date.now();
    const endAt = startAt + DURATION_SEC * 1000;

    let total = 0;
    let ok2xx = 0;
    let forbidden403 = 0;
    let other4xx = 0;
    let server5xx = 0;
    let timeouts = 0;
    let fetchErrors = 0;

    const latenciesMs = [];
    const statusHistogram = new Map();
    const server5xxErrorMessages = new Map();

    const warm = await authedFetch(tokenA, 'GET', `/patients/${patientsA.id}/stats?type=vital`);
    if (warm.status !== 200) console.log('warmup unexpected:', warm.status);
    await sleep(200);

    const worker = async () => {
      while (Date.now() < endAt) {
        const fn = pickWeighted(opDefs);
        const t0 = Date.now();
        try {
          const res = await fn();
          const ms = Date.now() - t0;

          total += 1;
          if (latenciesMs.length < 5000) latenciesMs.push(ms);

          statusHistogram.set(res.status, (statusHistogram.get(res.status) || 0) + 1);

          if (res.status >= 200 && res.status < 400) ok2xx += 1;
          else if (res.status === 403) forbidden403 += 1;
          else if (res.status >= 400 && res.status < 500) other4xx += 1;
          else if (res.status >= 500) {
            server5xx += 1;
            const body = await res.json().catch(() => null);
            const msg = body?.error || body?.message || `HTTP_${res.status}`;
            server5xxErrorMessages.set(msg, (server5xxErrorMessages.get(msg) || 0) + 1);
          }
        } catch (e) {
          total += 1;
          if (e && (e.name === 'AbortError' || String(e).includes('aborted'))) timeouts += 1;
          else fetchErrors += 1;
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    const p95 = (() => {
      if (latenciesMs.length === 0) return null;
      const sorted = [...latenciesMs].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95)];
    })();

    console.log(
      JSON.stringify(
        {
          durationSec: DURATION_SEC,
          concurrency: CONCURRENCY,
          totalRequests: total,
          ok2xxOr3xx: ok2xx,
          forbidden403,
          other4xx,
          server5xx,
          timeouts,
          fetchErrors,
          latencyP95Ms: p95,
          statusHistogram: Object.fromEntries([...statusHistogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
          server5xxErrorMessages: Object.fromEntries([...server5xxErrorMessages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5))
        },
        null,
        2
      )
    );
  } finally {
    if (db) db.close();
  }
}

stress().catch((e) => {
  console.error('stress script failed:', e);
  process.exit(1);
});
