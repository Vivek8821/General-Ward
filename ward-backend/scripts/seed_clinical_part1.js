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
const NOW = new Date().toISOString();

// ── Patient master (compact) ────────────────────────────────────────────────
const PATIENTS = [
  { id: 'p01', name: 'John Doe',         dx: 'Type 2 Diabetes Mellitus',                               grp: 'metabolic'      },
  { id: 'p02', name: 'Jane Roe',          dx: 'Hypertensive Crisis',                                    grp: 'cardiovascular' },
  { id: 'p03', name: 'Robert Smith',      dx: 'Post-Op Right Hip Replacement (Day 3)',                  grp: 'surgical'       },
  { id: 'p04', name: 'Alice Williams',    dx: 'Acute Bronchitis',                                       grp: 'respiratory'    },
  { id: 'p05', name: 'Michael Brown',     dx: 'Decompensated Congestive Heart Failure (EF 25%)',        grp: 'cardiovascular' },
  { id: 'p06', name: 'Emily Davis',       dx: 'Post-Laparoscopic Appendicectomy (Day 2)',               grp: 'surgical'       },
  { id: 'p07', name: 'William Wilson',    dx: 'Community-Acquired Pneumonia (Right Lower Lobe)',        grp: 'respiratory'    },
  { id: 'p08', name: 'Sarah Miller',      dx: 'Acute Gastroenteritis with Mild Dehydration',           grp: 'gastrointestinal'},
  { id: 'p09', name: 'James Taylor',      dx: 'COPD Exacerbation (Infective)',                          grp: 'respiratory'    },
  { id: 'p10', name: 'Linda Anderson',    dx: 'Complicated UTI (Pyelonephritis)',                       grp: 'infectious'     },
  { id: 'p11', name: 'David Thomas',      dx: 'Dengue Fever (Day 4, Thrombocytopenic phase)',           grp: 'infectious'     },
  { id: 'p12', name: 'Susan Moore',       dx: 'Chronic Migraine (Acute Exacerbation)',                  grp: 'neurological'   },
  { id: 'p13', name: 'Charles Jackson',   dx: 'Acute STEMI — Post-Primary PCI (Day 1)',                 grp: 'cardiovascular' },
  { id: 'p14', name: 'Patricia White',    dx: 'Acute Ischaemic Stroke (Left MCA territory, Day 2)',     grp: 'neurological'   },
  { id: 'p15', name: 'Daniel Harris',     dx: 'Acute Pancreatitis (Gallstone-induced, Mod-Severe)',     grp: 'gastrointestinal'},
  { id: 'p16', name: 'Nancy Martin',      dx: 'Right Neck of Femur Fracture (Pre-operative)',           grp: 'surgical'       },
  { id: 'p17', name: 'Paul Thompson',     dx: 'Acute Severe Asthma Exacerbation',                      grp: 'respiratory'    },
  { id: 'p18', name: 'Lisa Garcia',       dx: 'Severe Preeclampsia (32 weeks gestation)',               grp: 'obstetric'      },
  { id: 'p19', name: 'Mark Martinez',     dx: 'Chronic Kidney Disease Stage 4 — Anaemia of CKD',       grp: 'renal'          },
  { id: 'p20', name: 'Karen Robinson',    dx: 'Cellulitis Right Lower Leg (Non-purulent)',              grp: 'infectious'     },
  { id: 'p21', name: 'Steven Clark',      dx: 'Mild Traumatic Brain Injury (GCS 14/15, CT: no bleed)', grp: 'neurological'   },
  { id: 'p22', name: 'Betty Rodriguez',   dx: 'Acute Confusional State secondary to Dehydration + UTI',grp: 'neurological'   },
  { id: 'p23', name: 'George Lewis',      dx: 'Peptic Ulcer Disease with Upper GI Bleed',              grp: 'gastrointestinal'},
  { id: 'p24', name: 'Sandra Lee',        dx: 'Thyroid Storm (Burch-Wartofsky score 65)',               grp: 'metabolic'      },
  { id: 'p25', name: 'Kenneth Walker',    dx: 'Infective Endocarditis (Streptococcal — Mitral Valve)', grp: 'cardiovascular' },
  { id: 'p26', name: 'Helen Hall',        dx: 'Rheumatoid Arthritis — Acute Polyarticular Flare',      grp: 'musculoskeletal'},
  { id: 'p27', name: 'Edward Allen',      dx: 'Sickle Cell Disease — Acute Vaso-occlusive Crisis',     grp: 'haematology'    },
  { id: 'p28', name: 'Dorothy Young',     dx: 'Complete Heart Block — Awaiting Pacemaker Implant',     grp: 'cardiovascular' },
  { id: 'p29', name: 'Brian King',        dx: 'Decompensated Liver Cirrhosis (Child-Pugh C) + Ascites',grp: 'gastrointestinal'},
  { id: 'p30', name: 'Carol Wright',      dx: 'SLE — Lupus Nephritis Class III Flare',                 grp: 'haematology'    },
];

