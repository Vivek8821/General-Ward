/**
 * One-time cleanup: removes test/placeholder patients and seeds complete
 * realistic vitals for all 30 clinical patients (p01–p30).
 * Run: node scripts/cleanup_test_patients.js
 */
if (process.env.DB_DIALECT === 'postgres') {
  console.error('This script is SQLite-only.');
  process.exit(1);
}

const crypto = require('crypto');
const db = require('../db-adapter');

const TEST_PATIENT_IDS = [
  'P-1778229636559', // Report Patient
  'tpA', 'tpB',      // Tenant test patients
  'p1', 'p2',        // Overwritten by stress tests
  'hp1', 'hp2',      // History test patients
  'test-patient-guard',
  '338690c6-24a9-41e3-8cef-b1b740ea004a', // Minor Test
  'fede29f1-f6a9-4e1f-8278-dff01251208a', // Adult Test
  '3c4e645a-7f45-4e86-9897-0a4545af7a69', // Child Y
];

// Clinically accurate vitals keyed by patientId.
// Each entry is [pulse, bpSystolic, bpDiastolic, respRate, temp, spo2, levelOfConsciousness]
// Values are tuned to the diagnosis documented in seed.js / the DB.
const VITALS = {
  // p01 John Doe — T2DM, well-controlled
  p01: { pulse: 74, bpSystolic: 138, bpDiastolic: 86, respRate: 16, temp: 36.7, spo2: 97, levelOfConsciousness: 'alert' },
  // p02 Jane Roe — Hypertensive Crisis
  p02: { pulse: 96, bpSystolic: 182, bpDiastolic: 112, respRate: 18, temp: 37.0, spo2: 96, levelOfConsciousness: 'alert' },
  // p03 Robert Smith — Post-Op Hip Replacement Day 3
  p03: { pulse: 88, bpSystolic: 118, bpDiastolic: 74, respRate: 18, temp: 37.6, spo2: 96, levelOfConsciousness: 'alert' },
  // p04 Alice Williams — Acute Bronchitis
  p04: { pulse: 84, bpSystolic: 122, bpDiastolic: 78, respRate: 20, temp: 37.8, spo2: 95, levelOfConsciousness: 'alert' },
  // p05 Michael Brown — Decompensated CHF (EF 25%) — HIGH risk
  p05: { pulse: 121, bpSystolic: 92, bpDiastolic: 62, respRate: 28, temp: 36.9, spo2: 89, levelOfConsciousness: 'alert' },
  // p06 Emily Davis — Post-Laparoscopic Appendicectomy Day 2
  p06: { pulse: 80, bpSystolic: 114, bpDiastolic: 72, respRate: 16, temp: 37.3, spo2: 98, levelOfConsciousness: 'alert' },
  // p07 William Wilson — CAP Right Lower Lobe
  p07: { pulse: 106, bpSystolic: 108, bpDiastolic: 68, respRate: 24, temp: 38.4, spo2: 92, levelOfConsciousness: 'alert' },
  // p08 Sarah Miller — Acute Gastroenteritis, mild dehydration
  p08: { pulse: 98, bpSystolic: 108, bpDiastolic: 70, respRate: 17, temp: 37.5, spo2: 97, levelOfConsciousness: 'alert' },
  // p09 James Taylor — COPD Exacerbation — moderate risk
  p09: { pulse: 92, bpSystolic: 132, bpDiastolic: 80, respRate: 26, temp: 37.2, spo2: 90, levelOfConsciousness: 'alert' },
  // p10 Linda Anderson — Pyelonephritis
  p10: { pulse: 102, bpSystolic: 116, bpDiastolic: 72, respRate: 19, temp: 38.6, spo2: 96, levelOfConsciousness: 'alert' },
  // p11 David Thomas — Dengue Day 4, thrombocytopenic
  p11: { pulse: 94, bpSystolic: 104, bpDiastolic: 66, respRate: 18, temp: 38.9, spo2: 95, levelOfConsciousness: 'alert' },
  // p12 Susan Moore — Chronic Migraine acute exacerbation
  p12: { pulse: 78, bpSystolic: 128, bpDiastolic: 82, respRate: 15, temp: 36.8, spo2: 98, levelOfConsciousness: 'alert' },
  // p13 Charles Jackson — Acute STEMI Post-PCI Day 1 — HIGH risk
  p13: { pulse: 112, bpSystolic: 86, bpDiastolic: 54, respRate: 24, temp: 37.2, spo2: 91, levelOfConsciousness: 'alert' },
  // p14 Patricia White — Acute Ischaemic Stroke Day 2
  p14: { pulse: 88, bpSystolic: 158, bpDiastolic: 94, respRate: 18, temp: 37.4, spo2: 95, levelOfConsciousness: 'voice' },
  // p15 Daniel Harris — Acute Pancreatitis, moderate-severe
  p15: { pulse: 108, bpSystolic: 104, bpDiastolic: 68, respRate: 22, temp: 38.2, spo2: 94, levelOfConsciousness: 'alert' },
  // p16 Nancy Martin — NOF Fracture, pre-op (elderly, pain)
  p16: { pulse: 92, bpSystolic: 144, bpDiastolic: 88, respRate: 20, temp: 37.1, spo2: 95, levelOfConsciousness: 'alert' },
  // p17 Paul Thompson — Acute Severe Asthma
  p17: { pulse: 118, bpSystolic: 126, bpDiastolic: 80, respRate: 30, temp: 37.0, spo2: 91, levelOfConsciousness: 'alert' },
  // p18 Lisa Garcia — Severe Preeclampsia 32 wks — HIGH risk
  p18: { pulse: 96, bpSystolic: 178, bpDiastolic: 116, respRate: 20, temp: 36.9, spo2: 98, levelOfConsciousness: 'alert' },
  // p19 Mark Martinez — CKD Stage 4, anaemia
  p19: { pulse: 82, bpSystolic: 148, bpDiastolic: 92, respRate: 17, temp: 36.8, spo2: 96, levelOfConsciousness: 'alert' },
  // p20 Karen Robinson — Cellulitis right lower leg
  p20: { pulse: 86, bpSystolic: 124, bpDiastolic: 78, respRate: 16, temp: 38.0, spo2: 97, levelOfConsciousness: 'alert' },
  // p21 Steven Clark — Mild TBI GCS 14
  p21: { pulse: 72, bpSystolic: 132, bpDiastolic: 80, respRate: 16, temp: 36.9, spo2: 98, levelOfConsciousness: 'alert' },
  // p22 Betty Rodriguez — Acute Confusional State (Dehydration + UTI + Dementia background)
  p22: { pulse: 104, bpSystolic: 100, bpDiastolic: 62, respRate: 20, temp: 38.3, spo2: 94, levelOfConsciousness: 'voice' },
  // p23 George Lewis — PUD with Upper GI Bleed (haemostasis achieved)
  p23: { pulse: 106, bpSystolic: 96, bpDiastolic: 60, respRate: 20, temp: 37.1, spo2: 95, levelOfConsciousness: 'alert' },
  // p24 Sandra Lee — Thyroid Storm (BWS 65) — HIGH risk
  p24: { pulse: 148, bpSystolic: 164, bpDiastolic: 90, respRate: 28, temp: 39.8, spo2: 92, levelOfConsciousness: 'alert' },
  // p25 Kenneth Walker — Infective Endocarditis (Streptococcal)
  p25: { pulse: 96, bpSystolic: 106, bpDiastolic: 66, respRate: 20, temp: 38.8, spo2: 94, levelOfConsciousness: 'alert' },
  // p26 Helen Hall — RA Acute Flare
  p26: { pulse: 84, bpSystolic: 128, bpDiastolic: 80, respRate: 16, temp: 37.6, spo2: 97, levelOfConsciousness: 'alert' },
  // p27 Edward Allen — Sickle Cell Vaso-occlusive Crisis
  p27: { pulse: 110, bpSystolic: 118, bpDiastolic: 74, respRate: 22, temp: 38.2, spo2: 93, levelOfConsciousness: 'alert' },
  // p28 Dorothy Young — Complete Heart Block — HIGH risk
  p28: { pulse: 37, bpSystolic: 84, bpDiastolic: 50, respRate: 18, temp: 36.8, spo2: 90, levelOfConsciousness: 'alert' },
  // p29 Brian King — Decompensated Liver Cirrhosis Child-Pugh C
  p29: { pulse: 102, bpSystolic: 96, bpDiastolic: 60, respRate: 22, temp: 37.8, spo2: 94, levelOfConsciousness: 'alert' },
  // p30 Carol Wright — SLE Lupus Nephritis Class III Flare
  p30: { pulse: 90, bpSystolic: 156, bpDiastolic: 98, respRate: 18, temp: 37.9, spo2: 96, levelOfConsciousness: 'alert' },
};

