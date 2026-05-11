'use strict';
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'ward.db'));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, e => e ? rej(e) : res()));
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const uid = () => crypto.randomUUID();
const TENANT = 'tenant-default';
const DOCTOR = 'Dr. A. Sharma';
const d0 = '2026-05-08'; // admission day
const d1 = '2026-05-09'; // day 2
const d2 = '2026-05-10'; // day 3

const PATIENTS = [
  { id: 'p01', grp: 'metabolic'      },
  { id: 'p02', grp: 'cardiovascular' },
  { id: 'p03', grp: 'surgical'       },
  { id: 'p04', grp: 'respiratory'    },
  { id: 'p05', grp: 'cardiovascular' },
  { id: 'p06', grp: 'surgical'       },
  { id: 'p07', grp: 'respiratory'    },
  { id: 'p08', grp: 'gastrointestinal'},
  { id: 'p09', grp: 'respiratory'    },
  { id: 'p10', grp: 'infectious'     },
  { id: 'p11', grp: 'haematology'    },
  { id: 'p12', grp: 'neurological'   },
  { id: 'p13', grp: 'cardiovascular' },
  { id: 'p14', grp: 'neurological'   },
  { id: 'p15', grp: 'gastrointestinal'},
  { id: 'p16', grp: 'surgical'       },
  { id: 'p17', grp: 'respiratory'    },
  { id: 'p18', grp: 'obstetric'      },
  { id: 'p19', grp: 'renal'          },
  { id: 'p20', grp: 'infectious'     },
  { id: 'p21', grp: 'neurological'   },
  { id: 'p22', grp: 'neurological'   },
  { id: 'p23', grp: 'gastrointestinal'},
  { id: 'p24', grp: 'metabolic'      },
  { id: 'p25', grp: 'cardiovascular' },
  { id: 'p26', grp: 'musculoskeletal'},
  { id: 'p27', grp: 'haematology'    },
  { id: 'p28', grp: 'cardiovascular' },
  { id: 'p29', grp: 'gastrointestinal'},
  { id: 'p30', grp: 'haematology'    },
];