// ── Medical History templates ────────────────────────────────────────────────
function getMedicalHistory(p) {
  const base = {
    metabolic:       { comorbidities: ['Obesity (BMI 31)','Dyslipidaemia'], surgicalHistory: 'Appendicectomy (2012)', familyHistory: 'Father: T2DM, Mother: Hypertension', socialHistory: 'Non-smoker, occasional alcohol, sedentary office work' },
    cardiovascular:  { comorbidities: ['Hypertension','Dyslipidaemia','Former smoker (20 pack-years)'], surgicalHistory: 'Nil significant', familyHistory: 'Father: MI at age 58', socialHistory: 'Retired, lives with spouse, ex-smoker (quit 5 years ago)' },
    surgical:        { comorbidities: ['Osteoarthritis','Hypertension'], surgicalHistory: 'Cholecystectomy (2018)', familyHistory: 'No significant family history', socialHistory: 'Independent, lives alone, non-smoker' },
    respiratory:     { comorbidities: ['Allergic rhinitis','Hypertension'], surgicalHistory: 'Tonsillectomy (childhood)', familyHistory: 'Mother: Asthma', socialHistory: 'Non-smoker, works in a dusty environment' },
    gastrointestinal:{ comorbidities: ['Hypertension','Type 2 Diabetes'], surgicalHistory: 'Hernia repair (2015)', familyHistory: 'Father: Colon cancer', socialHistory: 'Moderate alcohol (15 units/week), non-smoker' },
    infectious:      { comorbidities: ['Type 2 Diabetes','Hypertension'], surgicalHistory: 'Nil', familyHistory: 'No significant family history', socialHistory: 'Non-smoker, non-drinker' },
    neurological:    { comorbidities: ['Hypertension','Anxiety disorder'], surgicalHistory: 'Nil', familyHistory: 'Mother: Migraines', socialHistory: 'Sedentary lifestyle, mild social drinker' },
    haematology:     { comorbidities: ['Known haematological condition','Iron deficiency'], surgicalHistory: 'Multiple hospital admissions for crises', familyHistory: 'Sickle cell trait in both parents', socialHistory: 'Non-smoker, non-drinker, university student' },
    obstetric:       { comorbidities: ['Gestational hypertension (prior pregnancy)','Iron deficiency anaemia'], surgicalHistory: 'Nil', familyHistory: 'Mother: Hypertension', socialHistory: 'Non-smoker, non-drinker, para 1' },
    renal:           { comorbidities: ['Type 2 Diabetes','Hypertension','Anaemia'], surgicalHistory: 'Renal biopsy (2022)', familyHistory: 'Father: CKD', socialHistory: 'Non-smoker, limited fluid intake due to CKD advice' },
    musculoskeletal: { comorbidities: ['Rheumatoid Arthritis (seropositive)','Osteoporosis'], surgicalHistory: 'Right knee arthroscopy (2019)', familyHistory: 'Mother: RA', socialHistory: 'Non-smoker, retired teacher' },
  };
  const t = base[p.grp] || base.infectious;
  return {
    comorbidities: JSON.stringify(t.comorbidities),
    surgicalHistory: t.surgicalHistory,
    familyHistory: t.familyHistory,
    socialHistory: t.socialHistory,
  };
}

