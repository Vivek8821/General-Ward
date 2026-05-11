'use strict';
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'ward.db'));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, e => e ? rej(e) : res()));
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const uid = () => crypto.randomUUID();
const TENANT = 'tenant-default';
const d0 = '2026-05-08';
const d1 = '2026-05-09';

// ── Procedure templates ──────────────────────────────────────────────────────
const PROCEDURES = {
  metabolic:       [{ name: 'IV Cannula Insertion (18G, right antecubital)', by: 'Nurse J. Patel',   outcome: 'Patent, no extravasation. Secured and flushed.' },
                    { name: 'CBG Monitoring (6-hourly)', by: 'Nurse J. Patel',                        outcome: 'Ongoing. Values trending towards target range.' }],
  cardiovascular:  [{ name: 'IV Cannula Insertion (16G, left antecubital)', by: 'Nurse J. Patel',    outcome: 'Patent. IV fluids and medications commenced.' },
                    { name: '12-Lead ECG', by: 'Dr. A. Sharma',                                       outcome: 'Completed. Reviewed by cardiology team.' }],
  surgical:        [{ name: 'Wound Assessment and Dressing Change', by: 'Nurse J. Patel',             outcome: 'Wound clean and dry. No signs of infection. Primary dressing re-applied.' },
                    { name: 'Urinary Catheter Removal', by: 'Nurse J. Patel',                         outcome: 'Catheter removed Day 1 post-op. Patient voided spontaneously within 4 hours.' }],
  respiratory:     [{ name: 'IV Cannula Insertion and IV Antibiotics Commenced', by: 'Nurse J. Patel', outcome: 'First dose administered without adverse reaction.' },
                    { name: 'Nebulised Salbutamol (2.5 mg) + Ipratropium (0.5 mg)', by: 'Nurse J. Patel', outcome: 'SpO2 improved from 91% to 96%. Respiratory rate reduced.' }],
  gastrointestinal:[{ name: 'Nasogastric Tube Insertion (for bowel rest / decompression)', by: 'Dr. A. Sharma', outcome: 'NGT in situ, position confirmed on CXR. Aspirating bile-stained fluid.' },
                    { name: 'IV Fluid Resuscitation (Normal Saline 1L over 2 hours)', by: 'Nurse J. Patel', outcome: 'Haemodynamics stable post-resuscitation.' }],
  infectious:      [{ name: 'Blood Cultures (2 sets, peripheral)', by: 'Dr. A. Sharma',               outcome: 'Sent to microbiology. Antibiotics commenced after collection.' },
                    { name: 'IV Cannula Insertion and IV Antibiotics', by: 'Nurse J. Patel',           outcome: 'IV Ceftriaxone commenced. No adverse reactions.' }],
  neurological:    [{ name: 'IV Access and IV Fluids Commenced', by: 'Nurse J. Patel',                outcome: 'Patent. Normal saline commenced for hydration.' },
                    { name: 'Neurological Observations (GCS, pupils, limb power — 1-hourly)', by: 'Nurse J. Patel', outcome: 'Ongoing. GCS stable at 14–15.' }],
  haematology:     [{ name: 'Packed Red Cell Transfusion (2 units)', by: 'Dr. A. Sharma',             outcome: 'Transfusion completed without adverse reaction. Post-transfusion Hb 9.2 g/dL.' },
                    { name: 'IV Morphine PCA Setup', by: 'Nurse J. Patel',                            outcome: 'PCA initiated. Pain score reduced from 8/10 to 3/10 within 2 hours.' }],
  obstetric:       [{ name: 'Foetal Cardiotocography (CTG) Monitoring', by: 'Nurse J. Patel',         outcome: 'Reactive trace. Foetal heart rate 148 bpm with good variability.' },
                    { name: 'IV Magnesium Sulphate (Eclampsia prophylaxis)', by: 'Dr. A. Sharma',     outcome: 'Loading dose administered. Maintenance infusion in progress. Reflexes checked hourly.' }],
  renal:           [{ name: 'IV Iron Infusion (Ferinject 500 mg in 100 mL NS)', by: 'Nurse J. Patel', outcome: 'Infused over 15 minutes. No adverse reaction. Repeat Hb in 4 weeks.' },
                    { name: 'IV Cannula Insertion and Fluid Balance Monitoring', by: 'Nurse J. Patel', outcome: 'Strict fluid balance chart commenced. Input/output 4-hourly.' }],
  musculoskeletal: [{ name: 'Affected Joint Aspiration (Right Knee, 12 mL synovial fluid)', by: 'Dr. A. Sharma', outcome: 'Fluid sent for culture, crystals, and cell count. Inflammatory fluid confirmed.' },
                    { name: 'IV Methylprednisolone (500 mg) Infusion', by: 'Nurse J. Patel',          outcome: 'Infused over 30 minutes. Significant improvement in joint pain within 24 hours.' }],
};