async function run() {
  const ph = TEST_PATIENT_IDS.map(() => '?').join(',');

  // Delete child rows referencing test patients (FK order matters)
  // 1. MedicationAdministrations → Medications → Patients
  const medRows = await db.all(`SELECT id FROM Medications WHERE patientId IN (${ph})`, TEST_PATIENT_IDS);
  if (medRows.length) {
    const medPh = medRows.map(() => '?').join(',');
    const medIds = medRows.map(r => r.id);
    await db.run(`DELETE FROM MedicationAdministrations WHERE medicationId IN (${medPh})`, medIds);
  }
  // 2. Direct patientId children
  const childTables = [
    'DailyStats', 'Medications', 'Tasks', 'HandoverNotes',
    'Escalations', 'PatientReports', 'HospitalArchives',
    'DischargeSummaries', 'DpdpaCorrectionRequests', 'DpdpaDataSharingLog',
  ];
  for (const table of childTables) {
    try {
      await db.run(`DELETE FROM ${table} WHERE patientId IN (${ph})`, TEST_PATIENT_IDS);
    } catch { /* column may not exist on some tables */ }
  }

  await db.run(`DELETE FROM Patients WHERE id IN (${ph})`, TEST_PATIENT_IDS);
  console.log(`Deleted ${TEST_PATIENT_IDS.length} test patients and related data.`);

  // Upsert fresh vitals for each real patient
  // Delete old vitals first so we don't accumulate duplicates
  const realIds = Object.keys(VITALS);
  const realPh = realIds.map(() => '?').join(',');
  await db.run(`DELETE FROM DailyStats WHERE type='vital' AND patientId IN (${realPh})`, realIds);

  const now = Date.now();
  for (const [patientId, v] of Object.entries(VITALS)) {
    // Two readings — most recent ~2 hours apart to simulate a ward round
    for (let i = 0; i < 2; i++) {
      const jitter = (Math.random() - 0.5) * 4;
      const reading = {
        pulse: Math.round(v.pulse + jitter),
        bpSystolic: Math.round(v.bpSystolic + jitter),
        bpDiastolic: Math.round(v.bpDiastolic + (jitter / 2)),
        respRate: Math.round(v.respRate + (Math.random() - 0.5)),
        temp: parseFloat((v.temp + (Math.random() - 0.5) * 0.2).toFixed(1)),
        spo2: Math.max(85, Math.round(v.spo2 + (Math.random() - 0.5))),
        levelOfConsciousness: v.levelOfConsciousness,
      };
      const ts = new Date(now - (i === 0 ? 7200000 : 14400000)).toISOString();
      await db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, 'tenant-default', ?, 'vital', ?, 'System Seed', ?)`,
        [crypto.randomUUID(), patientId, JSON.stringify(reading), ts]
      );
    }
    console.log(`  ✓ ${patientId}`);
  }

  console.log('\nDone. 30 patients with fresh, clinically accurate vitals.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