// ── Lab result templates (admission + follow-up) ─────────────────────────────
const LAB_TEMPLATES = {
  metabolic: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '13.2 g/dL', WBC: '8.4 x10⁹/L', Platelets: '210 x10⁹/L' }, metabolic: { FastingGlucose: '14.8 mmol/L', HbA1c: '9.2%', Urea: '6.1 mmol/L', Creatinine: '88 µmol/L', eGFR: '>60' }, LFTs: { ALT: '32 U/L', ALP: '78 U/L', Albumin: '38 g/L' } } },
    { date: d1, label: 'Day 2',     results: { metabolic: { FastingGlucose: '9.4 mmol/L', RandGlucose: '11.2 mmol/L' }, electrolytes: { Na: '138 mmol/L', K: '4.1 mmol/L', Cl: '102 mmol/L' } } },
  ],
  cardiovascular: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '12.8 g/dL', WBC: '10.2 x10⁹/L', Platelets: '198 x10⁹/L' }, cardiac: { Troponin_I: '2.4 ng/mL', BNP: '1840 pg/mL', CK_MB: '88 U/L' }, metabolic: { Glucose: '7.8 mmol/L', Creatinine: '102 µmol/L' }, electrolytes: { Na: '136 mmol/L', K: '3.8 mmol/L' } } },
    { date: d1, label: 'Day 2',     results: { cardiac: { Troponin_I: '1.1 ng/mL', BNP: '1220 pg/mL' }, electrolytes: { Na: '138 mmol/L', K: '4.0 mmol/L' }, coagulation: { INR: '1.2', APTT: '30 sec' } } },
  ],
  surgical: [
    { date: d0, label: 'Pre/Post-Op', results: { CBC: { Hb: '11.4 g/dL', WBC: '12.6 x10⁹/L', Platelets: '240 x10⁹/L' }, inflammation: { CRP: '88 mg/L', ESR: '42 mm/hr' }, coagulation: { INR: '1.1', APTT: '28 sec' }, metabolic: { Glucose: '6.2 mmol/L', Creatinine: '76 µmol/L' } } },
    { date: d2, label: 'Day 3',       results: { CBC: { Hb: '10.8 g/dL', WBC: '9.2 x10⁹/L' }, inflammation: { CRP: '44 mg/L' }, metabolic: { Albumin: '32 g/L' } } },
  ],
  respiratory: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '13.6 g/dL', WBC: '15.8 x10⁹/L', Neutrophils: '12.4 x10⁹/L', Platelets: '320 x10⁹/L' }, inflammation: { CRP: '124 mg/L', Procalcitonin: '1.8 ng/mL' }, ABG: { pH: '7.38', pO2: '8.2 kPa', pCO2: '5.8 kPa', HCO3: '24 mmol/L' }, metabolic: { Creatinine: '82 µmol/L' } } },
    { date: d1, label: 'Day 2',     results: { CBC: { WBC: '11.4 x10⁹/L', Neutrophils: '8.2 x10⁹/L' }, inflammation: { CRP: '76 mg/L' }, ABG: { pH: '7.41', pO2: '10.1 kPa', pCO2: '5.4 kPa' } } },
  ],
  gastrointestinal: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '10.2 g/dL', WBC: '14.6 x10⁹/L', Platelets: '188 x10⁹/L' }, LFTs: { ALT: '220 U/L', ALP: '310 U/L', Bilirubin: '48 µmol/L', Albumin: '28 g/L', GGT: '188 U/L' }, lipase: { Lipase: '1840 U/L', Amylase: '640 U/L' }, metabolic: { Glucose: '9.2 mmol/L', Creatinine: '110 µmol/L', Calcium: '1.9 mmol/L' } } },
    { date: d1, label: 'Day 2',     results: { LFTs: { Bilirubin: '34 µmol/L', Albumin: '30 g/L' }, lipase: { Lipase: '920 U/L' }, inflammation: { CRP: '188 mg/L' } } },
  ],
  infectious: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '11.8 g/dL', WBC: '18.4 x10⁹/L', Neutrophils: '15.2 x10⁹/L', Platelets: '142 x10⁹/L' }, inflammation: { CRP: '188 mg/L', Procalcitonin: '4.2 ng/mL' }, metabolic: { Creatinine: '128 µmol/L', Urea: '9.4 mmol/L' }, urinalysis: { Nitrites: 'Positive', WBC: '>100 cells/hpf', RBC: '10–25 cells/hpf' } } },
    { date: d1, label: 'Day 2',     results: { CBC: { WBC: '13.2 x10⁹/L' }, inflammation: { CRP: '122 mg/L' }, metabolic: { Creatinine: '108 µmol/L' } } },
  ],
  neurological: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '13.8 g/dL', WBC: '9.6 x10⁹/L', Platelets: '224 x10⁹/L' }, metabolic: { Glucose: '6.4 mmol/L', Creatinine: '78 µmol/L', Na: '136 mmol/L' }, coagulation: { INR: '1.1', APTT: '29 sec' }, lipids: { TotalCholesterol: '5.8 mmol/L', LDL: '3.8 mmol/L' } } },
    { date: d1, label: 'Day 2',     results: { CBC: { WBC: '9.2 x10⁹/L' }, metabolic: { Na: '138 mmol/L', Glucose: '5.9 mmol/L' } } },
  ],
  haematology: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '7.2 g/dL', WBC: '12.8 x10⁹/L', Platelets: '68 x10⁹/L', Reticulocytes: '8.2%', MCV: '88 fL' }, haematology: { LDH: '880 U/L', Haptoglobin: 'Undetectable', DirectCoombs: 'Negative', Bilirubin_indirect: '62 µmol/L' }, metabolic: { Creatinine: '92 µmol/L' } } },
    { date: d1, label: 'Day 2',     results: { CBC: { Hb: '7.8 g/dL', Platelets: '82 x10⁹/L', Reticulocytes: '6.4%' }, haematology: { LDH: '620 U/L' } } },
  ],
  obstetric: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '10.4 g/dL', WBC: '13.2 x10⁹/L', Platelets: '98 x10⁹/L' }, metabolic: { Creatinine: '88 µmol/L', Urea: '5.2 mmol/L', Uric_acid: '480 µmol/L' }, LFTs: { ALT: '88 U/L', ALP: '210 U/L', Albumin: '29 g/L' }, urinalysis: { Protein: '3+ (spot PCR 480 mg/mmol)' } } },
    { date: d1, label: 'Day 2',     results: { CBC: { Platelets: '88 x10⁹/L' }, metabolic: { Creatinine: '92 µmol/L' }, LFTs: { ALT: '102 U/L' } } },
  ],
  renal: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '8.2 g/dL', WBC: '8.4 x10⁹/L', Platelets: '188 x10⁹/L', MCV: '82 fL' }, renal: { Creatinine: '388 µmol/L', Urea: '22.4 mmol/L', eGFR: '14 mL/min/1.73m²' }, electrolytes: { Na: '136 mmol/L', K: '5.8 mmol/L', Phosphate: '1.88 mmol/L', Calcium: '2.0 mmol/L' }, iron: { Ferritin: '12 ng/mL', Transferrin_Sat: '14%' } } },
    { date: d1, label: 'Day 2',     results: { renal: { Creatinine: '366 µmol/L', Urea: '19.8 mmol/L' }, electrolytes: { K: '5.4 mmol/L' } } },
  ],
  musculoskeletal: [
    { date: d0, label: 'Admission', results: { CBC: { Hb: '10.8 g/dL', WBC: '14.2 x10⁹/L', Platelets: '388 x10⁹/L' }, inflammation: { CRP: '148 mg/L', ESR: '88 mm/hr', RF: '240 IU/mL (Positive)', Anti_CCP: 'Positive (>340 U/mL)' }, metabolic: { Creatinine: '74 µmol/L', Uric_acid: '288 µmol/L' } } },
    { date: d1, label: 'Day 2',     results: { inflammation: { CRP: '96 mg/L', ESR: '68 mm/hr' }, CBC: { WBC: '11.8 x10⁹/L' } } },
  ],
};