// ── Allergies templates ──────────────────────────────────────────────────────
const ALLERGY_POOL = {
  metabolic:       [{ allergen: 'Sulphonylureas', category: 'drug',        reaction: 'Hypoglycaemia and rash',           severity: 'moderate' },
                    { allergen: 'Shellfish',       category: 'food',        reaction: 'Urticaria',                        severity: 'mild'     }],
  cardiovascular:  [{ allergen: 'Aspirin',         category: 'drug',        reaction: 'Bronchospasm',                     severity: 'severe'   },
                    { allergen: 'Contrast dye',    category: 'other',       reaction: 'Anaphylactoid reaction (prior CT)', severity: 'severe'   }],
  surgical:        [{ allergen: 'Latex',           category: 'environmental',reaction: 'Contact dermatitis',              severity: 'moderate' },
                    { allergen: 'Penicillin',      category: 'drug',        reaction: 'Maculopapular rash',               severity: 'mild'     }],
  respiratory:     [{ allergen: 'NSAIDs',          category: 'drug',        reaction: 'Worsening bronchospasm',           severity: 'moderate' },
                    { allergen: 'House dust mite', category: 'environmental',reaction: 'Rhinorrhoea and wheeze',          severity: 'mild'     }],
  gastrointestinal:[{ allergen: 'Metronidazole',   category: 'drug',        reaction: 'Nausea and metallic taste',        severity: 'mild'     },
                    { allergen: 'Dairy products',  category: 'food',        reaction: 'Bloating and diarrhoea',           severity: 'mild'     }],
  infectious:      [{ allergen: 'Co-amoxiclav',    category: 'drug',        reaction: 'Diarrhoea and rash',               severity: 'mild'     }],
  neurological:    [{ allergen: 'Codeine',         category: 'drug',        reaction: 'Nausea, vomiting, oversedation',   severity: 'moderate' },
                    { allergen: 'Peanuts',         category: 'food',        reaction: 'Urticaria',                        severity: 'mild'     }],
  haematology:     [{ allergen: 'Penicillin',      category: 'drug',        reaction: 'Rash and angioedema',              severity: 'moderate' }],
  obstetric:       [{ allergen: 'Erythromycin',    category: 'drug',        reaction: 'Nausea and abdominal cramps',      severity: 'mild'     }],
  renal:           [{ allergen: 'NSAIDs',          category: 'drug',        reaction: 'Acute kidney injury precipitated', severity: 'severe'   },
                    { allergen: 'ACE Inhibitors',  category: 'drug',        reaction: 'Persistent dry cough',             severity: 'mild'     }],
  musculoskeletal: [{ allergen: 'Sulphasalazine',  category: 'drug',        reaction: 'Haemolytic anaemia',               severity: 'severe'   },
                    { allergen: 'Tree pollen',     category: 'environmental',reaction: 'Rhinitis and conjunctivitis',     severity: 'mild'     }],
};

// ── Clinical Presentation templates ─────────────────────────────────────────
function getClinicalPresentation(p) {
  const hpi = {
    metabolic:       `Patient presents with a ${p.dx}. Reports polyuria, polydipsia, and fatigue for the past 2 weeks. Blood glucose on admission was markedly elevated. No acute ketosis or altered consciousness.`,
    cardiovascular:  `Patient presents with ${p.dx}. Reports severe headache, visual disturbance, and chest tightness. BP severely elevated on arrival. No evidence of end-organ damage on initial assessment.`,
    surgical:        `Patient is Day 2–3 post-operative following elective ${p.dx}. Wound site is clean and dry. Pain controlled with regular analgesia. Mobilising with physiotherapy support.`,
    respiratory:     `Patient presents with a 4-day history of productive cough, low-grade fever, and worsening breathlessness consistent with ${p.dx}. SpO2 on room air was reduced on admission.`,
    gastrointestinal:`Patient presents with ${p.dx}. Reports epigastric/abdominal pain, nausea, and vomiting for 2 days. Clinically dehydrated. No peritoneal signs on examination.`,
    infectious:      `Patient presents with ${p.dx}. Reports fever, rigors, and localised symptoms for 3 days. Inflammatory markers markedly elevated. Blood cultures sent prior to antibiotics.`,
    neurological:    `Patient presents with ${p.dx}. Reports acute onset neurological symptoms. Neurological examination reveals deficits consistent with the diagnosis. CT/MRI performed on arrival.`,
    haematology:     `Patient presents with ${p.dx}. Reports severe pain and fatigue. Known haematological condition with multiple prior admissions. Transfusion threshold being assessed.`,
    obstetric:       `Patient presents at 32 weeks gestation with ${p.dx}. BP markedly elevated with proteinuria. Foetal monitoring in progress. Multidisciplinary obstetric and medical team involved.`,
    renal:           `Patient presents with ${p.dx}. Reports progressive fatigue, pallor, and reduced urine output. Renal function markers significantly deranged from baseline.`,
    musculoskeletal: `Patient presents with ${p.dx}. Reports acute onset joint swelling, erythema, and restricted range of motion affecting multiple joints. Inflammatory markers elevated.`,
  };
  const exam = {
    metabolic:       'Alert and oriented. BMI 31. Dry mucous membranes. No focal neurological deficits. Cardiovascular and respiratory examination unremarkable. Peripheral pulses intact.',
    cardiovascular:  'Alert, distressed. BP 196/112 mmHg. HR 98 bpm, regular. JVP elevated 4 cm above sternal angle. Fine basal crepitations bilaterally. No peripheral oedema.',
    surgical:        'Alert, comfortable at rest. Wound site clean with no signs of infection. Abdomen soft and non-tender. Active bowel sounds. Calf tenderness assessed — negative.',
    respiratory:     'Mild respiratory distress. SpO2 92% on room air, improving on 2L O2. Dull to percussion right base. Coarse crepitations right lower zone. No wheeze.',
    gastrointestinal:'Mild distress. Abdomen soft with generalised mild tenderness. No guarding or rigidity. Bowel sounds reduced. Dry mucous membranes; skin turgor reduced.',
    infectious:      'Febrile (38.9°C). Tachycardic. Localised tenderness, erythema, and warmth at the affected site. No signs of systemic sepsis. Haemodynamically stable.',
    neurological:    'GCS 14–15. Focal neurological deficit noted. Speech may be affected. Pupils equal and reactive. Cranial nerve and limb examination performed and documented.',
    haematology:     'Pale and jaundiced. Tachycardic. Splenomegaly on palpation. No lymphadenopathy. Bone tenderness at crisis sites. No bleeding manifestations noted.',
    obstetric:       'Alert. BP 168/108 mmHg. 2+ pitting oedema both lower limbs. Uterus 32 weeks size, foetal heart rate 148 bpm. DTRs brisk. No clonus.',
    renal:           'Pallid and fatigued. Mild pitting oedema ankles. BP 148/92 mmHg. Cardiovascular and respiratory examination normal. No fluid overload clinically.',
    musculoskeletal: 'Painful gait. Affected joints swollen, erythematous, warm, and tender. Restricted active and passive range of motion. No tophi visible. No rash.',
  };
  return {
    hpi: hpi[p.grp] || hpi.infectious,
    exam: exam[p.grp] || exam.infectious,
  };
}

