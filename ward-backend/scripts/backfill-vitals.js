/**
 * Backfill 7-day vitals for all 30 seeded patients.
 * Uses INSERT OR IGNORE — safe to re-run.
 */
const sqlite3 = require('sqlite3').verbose();
const crypto  = require('crypto');
const path    = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'ward.db');
const db = new sqlite3.Database(DB_PATH);
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, err => err ? rej(err) : res()));

const TENANT = 'tenant-default';
const TODAY  = new Date().toISOString().slice(0, 10);

const stableId = (...parts) => {
  const h = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
};

const ts = (dateStr, hour) =>
  `${dateStr}T${String(hour).padStart(2,'0')}:00:00.000Z`;

const jitter = (v, d, lo, hi) => Math.min(hi, Math.max(lo, v + (Math.random() * 2 - 1) * d));

const makeVital = (vb) => {
  const r = {
    bpSystolic:  Math.round(jitter(vb.bpSystolic,  7, 50, 260)),
    bpDiastolic: Math.round(jitter(vb.bpDiastolic, 7, 30, 150)),
    pulse:       Math.round(jitter(vb.pulse,        9, 20, 250)),
    temp:        +jitter(vb.temp, 0.3, 35, 42).toFixed(1),
  };
  if (vb.respRate != null) r.respRate = Math.round(jitter(vb.respRate, 3, 4, 60));
  if (vb.spo2    != null) r.spo2     = Math.min(100, Math.round(jitter(vb.spo2, 2, 50, 100)));
  return r;
};