// ── Clinical Team templates ──────────────────────────────────────────────────
const CONSULTANTS = {
  metabolic:       { specialty: 'Endocrinology',   name: 'Dr. P. Krishnan', reg: 'MCI-88421', qual: 'MD, DM (Endocrinology)', remark: 'Insulin adjustment and diabetic education plan initiated. HbA1c recheck in 3 months.' },
  cardiovascular:  { specialty: 'Cardiology',      name: 'Dr. S. Iyer',     reg: 'MCI-74120', qual: 'MD, DM (Cardiology)',     remark: 'Echocardiogram reviewed. Heart failure regimen optimised. BNP trending down.' },
  surgical:        { specialty: 'Orthopaedics',    name: 'Dr. V. Bhatt',    reg: 'MCI-64820', qual: 'MS (Orthopaedics)',       remark: 'Post-operative recovery satisfactory. Physiotherapy and mobilisation initiated. DVT prophylaxis ongoing.' },
  respiratory:     { specialty: 'Pulmonology',     name: 'Dr. K. Mehta',    reg: 'MCI-72341', qual: 'MD, DM (Pulmonology)',    remark: 'Spirometry reviewed. Antibiotic and bronchodilator regimen appropriate. Plan for discharge when SpO2 >94% on room air.' },
  gastrointestinal:{ specialty: 'Gastroenterology',name: 'Dr. R. Agarwal',  reg: 'MCI-66142', qual: 'MD, DM (Gastroenterology)', remark: 'ERCP planned if stones persist. Conservative management with bowel rest and IV fluids for now.' },
  infectious:      { specialty: 'Infectious Disease',name: 'Dr. N. Joshi',  reg: 'MCI-71824', qual: 'MD (Infectious Diseases)', remark: 'Blood and urine cultures reviewed. Antibiotic sensitivity pending. Empirical therapy appropriate.' },
  neurological:    { specialty: 'Neurology',       name: 'Dr. T. Kapoor',   reg: 'MCI-68244', qual: 'MD, DM (Neurology)',      remark: 'Neuro-imaging reviewed. Stroke pathway activated. Antiplatelets and statin commenced.' },
  haematology:     { specialty: 'Haematology',     name: 'Dr. B. Menon',    reg: 'MCI-61824', qual: 'MD, DM (Haematology)',    remark: 'Transfusion threshold met. Hydroxyurea dosing reviewed. Pain management with PCA ongoing.' },
  obstetric:       { specialty: 'Obstetrics & Gynaecology', name: 'Dr. P. Nair', reg: 'MCI-70124', qual: 'MD, DNB (OBG)', remark: 'Foetal wellbeing confirmed. Steroids given for lung maturity. Delivery planning at 34 weeks if no improvement.' },
  renal:           { specialty: 'Nephrology',      name: 'Dr. A. Pillai',   reg: 'MCI-67241', qual: 'MD, DM (Nephrology)',     remark: 'CKD stage 4. Anaemia of CKD — IV iron and ESA therapy initiated. Dietary counselling arranged.' },
  musculoskeletal: { specialty: 'Rheumatology',    name: 'Dr. G. Rao',      reg: 'MCI-73420', qual: 'MD, DM (Rheumatology)',   remark: 'RA with active flare. Joint aspiration performed. Disease-modifying therapy to be escalated post-acute phase.' },
};

// ── Toxicology screen data (only for clinically indicated patients) ────────────
const TOXICOLOGY_PATIENTS = {
  p21: { bac: 'Negative', drugScreen: 'Positive: Cannabis (THC metabolites)', poisonScreen: 'Negative', heavyMetals: 'Not requested', notes: 'Trauma patient — tox screen done per protocol' },
  p22: { bac: 'Negative', drugScreen: 'Negative',                             poisonScreen: 'Negative', heavyMetals: 'Not requested', notes: 'ACS secondary to dehydration; no toxic cause identified' },
  p23: { bac: 'Positive (48 mg/100 mL)', drugScreen: 'Negative',             poisonScreen: 'Negative', heavyMetals: 'Not requested', notes: 'GI bleed; alcohol consumption a contributing factor' },
  p24: { bac: 'Negative', drugScreen: 'Negative',                             poisonScreen: 'Negative', heavyMetals: 'Selenium: elevated (possible supplement excess)', notes: 'Thyroid storm — iodine-containing supplement use queried' },
  p27: { bac: 'Negative', drugScreen: 'Negative',                             poisonScreen: 'Negative', heavyMetals: 'Not requested', notes: 'SCD crisis — no toxic precipitant identified' },
  p29: { bac: 'Positive (22 mg/100 mL)', drugScreen: 'Negative',             poisonScreen: 'Negative', heavyMetals: 'Copper: elevated (Wilson\'s excluded previously)', notes: 'Cirrhosis decompensation; ongoing alcohol use' },
};