// ── Main seed ────────────────────────────────────────────────────────────────
async function seed() {
  const before = {};
  for (const t of ['MedicalHistory', 'StructuredAllergies', 'ClinicalPresentation']) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    before[t] = r.cnt;
  }

  // Clear clinical presentation and medical history for clean re-seed
  await run('DELETE FROM ClinicalPresentation');
  await run('DELETE FROM MedicalHistory');
  await run('DELETE FROM StructuredAllergies');

  for (const p of PATIENTS) {
    // 1. MedicalHistory (one per patient)
    const mh = getMedicalHistory(p);
    await run(
      `INSERT INTO MedicalHistory (id, patientId, tenantId, comorbidities, surgicalHistory, familyHistory, socialHistory, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), p.id, TENANT, mh.comorbidities, mh.surgicalHistory, mh.familyHistory, mh.socialHistory, DOCTOR, DOCTOR]
    );

    // 2. StructuredAllergies (1–2 per patient)
    const allergies = ALLERGY_POOL[p.grp] || ALLERGY_POOL.infectious;
    for (const a of allergies) {
      await run(
        `INSERT INTO StructuredAllergies (id, patientId, tenantId, allergen, category, reaction, severity, verificationMethod, recordedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), p.id, TENANT, a.allergen, a.category, a.reaction, a.severity, 'Patient self-report + medical records', DOCTOR]
      );
    }

    // 3. ClinicalPresentation (one per patient)
    const cp = getClinicalPresentation(p);
    await run(
      `INSERT INTO ClinicalPresentation (id, patientId, tenantId, historyOfPresentingIllness, physicalExamFindings, examinedBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uid(), p.id, TENANT, cp.hpi, cp.exam, DOCTOR]
    );
  }

  const after = {};
  for (const t of ['MedicalHistory', 'StructuredAllergies', 'ClinicalPresentation']) {
    const r = await get(`SELECT COUNT(*) as cnt FROM ${t}`);
    after[t] = r.cnt;
  }

  console.log('\n✓ seed_clinical_part1 complete');
  console.log('Table                   Before  After');
  for (const t of Object.keys(before)) {
    console.log(`  ${t.padEnd(22)} ${String(before[t]).padStart(5)}  ${String(after[t]).padStart(5)}`);
  }
  db.close();
}

seed().catch(e => { console.error(e); db.close(); process.exit(1); });