// ── Imaging templates ────────────────────────────────────────────────────────
const IMAGING_TEMPLATES = {
  metabolic: [
    { modality: 'xray',       date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'No acute cardiopulmonary abnormality. Heart size normal. No bony lesions.', impression: 'Normal chest X-ray.' },
    { modality: 'usg',        date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Mild hepatomegaly with increased echogenicity consistent with fatty infiltration. Kidneys normal size and echotexture. No hydronephrosis. Gallbladder normal.', impression: 'Hepatic steatosis. No acute abdominal pathology.' },
  ],
  cardiovascular: [
    { modality: 'ecg',        date: d0, reportedBy: 'Dr. S. Iyer (Cardiology)', findings: 'Sinus tachycardia, rate 102 bpm. Left ventricular hypertrophy by voltage criteria. ST depression in leads V4–V6. QTc 420 ms.', impression: 'LVH with lateral ST changes. No acute MI pattern.' },
    { modality: 'echo',       date: d0, reportedBy: 'Dr. S. Iyer (Cardiology)', findings: 'Globally reduced left ventricular systolic function. Estimated EF 25%. Dilated LV (LVEDD 6.4 cm). Mild mitral regurgitation. No pericardial effusion.', impression: 'Severe LV systolic dysfunction. Decompensated heart failure.' },
  ],
  surgical: [
    { modality: 'xray',       date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Post-operative changes consistent with recent hip arthroplasty / laparoscopic procedure. Prosthesis/clips in satisfactory position. No pneumoperitoneum. No pleural effusion.', impression: 'Expected post-operative appearances. No immediate complications.' },
  ],
  respiratory: [
    { modality: 'xray',       date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Consolidation in the right lower lobe / bilateral hyperinflation with flattened hemidiaphragms. No pneumothorax. No pleural effusion. Cardiac silhouette normal.', impression: 'Right lower lobe consolidation consistent with pneumonia / COPD with air trapping.' },
    { modality: 'spirometry',  date: d1, reportedBy: 'Dr. K. Mehta (Pulmonology)', findings: 'FEV1: 58% predicted (post-bronchodilator). FVC: 74% predicted. FEV1/FVC ratio: 0.54. Reversibility test: 12% improvement with salbutamol.', impression: 'Obstructive pattern. Moderate obstruction. Partial bronchodilator reversibility.' },
  ],
  gastrointestinal: [
    { modality: 'usg',        date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Multiple gallstones, largest 1.4 cm, with acoustic shadowing. Oedematous gallbladder wall (4 mm). CBD 8 mm. Pancreas appears oedematous with peripancreatic fluid. No free intraperitoneal air.', impression: 'Cholelithiasis with cholecystitis. Pancreatitis with peripancreatic fluid collection.' },
    { modality: 'ct',         date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Pancreatic oedema with peripancreatic fat stranding. Small peripancreatic fluid collection (4 cm). No necrosis identified. CTSI score 4 (Moderate). No hepatic lesions. Gallstones confirmed.', impression: 'Moderate acute pancreatitis. CTSI score 4. No pancreatic necrosis.' },
  ],
  infectious: [
    { modality: 'usg',        date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Kidneys: Right kidney 11.2 cm, left 10.8 cm. Increased echogenicity right kidney. No hydronephrosis or calculi. Bladder: 80 mL residual post-void. No perinephric collection.', impression: 'Features consistent with pyelonephritis. No obstructive uropathy.' },
  ],
  neurological: [
    { modality: 'ct',         date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'No intracranial haemorrhage. Hypodense area in left MCA territory (14 mm × 11 mm). No midline shift. Ventricles normal. Sulcal pattern appropriate for age.', impression: 'Acute ischaemic infarct left MCA territory. No haemorrhage. No mass effect.' },
    { modality: 'mri',        date: d1, reportedBy: 'Dr. T. Kapoor (Neuroradiology)', findings: 'DWI restriction in left frontal and parietal regions. ADC map confirms acute infarct. No haemorrhagic transformation. FLAIR: Periventricular white matter changes (Fazekas grade 1).', impression: 'Acute left MCA territory ischaemic stroke confirmed on DWI. No haemorrhagic transformation.' },
  ],
  haematology: [
    { modality: 'xray',       date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'No acute cardiopulmonary pathology. Bone texture normal / mild trabecular coarsening. Spleen appears enlarged on abdominal projection. No lytic lesions.', impression: 'Splenomegaly. No acute osseous pathology.' },
    { modality: 'usg',        date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Spleen 16.2 cm, homogeneous echotexture. Liver mildly enlarged, mildly increased echogenicity. No intraabdominal lymphadenopathy. No ascites.', impression: 'Splenomegaly and hepatomegaly consistent with haematological disorder.' },
  ],
  obstetric: [
    { modality: 'usg',        date: d0, reportedBy: 'Dr. P. Nair (Obstetrics)', findings: 'Single viable foetus at 32 weeks. BPP score 8/10. Amniotic fluid index 14 cm. Foetal weight estimated 1780 g (50th centile). Placenta posterior, grade I, not praevia. Umbilical artery PI 0.88 (normal).', impression: 'Normal foetal anatomy and growth for 32 weeks. No uteroplacental insufficiency.' },
    { modality: 'ecg',        date: d0, reportedBy: 'Dr. S. Iyer (Cardiology)', findings: 'Sinus tachycardia, rate 108 bpm. Physiological ST changes consistent with pregnancy. No conduction abnormalities.', impression: 'Sinus tachycardia. No acute cardiac pathology.' },
  ],
  renal: [
    { modality: 'usg',        date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Bilateral small echogenic kidneys. Right kidney 9.1 cm, left 8.8 cm. Increased cortical echogenicity bilaterally. No hydronephrosis. No renal calculi. No perinephric collection.', impression: 'Bilateral small echogenic kidneys consistent with chronic renal disease. No obstructive uropathy.' },
  ],
  musculoskeletal: [
    { modality: 'xray',       date: d0, reportedBy: 'Dr. R. Pillai (Radiology)', findings: 'Periarticular osteopenia at bilateral wrists, MCPJs and PIPJs. Soft tissue swelling. No erosions identified on current study. Joint space preserved bilaterally.', impression: 'Periarticular osteopenia with soft tissue swelling. No frank erosive changes at this time. Findings consistent with inflammatory arthritis.' },
  ],
};

// ── Main seed ────────────────────────────────────────────────────────────────
async function seed() {
  const tables = ['LabInvestigations', 'ImagingReports'];
  const before = {};
  for (const t of tables) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    before[t] = r.cnt;
  }

  await run('DELETE FROM LabInvestigations');
  await run('DELETE FROM ImagingReports');

  for (const p of PATIENTS) {
    const labs = LAB_TEMPLATES[p.grp] || LAB_TEMPLATES.infectious;
    for (const lab of labs) {
      await run(
        `INSERT INTO LabInvestigations (id, patientId, tenantId, investigationDate, dayLabel, results, recordedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), p.id, TENANT, lab.date, lab.label, JSON.stringify(lab.results), DOCTOR]
      );
    }

    const imgs = IMAGING_TEMPLATES[p.grp] || IMAGING_TEMPLATES.infectious;
    for (const img of imgs) {
      await run(
        `INSERT INTO ImagingReports (id, patientId, tenantId, modalityType, investigationDate, findings, impression, reportedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), p.id, TENANT, img.modality, img.date, img.findings, img.impression, img.reportedBy]
      );
    }
  }

  const after = {};
  for (const t of tables) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    after[t] = r.cnt;
  }

  console.log('\n✓ seed_clinical_part2 complete');
  console.log('Table                   Before  After');
  for (const t of tables) {
    console.log(`  ${t.padEnd(22)} ${String(before[t]).padStart(5)}  ${String(after[t]).padStart(5)}`);
  }
  db.close();
}

seed().catch(e => { console.error(e); db.close(); process.exit(1); });