// 7 days ending today
const last7days = () => {
  const snapshot = new Date(TODAY + 'T00:00:00Z');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(snapshot);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

const VITAL_SCHEDULE = {
  1: [6, 14, 22],
  2: [6, 10, 14, 18],
  3: [6, 10, 14, 18, 22],
  4: [2, 6, 10, 14, 18, 22],
};

const PATIENTS = [
  { id:'p01', ci:2, vitals:{ pulse:78,  bpSystolic:128, bpDiastolic:82,  respRate:16, temp:36.8, spo2:97 } },
  { id:'p02', ci:2, vitals:{ pulse:88,  bpSystolic:182, bpDiastolic:112, respRate:16, temp:36.5, spo2:98 } },
  { id:'p03', ci:3, vitals:{ pulse:88,  bpSystolic:118, bpDiastolic:76,  respRate:18, temp:37.4, spo2:96 } },
  { id:'p04', ci:2, vitals:{ pulse:84,  bpSystolic:122, bpDiastolic:78,  respRate:20, temp:37.9, spo2:95 } },
  { id:'p05', ci:4, vitals:{ pulse:118, bpSystolic:92,  bpDiastolic:58,  respRate:28, temp:36.9, spo2:89 } },
  { id:'p06', ci:2, vitals:{ pulse:82,  bpSystolic:114, bpDiastolic:72,  respRate:16, temp:37.5, spo2:97 } },
  { id:'p07', ci:3, vitals:{ pulse:104, bpSystolic:106, bpDiastolic:68,  respRate:24, temp:38.6, spo2:92 } },
  { id:'p08', ci:1, vitals:{ pulse:96,  bpSystolic:102, bpDiastolic:64,  respRate:18, temp:37.7, spo2:98 } },
  { id:'p09', ci:3, vitals:{ pulse:92,  bpSystolic:138, bpDiastolic:86,  respRate:26, temp:37.2, spo2:88 } },
  { id:'p10', ci:2, vitals:{ pulse:86,  bpSystolic:126, bpDiastolic:80,  respRate:16, temp:38.3, spo2:98 } },
  { id:'p11', ci:3, vitals:{ pulse:108, bpSystolic:100, bpDiastolic:62,  respRate:18, temp:39.1, spo2:97 } },
  { id:'p12', ci:1, vitals:{ pulse:74,  bpSystolic:116, bpDiastolic:74,  respRate:14, temp:36.6, spo2:99 } },
  { id:'p13', ci:4, vitals:{ pulse:118, bpSystolic:88,  bpDiastolic:54,  respRate:22, temp:37.1, spo2:91 } },
  { id:'p14', ci:3, vitals:{ pulse:76,  bpSystolic:172, bpDiastolic:104, respRate:16, temp:37.0, spo2:96 } },
  { id:'p15', ci:3, vitals:{ pulse:108, bpSystolic:104, bpDiastolic:66,  respRate:20, temp:38.3, spo2:95 } },
  { id:'p16', ci:2, vitals:{ pulse:82,  bpSystolic:136, bpDiastolic:84,  respRate:16, temp:36.7, spo2:97 } },
  { id:'p17', ci:3, vitals:{ pulse:112, bpSystolic:122, bpDiastolic:78,  respRate:28, temp:37.0, spo2:90 } },
  { id:'p18', ci:4, vitals:{ pulse:98,  bpSystolic:172, bpDiastolic:112, respRate:18, temp:37.1, spo2:98 } },
  { id:'p19', ci:2, vitals:{ pulse:78,  bpSystolic:152, bpDiastolic:94,  respRate:16, temp:36.7, spo2:97 } },
  { id:'p20', ci:2, vitals:{ pulse:86,  bpSystolic:128, bpDiastolic:80,  respRate:16, temp:38.6, spo2:97 } },
  { id:'p21', ci:2, vitals:{ pulse:68,  bpSystolic:144, bpDiastolic:88,  respRate:14, temp:37.2, spo2:98 } },
  { id:'p22', ci:3, vitals:{ pulse:116, bpSystolic:96,  bpDiastolic:58,  respRate:20, temp:38.0, spo2:95 } },
  { id:'p23', ci:3, vitals:{ pulse:110, bpSystolic:98,  bpDiastolic:62,  respRate:18, temp:37.0, spo2:96 } },
  { id:'p24', ci:4, vitals:{ pulse:148, bpSystolic:164, bpDiastolic:96,  respRate:26, temp:39.9, spo2:93 } },
  { id:'p25', ci:3, vitals:{ pulse:104, bpSystolic:106, bpDiastolic:66,  respRate:18, temp:38.9, spo2:95 } },
  { id:'p26', ci:2, vitals:{ pulse:80,  bpSystolic:130, bpDiastolic:84,  respRate:16, temp:37.9, spo2:98 } },
  { id:'p27', ci:3, vitals:{ pulse:108, bpSystolic:116, bpDiastolic:74,  respRate:22, temp:38.5, spo2:93 } },
  { id:'p28', ci:4, vitals:{ pulse:36,  bpSystolic:82,  bpDiastolic:50,  respRate:18, temp:36.8, spo2:90 } },
  { id:'p29', ci:3, vitals:{ pulse:96,  bpSystolic:98,  bpDiastolic:62,  respRate:18, temp:37.7, spo2:95 } },
  { id:'p30', ci:2, vitals:{ pulse:88,  bpSystolic:142, bpDiastolic:90,  respRate:16, temp:38.1, spo2:97 } },
];

(async () => {
  const days = last7days();
  const nurses = ['Nurse Joy', 'Nurse Riya'];
  let inserted = 0;

  for (const p of PATIENTS) {
    const hours = VITAL_SCHEDULE[p.ci] || VITAL_SCHEDULE[2];
    for (const day of days) {
      for (const h of hours) {
        const stamp = ts(day, h);
        const id = stableId(p.id, 'vital-backfill7d', stamp);
        const nurse = nurses[h % 2];
        await run(
          'INSERT OR IGNORE INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
          [id, TENANT, p.id, 'vital', JSON.stringify(makeVital(p.vitals)), nurse, stamp]
        );
        inserted++;
      }
    }
  }

  // Count what's now in each window
  const cutoff24  = new Date(Date.now() - 24  * 3600000).toISOString();
  const cutoff48  = new Date(Date.now() - 48  * 3600000).toISOString();
  const cutoff7d  = new Date(Date.now() - 168 * 3600000).toISOString();
  const q = (cutoff) => new Promise((res, rej) =>
    db.get('SELECT COUNT(*) as cnt FROM DailyStats WHERE type=? AND timestamp>=?', ['vital', cutoff], (err, row) => err ? rej(err) : res(row.cnt)));

  const [c24, c48, c7d] = await Promise.all([q(cutoff24), q(cutoff48), q(cutoff7d)]);
  console.log(`Processed ${inserted} slots (INSERT OR IGNORE — duplicates skipped)`);
  console.log(`Vitals in DB: 24h = ${c24} | 48h = ${c48} | 7d = ${c7d}`);
  db.close();
})().catch(e => { console.error(e); process.exit(1); });