async function seed() {
  const tables = ['ClinicalProcedures', 'ClinicalTeam', 'ToxicologyScreens'];
  const before = {};
  for (const t of tables) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    before[t] = r.cnt;
  }

  await run('DELETE FROM ClinicalProcedures');
  await run('DELETE FROM ClinicalTeam');
  await run('DELETE FROM ToxicologyScreens');

  const grpMap = {
    p01:'metabolic', p02:'cardiovascular', p03:'surgical', p04:'respiratory',
    p05:'cardiovascular', p06:'surgical', p07:'respiratory', p08:'gastrointestinal',
    p09:'respiratory', p10:'infectious', p11:'haematology', p12:'neurological',
    p13:'cardiovascular', p14:'neurological', p15:'gastrointestinal', p16:'surgical',
    p17:'respiratory', p18:'obstetric', p19:'renal', p20:'infectious',
    p21:'neurological', p22:'neurological', p23:'gastrointestinal', p24:'metabolic',
    p25:'cardiovascular', p26:'musculoskeletal', p27:'haematology', p28:'cardiovascular',
    p29:'gastrointestinal', p30:'haematology',
  };

  const allIds = Object.keys(grpMap);

  for (const pid of allIds) {
    const grp = grpMap[pid];
    const procs = PROCEDURES[grp] || PROCEDURES.infectious;
    for (const proc of procs) {
      await run(
        `INSERT INTO ClinicalProcedures (id, patientId, tenantId, procedureDate, procedureName, performedBy, outcome)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), pid, TENANT, d0, proc.name, proc.by, proc.outcome]
      );
    }

    // Clinical Team: Consultant Physician (always) + Specialty Consultant + Registrar
    const cons = CONSULTANTS[grp] || CONSULTANTS.infectious;

    await run(
      `INSERT INTO ClinicalTeam (id, patientId, tenantId, role, name, registrationNo, qualification, clinicalRemarks, remarksDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), pid, TENANT, 'Consultant Physician', 'Dr. A. Sharma', 'MCI-52180', 'MD (General Medicine)', 'Patient reviewed. Management plan in place. Daily review ongoing.', d0]
    );

    await run(
      `INSERT INTO ClinicalTeam (id, patientId, tenantId, role, name, registrationNo, qualification, clinicalRemarks, remarksDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), pid, TENANT, `Specialist Consultant (${cons.specialty})`, cons.name, cons.reg, cons.qual, cons.remark, d1]
    );

    await run(
      `INSERT INTO ClinicalTeam (id, patientId, tenantId, role, name, registrationNo, qualification, clinicalRemarks, remarksDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), pid, TENANT, 'Medical Registrar', 'Dr. M. Desai', 'MCI-80124', 'MBBS, MD (In Training)', 'Daily ward rounds completed. Noted and acted upon all changes. Escalation pathways followed.', d0]
    );
  }

  // ToxicologyScreens (selected patients only)
  for (const [pid, tox] of Object.entries(TOXICOLOGY_PATIENTS)) {
    await run(
      `INSERT INTO ToxicologyScreens (id, patientId, tenantId, screenDate, bac, drugScreen, poisonScreen, heavyMetals, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), pid, TENANT, d0, tox.bac, tox.drugScreen, tox.poisonScreen, tox.heavyMetals, 'Dr. A. Sharma']
    );
  }

  const after = {};
  for (const t of tables) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    after[t] = r.cnt;
  }

  console.log('\n✓ seed_clinical_part3 complete');
  console.log('Table                   Before  After');
  for (const t of tables) {
    console.log(`  ${t.padEnd(22)} ${String(before[t]).padStart(5)}  ${String(after[t]).padStart(5)}`);
  }
  db.close();
}

seed().catch(e => { console.error(e); db.close(); process.exit(1); });
