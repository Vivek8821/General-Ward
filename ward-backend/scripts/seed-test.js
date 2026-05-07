/**
 * Test seed — 30 patients with full clinical profiles.
 * Covers: vitals, symptoms, diet, sleep, history, medications.
 * Safe to run repeatedly — wipes tables first.
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const path     = require('path');
const { initDb } = require('../db/schema');

const DB_PATH = path.resolve(__dirname, '..', 'ward.db');
const db = new sqlite3.Database(DB_PATH);
db.on('error', () => {});

const run = (sql, p = []) =>
  new Promise((res, rej) => db.run(sql, p, err => err ? rej(err) : res()));

const TENANT = 'tenant-default';
const NOW    = new Date().toISOString();
const ago = h => new Date(Date.now() - h * 3600000).toISOString();

// ─── PATIENTS ────────────────────────────────────────────────────────────────
const PATIENTS = [
  {
    id:'p01', name:'John Doe',        mrn:'MRN0001', bed:'Ward A-1',
    dob:'1985-03-15', gender:'Male',   bloodGroup:'O+', contact:'9821001001',
    emergency:'Mary Doe (Wife) 9821001002',
    diagnosis:'Type 2 Diabetes Mellitus', allergies:'Penicillin',
    ci:2, status:'active',
    vitals:{ pulse:78,  bpSystolic:128, bpDiastolic:82,  respRate:16, temp:36.8, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Mild fatigue and increased thirst since 3 days', severity:'mild' }],
    diet:{ intake:'80%', type:'Diabetic (low sugar, low GI)', notes:'Tolerating well, avoiding sweets. Adequate fluid intake.' },
    sleep:{ hours:6.5, quality:'fair', notes:'Woke once due to nocturia. Advised fluid restriction after 8 PM.' },
    history:{ pmh:'T2DM diagnosed 2018. Dyslipidaemia. No prior hospitalisations.', fh:'Father — T2DM and hypertension. Mother — osteoporosis.', sh:'Non-smoker. Social drinker. Desk job, minimal exercise.' },
    meds:[
      { name:'Metformin',  dosage:'500mg SR', route:'oral', freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Glipizide',  dosage:'5mg',      route:'oral', freq:'once daily',   times:'["08:00"]',         prn:false },
      { name:'Atorvastatin',dosage:'20mg',    route:'oral', freq:'once daily',   times:'["21:00"]',         prn:false },
    ],
  },
  {
    id:'p02', name:'Jane Roe',         mrn:'MRN0002', bed:'Ward B-3',
    dob:'1992-07-22', gender:'Female', bloodGroup:'A+', contact:'9821002001',
    emergency:'Tom Roe (Husband) 9821002002',
    diagnosis:'Hypertensive Crisis', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:88,  bpSystolic:182, bpDiastolic:112, respRate:16, temp:36.5, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Severe headache and blurred vision on admission. Headache partially resolved with medication.', severity:'moderate' }],
    diet:{ intake:'70%', type:'Low sodium, DASH diet', notes:'Adequate intake. Advised to avoid processed foods and excess salt.' },
    sleep:{ hours:5.5, quality:'poor', notes:'Disturbed by headache. Anxious about BP readings.' },
    history:{ pmh:'Hypertension diagnosed 2020. Oral contraceptive use (3 years). No prior crises.', fh:'Mother — stroke at age 55. Father — IHD.', sh:'Non-smoker. Non-drinker. Teacher. Moderate stress.' },
    meds:[
      { name:'Amlodipine',  dosage:'10mg', route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Lisinopril',  dosage:'10mg', route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Hydralazine', dosage:'10mg', route:'IV',   freq:'PRN for BP >180', times:null,           prn:true  },
    ],
  },
  {
    id:'p03', name:'Robert Smith',     mrn:'MRN0003', bed:'Ward A-2',
    dob:'1955-11-08', gender:'Male',   bloodGroup:'B+', contact:'9821003001',
    emergency:'Clara Smith (Daughter) 9821003002',
    diagnosis:'Post-Op Right Hip Replacement (Day 3)', allergies:'Latex',
    ci:3, status:'active',
    vitals:{ pulse:88,  bpSystolic:118, bpDiastolic:76,  respRate:18, temp:37.4, spo2:96, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Moderate surgical site pain rated 5/10. Mild swelling around operative site.', severity:'moderate' }],
    diet:{ intake:'65%', type:'High protein, high calcium soft diet', notes:'Appetite reduced due to pain. Tolerating sips well. Nutritional supplement prescribed.' },
    sleep:{ hours:4.5, quality:'poor', notes:'Pain disturbing sleep. Night sedation considered.' },
    history:{ pmh:'Osteoarthritis both hips (R > L). Hypertension. Ex-smoker (quit 2010).', fh:'Father — osteoporosis and hip fracture at 78.', sh:'Retired mechanic. Lives alone. Moderate alcohol use.' },
    meds:[
      { name:'Tramadol',      dosage:'50mg',    route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Enoxaparin',    dosage:'40mg',    route:'SC',   freq:'once daily',       times:'["20:00"]',                        prn:false },
      { name:'Omeprazole',    dosage:'20mg',    route:'oral', freq:'once daily',       times:'["08:00"]',                        prn:false },
      { name:'Paracetamol',   dosage:'1g',      route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p04', name:'Alice Williams',   mrn:'MRN0004', bed:'Ward C-1',
    dob:'1978-02-14', gender:'Female', bloodGroup:'AB+', contact:'9821004001',
    emergency:'Sam Williams (Husband) 9821004002',
    diagnosis:'Acute Bronchitis', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:84,  bpSystolic:122, bpDiastolic:78,  respRate:20, temp:37.9, spo2:95, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Productive cough with yellowish sputum. Chest tightness. Mild wheeze on exertion.', severity:'moderate' }],
    diet:{ intake:'75%', type:'Normal hospital diet with extra fluids', notes:'Encouraged warm fluids. Appetite reduced due to coughing.' },
    sleep:{ hours:5.0, quality:'poor', notes:'Coughing episodes disturb sleep. Prescribed cough suppressant at night.' },
    history:{ pmh:'Recurrent bronchitis episodes (3 in past 2 years). No asthma. Non-smoker.', fh:'Mother — asthma. No other significant family history.', sh:'Office manager. Non-smoker. No alcohol. Cat owner (possible allergen).' },
    meds:[
      { name:'Amoxicillin',     dosage:'500mg', route:'oral', freq:'three times daily', times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Salbutamol',      dosage:'2.5mg', route:'nebulised', freq:'four times daily', times:'["08:00","12:00","16:00","20:00"]', prn:false },
      { name:'Paracetamol',     dosage:'1g',    route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p05', name:'Michael Brown',    mrn:'MRN0005', bed:'Ward A-3',
    dob:'1943-09-05', gender:'Male',   bloodGroup:'O-', contact:'9821005001',
    emergency:'Susan Brown (Wife) 9821005002',
    diagnosis:'Decompensated Congestive Heart Failure (EF 25%)', allergies:'Sulfonamides',
    ci:4, status:'active',
    vitals:{ pulse:118, bpSystolic:92,  bpDiastolic:58,  respRate:28, temp:36.9, spo2:89, levelOfConsciousness:'voice', supplementalO2:true  },
    symptoms:[{ description:'Severe orthopnoea. Bilateral pedal oedema (++). Paroxysmal nocturnal dyspnoea last night. JVP elevated.', severity:'severe' }],
    diet:{ intake:'35%', type:'Fluid restricted (1L/day), low sodium cardiac diet', notes:'Appetite severely reduced. Nauseous. NG feeding being considered.' },
    sleep:{ hours:2.5, quality:'poor', notes:'Cannot lie flat. Sleeping in reclined chair. Multiple desaturations overnight.' },
    history:{ pmh:'CHF on treatment since 2018. Previous MI 2016. CABG 2017. T2DM. CKD Stage 3.', fh:'Father died of MI at 62. Brother — CHF.', sh:'Retired farmer. Ex-smoker (40 pack-years, quit 2016). Alcohol — none.' },
    meds:[
      { name:'Furosemide',    dosage:'80mg',   route:'IV',   freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Spironolactone',dosage:'25mg',   route:'oral', freq:'once daily',   times:'["08:00"]',         prn:false },
      { name:'Carvedilol',    dosage:'6.25mg', route:'oral', freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Digoxin',       dosage:'0.25mg', route:'oral', freq:'once daily',   times:'["08:00"]',         prn:false },
      { name:'Morphine',      dosage:'2.5mg',  route:'IV',   freq:'PRN dyspnoea',  times:null,              prn:true  },
    ],
  },
  {
    id:'p06', name:'Emily Davis',      mrn:'MRN0006', bed:'Ward B-1',
    dob:'2001-04-18', gender:'Female', bloodGroup:'A-', contact:'9821006001',
    emergency:'Helen Davis (Mother) 9821006002',
    diagnosis:'Post-Laparoscopic Appendicectomy (Day 2)', allergies:'Aspirin',
    ci:2, status:'active',
    vitals:{ pulse:82,  bpSystolic:114, bpDiastolic:72,  respRate:16, temp:37.5, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Mild abdominal pain at port sites (3/10). Nausea resolved. Tolerating oral fluids.', severity:'mild' }],
    diet:{ intake:'60%', type:'Clear fluids to soft diet (stepwise)', notes:'Started on clear fluids this morning. Tolerating well. Progressing to soft diet.' },
    sleep:{ hours:7.0, quality:'good', notes:'Slept well. Pain controlled. Single waking for bathroom.' },
    history:{ pmh:'No prior surgical history. No chronic illnesses. Menarche age 13, regular periods.', fh:'No significant family history.', sh:'University student. Non-smoker. Occasional social drinking.' },
    meds:[
      { name:'Metronidazole',         dosage:'500mg', route:'IV',   freq:'three times daily', times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Cefuroxime',            dosage:'750mg', route:'IV',   freq:'three times daily', times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Ondansetron',           dosage:'4mg',   route:'oral', freq:'three times daily', times:'["08:00","14:00","20:00"]', prn:true  },
      { name:'Paracetamol',           dosage:'1g',    route:'IV',   freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p07', name:'William Wilson',   mrn:'MRN0007', bed:'Ward C-2',
    dob:'1963-06-30', gender:'Male',   bloodGroup:'B-', contact:'9821007001',
    emergency:'Ruth Wilson (Wife) 9821007002',
    diagnosis:'Community-Acquired Pneumonia (Right Lower Lobe)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:104, bpSystolic:106, bpDiastolic:68,  respRate:24, temp:38.6, spo2:92, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Productive cough with rusty sputum. Pleuritic chest pain (R side) 6/10. Rigors this morning.', severity:'severe' }],
    diet:{ intake:'50%', type:'High-calorie, high-protein', notes:'Appetite poor. Encouraged fluids. Oral intake supplemented with nutritional drinks.' },
    sleep:{ hours:4.0, quality:'poor', notes:'Fever and coughing disturb sleep. Antipyretics given at midnight.' },
    history:{ pmh:'Smoker (20 pack-years, ongoing). GORD. No prior pneumonia.', fh:'Father — COPD. No other significant history.', sh:'Factory supervisor. Smokes 1 PPD. Minimal alcohol.' },
    meds:[
      { name:'Ceftriaxone',  dosage:'2g',    route:'IV',   freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Azithromycin', dosage:'500mg', route:'oral', freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Paracetamol',  dosage:'1g',    route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p08', name:'Sarah Miller',     mrn:'MRN0008', bed:'Ward A-4',
    dob:'1989-12-01', gender:'Female', bloodGroup:'O+', contact:'9821008001',
    emergency:'Jake Miller (Husband) 9821008002',
    diagnosis:'Acute Gastroenteritis with Mild Dehydration', allergies:'Dairy products',
    ci:1, status:'active',
    vitals:{ pulse:96,  bpSystolic:102, bpDiastolic:64,  respRate:18, temp:37.7, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Nausea and vomiting (3 episodes). Watery diarrhoea (5 episodes today). Abdominal cramps.' , severity:'moderate' }],
    diet:{ intake:'40%', type:'BRAT diet (banana, rice, applesauce, toast)', notes:'IV fluids running. Cautious oral reintroduction. Tolerating sips of water.' },
    sleep:{ hours:5.5, quality:'fair', notes:'Frequent bathroom trips disrupting sleep. Antidiarrhoeal given at night.' },
    history:{ pmh:'IBS (mild). No prior hospitalisations for GI issues.', fh:'No significant family history.', sh:'Nurse. Possible food poisoning (ate out 2 days ago). Non-smoker. Non-drinker.' },
    meds:[
      { name:'Ondansetron',  dosage:'4mg',  route:'IV',   freq:'three times daily',  times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Oral Rehydration Salts', dosage:'1 sachet in 200ml', route:'oral', freq:'after each loose stool', times:null, prn:true },
      { name:'Loperamide',   dosage:'2mg',  route:'oral', freq:'PRN (max 8mg/day)', times:null, prn:true },
    ],
  },
  {
    id:'p09', name:'James Taylor',     mrn:'MRN0009', bed:'Ward B-2',
    dob:'1950-08-19', gender:'Male',   bloodGroup:'A+', contact:'9821009001',
    emergency:'Margaret Taylor (Daughter) 9821009002',
    diagnosis:'COPD Exacerbation (Infective)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:92,  bpSystolic:138, bpDiastolic:86,  respRate:26, temp:37.2, spo2:88, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Increased breathlessness on minimal exertion. Purulent green sputum. Using accessory muscles. Barrel chest noted.', severity:'severe' }],
    diet:{ intake:'55%', type:'High-calorie soft diet', notes:'Dyspnoeic during meals. Small frequent meals advised. Fortified milkshake prescribed.' },
    sleep:{ hours:4.0, quality:'poor', notes:'Significant nocturnal dyspnoea. O2 therapy running overnight. Positioning on 3 pillows.' },
    history:{ pmh:'COPD (GOLD Stage III) diagnosed 2010. Recurrent exacerbations (3 per year). Ex-smoker (55 pack-years, quit 2015).', fh:'Father — emphysema. No other relevant history.', sh:'Retired coal miner. Ex-smoker. Widower. Lives alone.' },
    meds:[
      { name:'Salbutamol',    dosage:'2.5mg', route:'nebulised', freq:'four times daily', times:'["08:00","12:00","16:00","20:00"]', prn:false },
      { name:'Ipratropium',   dosage:'0.5mg', route:'nebulised', freq:'four times daily', times:'["08:00","12:00","16:00","20:00"]', prn:false },
      { name:'Prednisolone',  dosage:'30mg',  route:'oral',      freq:'once daily',       times:'["08:00"]',                        prn:false },
      { name:'Amoxicillin',   dosage:'500mg', route:'oral',      freq:'three times daily',times:'["08:00","14:00","20:00"]',         prn:false },
    ],
  },
  {
    id:'p10', name:'Linda Anderson',   mrn:'MRN0010', bed:'Ward C-3',
    dob:'1972-05-27', gender:'Female', bloodGroup:'B+', contact:'9821010001',
    emergency:'Peter Anderson (Husband) 9821010002',
    diagnosis:'Complicated Urinary Tract Infection (Pyelonephritis)', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:86,  bpSystolic:126, bpDiastolic:80,  respRate:16, temp:38.3, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Right flank pain (7/10). Dysuria and frequency. Nausea. Chills on admission (resolved).', severity:'moderate' }],
    diet:{ intake:'70%', type:'Normal diet with high fluid intake (>2.5L/day)', notes:'Encouraging oral fluids. Appetite mildly reduced. IV fluids if oral intake inadequate.' },
    sleep:{ hours:6.0, quality:'fair', notes:'Waking for frequent urination. Pain managed. Sleep improving with analgesia.' },
    history:{ pmh:'Recurrent UTIs (4 episodes in 2 years). Kidney stone (right, 2022, passed spontaneously).', fh:'Mother — CKD. No other relevant history.', sh:'Accountant. Non-smoker. Non-drinker. Lives with husband and 2 children.' },
    meds:[
      { name:'Ceftriaxone', dosage:'1g',   route:'IV',   freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Paracetamol', dosage:'1g',   route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Tamsulosin',  dosage:'0.4mg',route:'oral', freq:'once daily',       times:'["21:00"]',         prn:false },
    ],
  },
  {
    id:'p11', name:'David Thomas',     mrn:'MRN0011', bed:'Ward A-5',
    dob:'1982-01-10', gender:'Male',   bloodGroup:'O+', contact:'9821011001',
    emergency:'Priya Thomas (Wife) 9821011002',
    diagnosis:'Dengue Fever (Day 4, Thrombocytopenic phase)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:108, bpSystolic:100, bpDiastolic:62,  respRate:18, temp:39.1, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'High fever with rigors. Severe retro-orbital headache. Petechiae on lower limbs. Platelet count 42,000.', severity:'severe' }],
    diet:{ intake:'45%', type:'High fluid soft diet (3L/day oral + IV)', notes:'Oral intake limited by nausea. IV NS running at 125ml/hr. Encouraging coconut water.' },
    sleep:{ hours:7.5, quality:'fair', notes:'Febrile episodes disturbing sleep. Antipyretics effective for 4-5 hours.' },
    history:{ pmh:'No significant past medical history. Previously healthy.', fh:'No relevant family history.', sh:'Software engineer. Returned from business trip 1 week ago. Non-smoker. Social drinker.' },
    meds:[
      { name:'Paracetamol', dosage:'1g',   route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Ondansetron', dosage:'4mg',  route:'oral', freq:'three times daily',times:'["08:00","14:00","20:00"]',         prn:true  },
    ],
  },
  {
    id:'p12', name:'Susan Moore',      mrn:'MRN0012', bed:'Ward B-4',
    dob:'1995-09-14', gender:'Female', bloodGroup:'A+', contact:'9821012001',
    emergency:'Diane Moore (Mother) 9821012002',
    diagnosis:'Chronic Migraine (Acute Exacerbation)', allergies:'None known',
    ci:1, status:'active',
    vitals:{ pulse:74,  bpSystolic:116, bpDiastolic:74,  respRate:14, temp:36.6, spo2:99, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Pulsating right-sided headache (8/10 on admission, now 4/10). Photophobia and phonophobia. Nausea. No aura.', severity:'moderate' }],
    diet:{ intake:'50%', type:'Light, bland diet', notes:'Appetite reduced due to nausea. Tolerating crackers and water. Avoiding caffeine.' },
    sleep:{ hours:8.0, quality:'good', notes:'Slept with blackout curtains. Headache improved significantly post-sleep.' },
    history:{ pmh:'Chronic migraine since age 18 (6-8 episodes/month). On prophylaxis.', fh:'Mother — migraine. No other relevant history.', sh:'Graphic designer. Moderate screen time. Non-smoker. Occasional wine (possible trigger).' },
    meds:[
      { name:'Sumatriptan',     dosage:'50mg', route:'oral', freq:'PRN (max 2/24hrs)', times:null, prn:true  },
      { name:'Metoclopramide',  dosage:'10mg', route:'IV',   freq:'three times daily', times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Topiramate',      dosage:'50mg', route:'oral', freq:'twice daily (prophylaxis)', times:'["08:00","20:00"]', prn:false },
    ],
  },
  {
    id:'p13', name:'Charles Jackson',  mrn:'MRN0013', bed:'Ward A-6',
    dob:'1958-04-22', gender:'Male',   bloodGroup:'AB-', contact:'9821013001',
    emergency:'Donna Jackson (Wife) 9821013002',
    diagnosis:'Acute STEMI — Post-Primary PCI (Day 1)', allergies:'None known',
    ci:4, status:'active',
    vitals:{ pulse:118, bpSystolic:88,  bpDiastolic:54,  respRate:22, temp:37.1, spo2:91, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Residual chest discomfort (4/10). Diaphoresis. Mild dyspnoea at rest. Cardiogenic shock on presentation (resolved post-PCI).', severity:'severe' }],
    diet:{ intake:'30%', type:'Cardiac diet — low sodium, low fat, fluid restricted', notes:'Appetite severely reduced. IV fluids. Clear liquids introduced cautiously.' },
    sleep:{ hours:3.0, quality:'poor', notes:'ICU transfer planned. Frequent monitoring disturbing. Anxious. Mild sedation considered.' },
    history:{ pmh:'Hypertension (on treatment). Hypercholesterolaemia. Smoker (30 pack-years). No prior MI.', fh:'Father — fatal MI at 58. Brother — CABG at 52.', sh:'Company director. High stress job. Smoker. Moderate alcohol.' },
    meds:[
      { name:'Aspirin',          dosage:'75mg',    route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Clopidogrel',      dosage:'75mg',    route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Atorvastatin',     dosage:'80mg',    route:'oral', freq:'once daily',  times:'["21:00"]',         prn:false },
      { name:'Metoprolol',       dosage:'25mg',    route:'oral', freq:'twice daily', times:'["08:00","20:00"]', prn:false },
      { name:'Enoxaparin',       dosage:'1mg/kg',  route:'SC',   freq:'twice daily', times:'["08:00","20:00"]', prn:false },
      { name:'Morphine',         dosage:'5mg',     route:'IV',   freq:'PRN pain',    times:null,               prn:true  },
    ],
  },
  {
    id:'p14', name:'Patricia White',   mrn:'MRN0014', bed:'Ward B-5',
    dob:'1967-03-09', gender:'Female', bloodGroup:'O+', contact:'9821014001',
    emergency:'Mark White (Husband) 9821014002',
    diagnosis:'Acute Ischaemic Stroke (Left MCA territory, Day 2)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:76,  bpSystolic:172, bpDiastolic:104, respRate:16, temp:37.0, spo2:96, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Right-sided hemiparesis (power 3/5). Mild expressive dysphasia. Dysphagia (texture modified diet). Headache on admission resolved.', severity:'severe' }],
    diet:{ intake:'60%', type:'IDDSI Level 4 (pureed) with thickened fluids', notes:'Formal SALT assessment done. Aspiration risk. NG tube inserted for medication administration.' },
    sleep:{ hours:7.5, quality:'fair', notes:'Disoriented on waking. Carer present overnight. Neurological obs every 2 hours.' },
    history:{ pmh:'Hypertension (poorly controlled). Atrial Fibrillation (not anticoagulated — patient refusal). Hypercholesterolaemia.', fh:'Mother — stroke at 61. Father — hypertension.', sh:'Secondary school teacher. Non-smoker. Non-drinker. Lives with husband.' },
    meds:[
      { name:'Aspirin',       dosage:'300mg', route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Atorvastatin',  dosage:'40mg',  route:'oral', freq:'once daily',  times:'["21:00"]',         prn:false },
      { name:'Ramipril',      dosage:'5mg',   route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
      { name:'Amlodipine',    dosage:'5mg',   route:'oral', freq:'once daily',  times:'["08:00"]',         prn:false },
    ],
  },
  {
    id:'p15', name:'Daniel Harris',    mrn:'MRN0015', bed:'Ward C-4',
    dob:'1974-10-31', gender:'Male',   bloodGroup:'B+', contact:'9821015001',
    emergency:'Angela Harris (Sister) 9821015002',
    diagnosis:'Acute Pancreatitis (Gallstone-induced, Moderate-Severe)', allergies:'NSAIDs',
    ci:3, status:'active',
    vitals:{ pulse:108, bpSystolic:104, bpDiastolic:66,  respRate:20, temp:38.3, spo2:95, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Severe epigastric pain radiating to back (8/10 on admission, now 6/10 with analgesia). Vomiting (4 episodes). Abdominal rigidity.', severity:'severe' }],
    diet:{ intake:'0%', type:'Nil by mouth (NPO)', notes:'Complete bowel rest. IV fluids only (Normal Saline + Potassium). Nutritional support review by dietitian.' },
    sleep:{ hours:4.5, quality:'poor', notes:'Pain limiting sleep. Patient prefers foetal position. Pain team review requested.' },
    history:{ pmh:'Cholelithiasis (known, declined cholecystectomy in 2023). BMI 31. Social drinker.', fh:'Father — gallstones and cholecystectomy.', sh:'Accountant. Moderate alcohol use (14 units/week). Non-smoker.' },
    meds:[
      { name:'Tramadol',     dosage:'100mg', route:'IV',   freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Ondansetron',  dosage:'4mg',   route:'IV',   freq:'three times daily', times:'["08:00","14:00","20:00"]',         prn:false },
      { name:'Pantoprazole', dosage:'40mg',  route:'IV',   freq:'once daily',        times:'["08:00"]',                        prn:false },
    ],
  },
  {
    id:'p16', name:'Nancy Martin',     mrn:'MRN0016', bed:'Ward A-7',
    dob:'1949-07-16', gender:'Female', bloodGroup:'A+', contact:'9821016001',
    emergency:'Kevin Martin (Son) 9821016002',
    diagnosis:'Right Neck of Femur Fracture (Pre-operative)', allergies:'Morphine (nausea)',
    ci:2, status:'active',
    vitals:{ pulse:82,  bpSystolic:136, bpDiastolic:84,  respRate:16, temp:36.7, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Right hip pain (7/10, worsens with movement). Unable to weight-bear. Shortened and externally rotated right leg.', severity:'severe' }],
    diet:{ intake:'75%', type:'High protein, high calcium, Vitamin D enriched', notes:'Good appetite. Full oral intake except for morning of surgery. Calcium supplement initiated.' },
    sleep:{ hours:5.0, quality:'poor', notes:'Pain preventing comfortable positioning. Paracetamol given at 22:00 with effect.' },
    history:{ pmh:'Osteoporosis (on bisphosphonate). HTN. Mild cognitive impairment (independent ADLs).', fh:'Mother — hip fracture at 80.', sh:'Retired nurse. Lives alone. Social services involved for post-discharge planning.' },
    meds:[
      { name:'Paracetamol',     dosage:'1g',    route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Enoxaparin',      dosage:'40mg',  route:'SC',   freq:'once daily',       times:'["20:00"]',                        prn:false },
      { name:'Alendronate',     dosage:'70mg',  route:'oral', freq:'once weekly',      times:'["08:00"]',                        prn:false },
      { name:'Calcium+VitD',    dosage:'1 tab', route:'oral', freq:'twice daily',      times:'["08:00","20:00"]',                prn:false },
    ],
  },
  {
    id:'p17', name:'Paul Thompson',    mrn:'MRN0017', bed:'Ward B-6',
    dob:'1981-11-23', gender:'Male',   bloodGroup:'O+', contact:'9821017001',
    emergency:'Claire Thompson (Wife) 9821017002',
    diagnosis:'Acute Severe Asthma Exacerbation', allergies:'Aspirin, NSAIDs',
    ci:3, status:'active',
    vitals:{ pulse:112, bpSystolic:122, bpDiastolic:78,  respRate:28, temp:37.0, spo2:90, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Severe breathlessness. Unable to complete sentences. Expiratory wheeze. Peak flow 40% of predicted. Using accessory muscles.', severity:'severe' }],
    diet:{ intake:'50%', type:'Normal diet with small frequent meals', notes:'Dyspnoeic during eating. Small meals every 2-3 hours. Adequate hydration.' },
    sleep:{ hours:4.0, quality:'poor', notes:'Nocturnal symptoms woke patient 3 times. O2 maintained via mask overnight.' },
    history:{ pmh:'Allergic asthma (since childhood). Multiple admissions. Aspirin-exacerbated respiratory disease. Allergic rhinitis. Eczema.', fh:'Mother — asthma. Father — hay fever.', sh:'Physiotherapist. Good inhaler technique. Non-smoker. Cat allergy (cat at home).' },
    meds:[
      { name:'Salbutamol',     dosage:'5mg',   route:'nebulised', freq:'hourly (then QDS)', times:'["08:00","12:00","16:00","20:00"]', prn:false },
      { name:'Ipratropium',    dosage:'0.5mg', route:'nebulised', freq:'four times daily',  times:'["08:00","12:00","16:00","20:00"]', prn:false },
      { name:'Prednisolone',   dosage:'40mg',  route:'oral',      freq:'once daily',        times:'["08:00"]',                        prn:false },
      { name:'Magnesium Sulphate', dosage:'2g', route:'IV',       freq:'stat (once)',       times:null,                               prn:true  },
    ],
  },
  {
    id:'p18', name:'Lisa Garcia',      mrn:'MRN0018', bed:'Ward C-5',
    dob:'1988-02-07', gender:'Female', bloodGroup:'AB+', contact:'9821018001',
    emergency:'Carlos Garcia (Husband) 9821018002',
    diagnosis:'Severe Preeclampsia (32 weeks gestation)', allergies:'None known',
    ci:4, status:'active',
    vitals:{ pulse:98,  bpSystolic:172, bpDiastolic:112, respRate:18, temp:37.1, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Severe frontal headache. Visual disturbances (flashing lights). Right upper quadrant pain. 3+ pitting oedema bilateral legs. Urine protein 4+.', severity:'severe' }],
    diet:{ intake:'60%', type:'Normal pregnancy diet, low sodium', notes:'Nausea limiting intake. Vitamin supplementation continued. Close monitoring of fluid balance.' },
    sleep:{ hours:5.0, quality:'poor', notes:'Anxious about pregnancy. BP monitoring every 15 minutes. Foetal monitoring ongoing.' },
    history:{ pmh:'G2P1. Previous pregnancy uncomplicated. No prior hypertension or renal disease.', fh:'Mother — hypertension. No pre-eclampsia history.', sh:'School librarian. Non-smoker. Non-drinker during pregnancy. Married, supportive family.' },
    meds:[
      { name:'Labetalol',         dosage:'200mg',  route:'oral', freq:'three times daily',  times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Magnesium Sulphate',dosage:'4g IV loading then 1g/hr', route:'IV', freq:'continuous infusion', times:null, prn:false },
      { name:'Nifedipine',        dosage:'10mg',   route:'oral', freq:'PRN SBP >160',       times:null,                       prn:true  },
    ],
  },
  {
    id:'p19', name:'Mark Martinez',    mrn:'MRN0019', bed:'Ward A-8',
    dob:'1964-08-03', gender:'Male',   bloodGroup:'O-', contact:'9821019001',
    emergency:'Rosa Martinez (Wife) 9821019002',
    diagnosis:'Chronic Kidney Disease Stage 4 — Anaemia of CKD', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:78,  bpSystolic:152, bpDiastolic:94,  respRate:16, temp:36.7, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Fatigue and exertional dyspnoea (NYHA II). Bilateral ankle oedema (1+). Generalised pruritis. Haemoglobin 8.2 g/dL.', severity:'moderate' }],
    diet:{ intake:'75%', type:'Renal diet (low potassium, low phosphate, restricted fluid 1.5L/day)', notes:'Compliant with renal diet. Appetite reduced. Dietitian follow-up booked.' },
    sleep:{ hours:6.0, quality:'fair', notes:'Restless legs syndrome at night. Pruritis disturbing sleep. Gabapentin considered.' },
    history:{ pmh:'CKD Stage 4 (eGFR 22). T2DM (10 years). Hypertension. Anaemia. Declined dialysis counselling previously.', fh:'Father — ESRD on haemodialysis.', sh:'Bus driver (currently on medical leave). Non-smoker. Non-drinker.' },
    meds:[
      { name:'Amlodipine',        dosage:'10mg',       route:'oral', freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Erythropoietin',    dosage:'4000 units',  route:'SC',   freq:'three times/week', times:'["08:00"]',         prn:false },
      { name:'Calcium Carbonate', dosage:'500mg',       route:'oral', freq:'three times daily',times:'["08:00","13:00","20:00"]', prn:false },
      { name:'Folic Acid',        dosage:'5mg',         route:'oral', freq:'once daily',       times:'["08:00"]',         prn:false },
    ],
  },
  {
    id:'p20', name:'Karen Robinson',   mrn:'MRN0020', bed:'Ward B-7',
    dob:'1977-04-11', gender:'Female', bloodGroup:'A-', contact:'9821020001',
    emergency:'Gary Robinson (Husband) 9821020002',
    diagnosis:'Cellulitis Right Lower Leg (Non-purulent)', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:86,  bpSystolic:128, bpDiastolic:80,  respRate:16, temp:38.6, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Right leg: erythema (8x12cm, marked with pen), warmth, tenderness and swelling extending to ankle. Low-grade fever. No fluctuance or lymphangitis.', severity:'moderate' }],
    diet:{ intake:'85%', type:'Normal hospital diet', notes:'Good appetite. Adequate intake. Encouraging high fluid intake for antibiotic tolerance.' },
    sleep:{ hours:6.5, quality:'fair', notes:'Leg elevation maintained. Discomfort from swelling disturbing sleep.' },
    history:{ pmh:'Obesity (BMI 34). T2DM (well-controlled on diet). Recurrent cellulitis (2nd episode, same site).', fh:'No relevant family history.', sh:'Supermarket manager. Non-smoker. Moderate wine drinker.' },
    meds:[
      { name:'Flucloxacillin', dosage:'500mg', route:'oral', freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Paracetamol',    dosage:'1g',    route:'oral', freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p21', name:'Steven Clark',     mrn:'MRN0021', bed:'Ward C-6',
    dob:'1997-06-25', gender:'Male',   bloodGroup:'B+', contact:'9821021001',
    emergency:'Brian Clark (Father) 9821021002',
    diagnosis:'Mild Traumatic Brain Injury (GCS 14/15, CT: no bleed)', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:68,  bpSystolic:144, bpDiastolic:88,  respRate:14, temp:37.2, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Post-traumatic headache (5/10). Retrograde amnesia (last 30 min before injury). Dizziness on position change. No focal neurology.', severity:'moderate' }],
    diet:{ intake:'80%', type:'Normal diet', notes:'Good appetite. Tolerating all food types. Encouraged adequate hydration.' },
    sleep:{ hours:9.0, quality:'good', notes:'Sleeping well. GCS monitored hourly. No deterioration overnight.' },
    history:{ pmh:'No prior neurological conditions. Fit and healthy. Recreational cyclist (injury from bicycle accident).', fh:'No relevant family history.', sh:'University student. Non-smoker. Social drinker. Cyclist without helmet at time of injury.' },
    meds:[
      { name:'Paracetamol',    dosage:'1g',    route:'oral', freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Ondansetron',    dosage:'4mg',   route:'oral', freq:'PRN nausea',        times:null,                               prn:true  },
      { name:'Levetiracetam',  dosage:'500mg', route:'oral', freq:'twice daily (seizure prophylaxis)', times:'["08:00","20:00"]', prn:false },
    ],
  },
  {
    id:'p22', name:'Betty Rodriguez',  mrn:'MRN0022', bed:'Ward A-9',
    dob:'1941-12-30', gender:'Female', bloodGroup:'O+', contact:'9821022001',
    emergency:'Maria Rodriguez (Daughter) 9821022002',
    diagnosis:'Acute Confusional State secondary to Dehydration + UTI (on background of Dementia)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:116, bpSystolic:96,  bpDiastolic:58,  respRate:20, temp:38.0, spo2:95, levelOfConsciousness:'voice', supplementalO2:false },
    symptoms:[{ description:'Acute confusion (worse than baseline). Not recognising family. Agitation at night (sundowning). Dehydration clinically evident. Reduced urine output.', severity:'severe' }],
    diet:{ intake:'30%', type:'Pureed diet with thickened fluids (dementia-adapted)', notes:'Refuses food at times. IV fluids running at 125ml/hr. Carer/family assisting at mealtimes.' },
    sleep:{ hours:3.5, quality:'poor', notes:'Severely disturbed. Sundowning behaviour — shouting and attempting to get out of bed. 1:1 nursing. Soft restraint avoided.' },
    history:{ pmh:'Moderate Alzheimer\'s dementia (on donepezil). HTN. Osteoporosis. Multiple UTIs.', fh:'Family history of dementia.', sh:'Widower. Lives with daughter. Normally partially dependent for ADLs.' },
    meds:[
      { name:'Donepezil',     dosage:'10mg',  route:'oral', freq:'once daily',       times:'["21:00"]',         prn:false },
      { name:'Ceftriaxone',   dosage:'1g',    route:'IV',   freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Haloperidol',   dosage:'0.5mg', route:'oral', freq:'PRN severe agitation', times:null,            prn:true  },
      { name:'Amlodipine',    dosage:'5mg',   route:'oral', freq:'once daily',        times:'["08:00"]',        prn:false },
    ],
  },
  {
    id:'p23', name:'George Lewis',     mrn:'MRN0023', bed:'Ward B-8',
    dob:'1969-05-04', gender:'Male',   bloodGroup:'A+', contact:'9821023001',
    emergency:'Sharon Lewis (Wife) 9821023002',
    diagnosis:'Peptic Ulcer Disease with Upper GI Bleed (Haemostasis achieved endoscopically)', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:110, bpSystolic:98,  bpDiastolic:62,  respRate:18, temp:37.0, spo2:96, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Haematemesis on admission (now resolved post-endoscopy). Melaena ongoing. Epigastric pain (4/10). Dizziness on standing. Hb 7.8 g/dL.', severity:'severe' }],
    diet:{ intake:'0%', type:'Nil by mouth (6h post-endoscopy)', notes:'Recommencing clear liquids at 14:00. Monitor for rebleed. Transfusion 2 units PRBC ongoing.' },
    sleep:{ hours:5.5, quality:'fair', notes:'Anxious about rebleed. Monitoring overnight. Mild sedation avoided to preserve clinical assessment.' },
    history:{ pmh:'PUD (H. pylori positive, treated 2022). NSAID use (self-medicated for back pain). Alcohol (28 units/week).', fh:'Father — stomach cancer.', sh:'Lorry driver. Smoker (15/day). Heavy alcohol use.' },
    meds:[
      { name:'Omeprazole',     dosage:'80mg', route:'IV',   freq:'continuous infusion then BD', times:'["08:00","20:00"]', prn:false },
      { name:'Tranexamic Acid',dosage:'1g',   route:'IV',   freq:'three times daily',           times:'["08:00","14:00","20:00"]', prn:false },
    ],
  },
  {
    id:'p24', name:'Sandra Lee',       mrn:'MRN0024', bed:'Ward C-7',
    dob:'1983-09-19', gender:'Female', bloodGroup:'B-', contact:'9821024001',
    emergency:'Victor Lee (Husband) 9821024002',
    diagnosis:'Thyroid Storm (Burch-Wartofsky score 65)', allergies:'Iodine (historical)',
    ci:4, status:'active',
    vitals:{ pulse:148, bpSystolic:164, bpDiastolic:96,  respRate:26, temp:39.9, spo2:93, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Extreme agitation. Profuse sweating. Palpitations. Fine tremor both hands. Diarrhoea (4 episodes). Lid lag and exophthalmos. Goitre visible.', severity:'severe' }],
    diet:{ intake:'25%', type:'High calorie, high carbohydrate (to meet hypermetabolic demands)', notes:'Metabolic rate severely elevated. IV dextrose infusing. Oral intake very limited due to agitation.' },
    sleep:{ hours:1.5, quality:'poor', notes:'Severely agitated — unable to sleep. ICU transfer requested. Sedation being titrated.' },
    history:{ pmh:'Graves\' disease (diagnosed 3 months ago, treatment non-compliant). No prior thyroid crisis.', fh:'Mother — autoimmune thyroid disease.', sh:'Journalist. High-stress job. Non-smoker. Non-drinker. Stopped antithyroid medication 2 weeks ago.' },
    meds:[
      { name:'Propylthiouracil', dosage:'200mg',  route:'oral', freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Propranolol',      dosage:'40mg',   route:'oral', freq:'four times daily',  times:'["06:00","12:00","18:00","22:00"]', prn:false },
      { name:'Dexamethasone',    dosage:'8mg',    route:'IV',   freq:'once daily',         times:'["08:00"]',                        prn:false },
      { name:'Paracetamol',      dosage:'1g',     route:'IV',   freq:'four times daily (fever control)', times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p25', name:'Kenneth Walker',   mrn:'MRN0025', bed:'Ward A-10',
    dob:'1956-01-28', gender:'Male',   bloodGroup:'O+', contact:'9821025001',
    emergency:'Brenda Walker (Wife) 9821025002',
    diagnosis:'Infective Endocarditis (Streptococcal — Mitral Valve)', allergies:'Penicillin',
    ci:3, status:'active',
    vitals:{ pulse:104, bpSystolic:106, bpDiastolic:66,  respRate:18, temp:38.9, spo2:95, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Persistent fever. New pansystolic murmur (3/6). Splinter haemorrhages (bilateral fingernails). Osler\'s nodes (right finger). Fatigue and weight loss (5kg in 3 weeks).', severity:'severe' }],
    diet:{ intake:'55%', type:'High-protein, high-calorie diet', notes:'Weight loss of concern. Nutritional supplement prescribed. Appetite poor due to prolonged illness.' },
    sleep:{ hours:5.5, quality:'fair', notes:'Night sweats disturbing sleep. Bedding changes twice last night.' },
    history:{ pmh:'Mitral valve prolapse (known). Dental procedure 6 weeks ago (no prophylaxis given — GP oversight). T2DM.', fh:'No significant cardiac family history.', sh:'Retired postman. Non-smoker. Minimal alcohol. Poor dentition (barrier to prophylaxis).' },
    meds:[
      { name:'Vancomycin',   dosage:'1g',    route:'IV',   freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Gentamicin',   dosage:'80mg',  route:'IV',   freq:'once daily',   times:'["08:00"]',         prn:false },
      { name:'Paracetamol',  dosage:'1g',    route:'oral', freq:'four times daily', times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p26', name:'Helen Hall',       mrn:'MRN0026', bed:'Ward B-9',
    dob:'1960-07-07', gender:'Female', bloodGroup:'A+', contact:'9821026001',
    emergency:'Jim Hall (Husband) 9821026002',
    diagnosis:'Rheumatoid Arthritis — Acute Polyarticular Flare', allergies:'Sulfonamides',
    ci:2, status:'active',
    vitals:{ pulse:80,  bpSystolic:130, bpDiastolic:84,  respRate:16, temp:37.9, spo2:98, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Bilateral wrist, MCP and PIP joint swelling, warmth and erythema. Morning stiffness >2 hours. DAS28 score 5.8 (high disease activity). CRP 64 mg/L.', severity:'moderate' }],
    diet:{ intake:'80%', type:'Anti-inflammatory diet (Mediterranean pattern)', notes:'Good compliance with dietary advice. Omega-3 supplement being taken. Adequate intake.' },
    sleep:{ hours:5.5, quality:'poor', notes:'Morning stiffness begins on waking. Sleep disrupted by joint pain from midnight. Positioning with pillow supports helps.' },
    history:{ pmh:'RA (seropositive) diagnosed 2005. Multiple biologics tried. Currently on Methotrexate + Adalimumab. Osteopenia (DEXA 2023).', fh:'Mother — RA. Sister — SLE.', sh:'Retired florist. Non-smoker. Non-drinker. Good family support.' },
    meds:[
      { name:'Methotrexate',    dosage:'15mg',  route:'oral', freq:'once weekly (Monday)', times:'["08:00"]',         prn:false },
      { name:'Folic Acid',      dosage:'5mg',   route:'oral', freq:'once daily (not Mon)', times:'["08:00"]',         prn:false },
      { name:'Prednisolone',    dosage:'20mg',  route:'oral', freq:'once daily (reducing)', times:'["08:00"]',        prn:false },
      { name:'Naproxen',        dosage:'500mg', route:'oral', freq:'twice daily with food', times:'["08:00","20:00"]',prn:false },
    ],
  },
  {
    id:'p27', name:'Edward Allen',     mrn:'MRN0027', bed:'Ward C-8',
    dob:'1992-03-16', gender:'Male',   bloodGroup:'SS', contact:'9821027001',
    emergency:'Tanya Allen (Mother) 9821027002',
    diagnosis:'Sickle Cell Disease — Acute Vaso-occlusive Crisis', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:108, bpSystolic:116, bpDiastolic:74,  respRate:22, temp:38.5, spo2:93, levelOfConsciousness:'alert', supplementalO2:true  },
    symptoms:[{ description:'Severe bilateral hip and lower back pain (9/10 at peak, currently 7/10). Tachycardia. Oxygen requirement increased from baseline. Last crisis 3 months ago.', severity:'severe' }],
    diet:{ intake:'60%', type:'Normal diet with high fluid intake (3L/day)', notes:'Appetite reduced due to pain. IV fluids running. Encouraging oral intake between analgesic doses.' },
    sleep:{ hours:3.5, quality:'poor', notes:'Pain preventing sleep. Requesting additional analgesia at 03:00. Pain nurse specialist involved.' },
    history:{ pmh:'Sickle Cell Disease (HbSS). Previous admissions (8 in last 3 years). Avascular necrosis bilateral hips. On Hydroxyurea.', fh:'Both parents — sickle cell trait.', sh:'Part-time student. Non-smoker. Non-drinker. Lives with mother.' },
    meds:[
      { name:'Morphine',       dosage:'10mg',  route:'IV',   freq:'PRN (NCA pump)', times:null,              prn:true  },
      { name:'Morphine SR',    dosage:'30mg',  route:'oral', freq:'twice daily',    times:'["08:00","20:00"]',prn:false },
      { name:'Folic Acid',     dosage:'5mg',   route:'oral', freq:'once daily',     times:'["08:00"]',        prn:false },
      { name:'Hydroxyurea',    dosage:'500mg', route:'oral', freq:'once daily',     times:'["08:00"]',        prn:false },
      { name:'Paracetamol',    dosage:'1g',    route:'oral', freq:'four times daily',times:'["06:00","12:00","18:00","22:00"]', prn:false },
    ],
  },
  {
    id:'p28', name:'Dorothy Young',    mrn:'MRN0028', bed:'Ward A-11',
    dob:'1947-10-02', gender:'Female', bloodGroup:'O+', contact:'9821028001',
    emergency:'Frank Young (Son) 9821028002',
    diagnosis:'Complete (3rd Degree) Heart Block — Awaiting Pacemaker Implant', allergies:'None known',
    ci:4, status:'active',
    vitals:{ pulse:36,  bpSystolic:82,  bpDiastolic:50,  respRate:18, temp:36.8, spo2:90, levelOfConsciousness:'voice', supplementalO2:true  },
    symptoms:[{ description:'Profound bradycardia. Pre-syncopal episodes (2 today). Severe fatigue. Diaphoresis. Haemodynamically compromised. Temporary pacing wire in situ.', severity:'severe' }],
    diet:{ intake:'20%', type:'Cardiac diet — light, easy-to-eat', notes:'Severely limited intake due to fatigue and haemodynamic instability. IV fluids. NBM from midnight for procedure.' },
    sleep:{ hours:4.0, quality:'poor', notes:'Continuous cardiac monitoring. Nursing 1:1. Multiple alarms disturbing. Sedation avoided to maintain assessment.' },
    history:{ pmh:'Hypertension (30 years). Hypothyroidism. LBBB noted on ECG 5 years ago (no further investigation). Previous AF.', fh:'Father — pacemaker at 72.', sh:'Retired teacher. Widower. Lives with son\'s family.' },
    meds:[
      { name:'Atropine',       dosage:'0.5mg', route:'IV',   freq:'PRN HR <30',    times:null,                       prn:true  },
      { name:'Dopamine',       dosage:'5mcg/kg/min', route:'IV', freq:'continuous infusion', times:null,            prn:false },
      { name:'Levothyroxine',  dosage:'50mcg', route:'oral', freq:'once daily',    times:'["07:00"]',                prn:false },
    ],
  },
  {
    id:'p29', name:'Brian King',       mrn:'MRN0029', bed:'Ward B-10',
    dob:'1971-08-14', gender:'Male',   bloodGroup:'B+', contact:'9821029001',
    emergency:'Cathy King (Sister) 9821029002',
    diagnosis:'Decompensated Liver Cirrhosis (Child-Pugh Class C) with Tense Ascites', allergies:'None known',
    ci:3, status:'active',
    vitals:{ pulse:96,  bpSystolic:98,  bpDiastolic:62,  respRate:18, temp:37.7, spo2:95, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Grossly distended abdomen (tense ascites — drained 4L at paracentesis yesterday). Spider naevi and palmar erythema. Jaundice (bilirubin 68). Asterixis (grade 1).', severity:'severe' }],
    diet:{ intake:'50%', type:'High-protein (1.2g/kg/day), low sodium (88mmol/day)', notes:'Encephalopathy risk — avoid protein restriction. Small frequent meals. Nutritional supplement.' },
    sleep:{ hours:6.0, quality:'fair', notes:'Sleep-wake cycle inversion (encephalopathy-related). Mild daytime somnolence. Nocturnal wakefulness.' },
    history:{ pmh:'Alcoholic liver cirrhosis (diagnosed 2019). Previous variceal bleed (2022, banded). Spontaneous bacterial peritonitis (2023). Alcohol use disorder.', fh:'Father — alcoholic liver disease.', sh:'Formerly a chef. Alcohol use disorder — abstinent for 8 months. Lives alone.' },
    meds:[
      { name:'Spironolactone', dosage:'100mg', route:'oral', freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Furosemide',     dosage:'40mg',  route:'oral', freq:'once daily',       times:'["08:00"]',         prn:false },
      { name:'Lactulose',      dosage:'30ml',  route:'oral', freq:'three times daily',times:'["08:00","14:00","20:00"]', prn:false },
      { name:'Propranolol',    dosage:'40mg',  route:'oral', freq:'twice daily',      times:'["08:00","20:00"]', prn:false },
      { name:'Terlipressin',   dosage:'1mg',   route:'IV',   freq:'PRN variceal bleed', times:null,             prn:true  },
    ],
  },
  {
    id:'p30', name:'Carol Wright',     mrn:'MRN0030', bed:'Ward C-9',
    dob:'1985-11-30', gender:'Female', bloodGroup:'A+', contact:'9821030001',
    emergency:'Ian Wright (Husband) 9821030002',
    diagnosis:'Systemic Lupus Erythematosus — Lupus Nephritis Class III Flare', allergies:'None known',
    ci:2, status:'active',
    vitals:{ pulse:88,  bpSystolic:142, bpDiastolic:90,  respRate:16, temp:38.1, spo2:97, levelOfConsciousness:'alert', supplementalO2:false },
    symptoms:[{ description:'Malar rash (butterfly distribution). Bilateral wrist arthritis. Proteinuria 3+. Fatigue (severe). Anti-dsDNA titre elevated. Complement C3/C4 low.', severity:'moderate' }],
    diet:{ intake:'75%', type:'Low sodium, high protein (nephritis support)', notes:'Adequate intake. Advised to avoid sun exposure. Vitamin D supplementation.' },
    sleep:{ hours:6.5, quality:'fair', notes:'Joint pain causing early morning waking. Fatigue disproportionate to sleep hours — disease-related.' },
    history:{ pmh:'SLE (diagnosed 2015). Lupus nephritis (previous episode 2020 — responded to MMF). Antiphospholipid syndrome.', fh:'Sister — SLE. Mother — Sjögren\'s syndrome.', sh:'Graphic novelist. Non-smoker. Non-drinker. Married with one child (age 5).' },
    meds:[
      { name:'Hydroxychloroquine', dosage:'200mg',  route:'oral', freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Prednisolone',       dosage:'40mg',   route:'oral', freq:'once daily',   times:'["08:00"]',         prn:false },
      { name:'Mycophenolate Mofetil', dosage:'1g',  route:'oral', freq:'twice daily',  times:'["08:00","20:00"]', prn:false },
      { name:'Warfarin',           dosage:'5mg',    route:'oral', freq:'once daily (APS)', times:'["17:00"]',     prn:false },
    ],
  },
];

// ─── SEED ────────────────────────────────────────────────────────────────────
async function seed() {
  await initDb(db);
  await run('SELECT 1'); // sync barrier

  // Wipe
  const tables = [
    'HandoverNotes','Tasks','Escalations','MedicationAdministrations',
    'Medications','DailyStats','Patients','PharmacyBatches',
    'PharmacyTransactions','PharmacyStock','Users',
  ];
  for (const t of tables) await run(`DELETE FROM ${t}`);

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('Seeding users…');
  const [adminHash, doctorHash, nurseHash, pharmacistHash] = await Promise.all([
    bcrypt.hash('admin123', 10),
    bcrypt.hash('doctor123', 10),
    bcrypt.hash('nurse123', 10),
    bcrypt.hash('pharma123', 10),
  ]);
  const users = [
    ['u-admin',      TENANT, 'Admin User',   'admin',      adminHash],
    ['u-doctor',     TENANT, 'Dr. Smith',    'doctor',     doctorHash],
    ['u-doctor2',    TENANT, 'Dr. Patel',    'doctor',     doctorHash],
    ['u-nurse',      TENANT, 'Nurse Joy',    'nurse',      nurseHash],
    ['u-nurse2',     TENANT, 'Nurse Riya',   'nurse',      nurseHash],
    ['u-pharmacist', TENANT, 'PharmD Jones', 'pharmacist', pharmacistHash],
  ];
  for (const u of users)
    await run('INSERT INTO Users (id,tenantId,name,role,passwordHash) VALUES (?,?,?,?,?)', u);

  // ── Patients ───────────────────────────────────────────────────────────────
  console.log(`Seeding ${PATIENTS.length} patients…`);
  for (const p of PATIENTS) {
    await run(
      `INSERT INTO Patients (id,tenantId,name,mrn,bedNumber,dob,diagnosis,allergies,careIntensity,status,gender,bloodGroup,contactNumber,emergencyContact)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, TENANT, p.name, p.mrn, p.bed, p.dob, p.diagnosis, p.allergies,
       p.ci, p.status, p.gender, p.bloodGroup, p.contact, p.emergency]
    );

    // Vitals
    await run(
      'INSERT INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, p.id, 'vital', JSON.stringify(p.vitals), 'Dr. Smith', ago(2)]
    );

    // Symptoms
    for (const s of p.symptoms)
      await run(
        'INSERT INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
        [crypto.randomUUID(), TENANT, p.id, 'symptom', JSON.stringify(s), 'Nurse Joy', ago(3)]
      );

    // Diet
    await run(
      'INSERT INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, p.id, 'diet', JSON.stringify(p.diet), 'Nurse Joy', ago(4)]
    );

    // Sleep
    await run(
      'INSERT INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, p.id, 'sleep', JSON.stringify(p.sleep), 'Nurse Joy', ago(8)]
    );

    // History
    await run(
      'INSERT INTO DailyStats (id,tenantId,patientId,type,data,recordedBy,timestamp) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, p.id, 'history', JSON.stringify(p.history), 'Dr. Smith', ago(24)]
    );

    // Medications
    for (const m of p.meds) {
      await run(
        `INSERT INTO Medications (id,tenantId,patientId,name,dosage,route,frequency,scheduledTimes,prn,startDate,prescribedBy,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [crypto.randomUUID(), TENANT, p.id, m.name, m.dosage, m.route, m.freq,
         m.times, m.prn ? 1 : 0, '2026-05-01', 'Dr. Smith', 'active']
      );
    }
  }

  // ── Escalations (critical patients) ────────────────────────────────────────
  console.log('Seeding escalations…');
  const escalations = [
    ['p05', 'NEWS2 score 9 — SpO2 89%, HR 118, RR 28. Immediate senior review required.', 'pending'],
    ['p13', 'Cardiogenic shock post-STEMI. BP 88/54. CCU bed requested urgently.', 'pending'],
    ['p18', 'Severe preeclampsia — BP 172/112. Consultant obstetrics notified. Delivery being considered.', 'pending'],
    ['p24', 'Thyroid storm (BWS 65). ICU transfer arranged. Endocrinology attending.', 'pending'],
    ['p28', 'Complete heart block, HR 36. Temporary pacing wire in situ. Cardiology for permanent pacemaker.', 'reviewed'],
    ['p07', 'Pneumonia — SpO2 92% despite 4L O2. Consider respiratory HDU.', 'reviewed'],
  ];
  for (const [pId, reason, status] of escalations)
    await run(
      'INSERT INTO Escalations (id,tenantId,patientId,reason,escalatedBy,status,timestamp) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, pId, reason, 'Nurse Joy', status, ago(Math.random() * 6)]
    );

  // ── Tasks ──────────────────────────────────────────────────────────────────
  console.log('Seeding tasks…');
  const tasks = [
    ['p05', 'vital',      1,  'Nurse Joy',  'open',      null,          null],
    ['p13', 'vital',      1,  'Nurse Joy',  'open',      null,          null],
    ['p18', 'assessment', 2,  'Dr. Smith',  'open',      null,          null],
    ['p07', 'vital',      2,  'Nurse Riya', 'open',      null,          null],
    ['p09', 'vital',      3,  'Nurse Riya', 'open',      null,          null],
    ['p27', 'assessment', 4,  'Dr. Patel',  'open',      null,          null],
    ['p24', 'vital',      0.5,'Nurse Joy',  'open',      null,          null],
    ['p01', 'followup',  -2,  'Dr. Smith',  'completed', 'Dr. Smith',   ago(1.5)],
    ['p10', 'followup',  -3,  'Nurse Joy',  'completed', 'Nurse Joy',   ago(2)],
    ['p20', 'assessment',-1,  'Dr. Patel',  'completed', 'Dr. Patel',   ago(0.5)],
  ];
  for (const [pId, type, hoursFromNow, assignee, status, completedBy, completedAt] of tasks)
    await run(
      'INSERT INTO Tasks (id,tenantId,patientId,type,dueAt,status,assignee,createdBy,completedBy,completedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, pId, type, ago(-hoursFromNow), status, assignee, 'Dr. Smith', completedBy, completedAt]
    );

  // ── Handover notes ─────────────────────────────────────────────────────────
  console.log('Seeding handover notes…');
  const notes = [
    ['p05', 'morning', 'Patient remains critical. SpO2 89% on high-flow O2. Furosemide 80mg IV given. Family at bedside. Escalation raised. Consultant review at 10:00.', '["critical","oxygen","family"]'],
    ['p13', 'morning', 'Post-PCI Day 1. BP borderline at 88/54. Cardiologist reviewed — continue inotropes. Repeat echo at 14:00. CCU transfer pending bed availability.', '["post-pci","critical","echo"]'],
    ['p07', 'morning', 'Pneumonia Day 3. Sputum culture — Strep pneumoniae sensitive to Ceftriaxone. Fever persisting (38.6°C). SpO2 improved slightly to 92% on 4L O2.', '["fever","infection","culture"]'],
    ['p09', 'morning', 'COPD exacerbation. SpO2 88% on controlled O2 at 28% venti-mask. ABG: pH 7.33, PaCO2 58. NIV discussed with patient — declined initially.', '["copd","o2","niv"]'],
    ['p18', 'morning', 'Preeclampsia 32wks. MgSO4 infusion running. BP 172/112 — nifedipine 10mg given, BP now 148/96. CTG reassuring. Obstetric MDT at 11:00.', '["obstetrics","bp","ctg"]'],
    ['p01', 'evening', 'T2DM — blood glucose stable 7.2 mmol/L post-dinner. Metformin tolerated. Patient walked to bathroom independently. Mood good.', '["stable","diabetes"]'],
    ['p03', 'evening', 'Post-op Day 3. Pain 4/10 controlled on Tramadol. Mobilised with physiotherapist — walked 10m with frame. DVT prophylaxis given.', '["post-op","mobilisation","pain"]'],
    ['p27', 'evening', 'Sickle cell crisis. Pain 7/10 despite NCA pump. PCA reviewed — basal rate increased to 2mg/hr. Haematology aware. SpO2 93% on 2L O2.', '["pain","sickle-cell","haematology"]'],
    ['p29', 'evening', 'Cirrhosis. Post-paracentesis Day 1 (4L drained). Abdomen less tense. Lactulose — 2 soft stools today. Asterixis grade 1, unchanged.', '["cirrhosis","ascites","encephalopathy"]'],
    ['p24', 'evening', 'Thyroid storm. HR 148 — propranolol 40mg given, HR now 128. Temp 39.9°C — cooling blanket applied. ICU bed confirmed for morning.', '["thyroid","icu","critical"]'],
  ];
  for (const [pId, shift, note, tags] of notes)
    await run(
      'INSERT INTO HandoverNotes (id,tenantId,patientId,shift,note,tags,createdBy,timestamp) VALUES (?,?,?,?,?,?,?,?)',
      [crypto.randomUUID(), TENANT, pId, shift, note, tags, 'Nurse Joy', ago(Math.random() * 4)]
    );

  // ── Pharmacy stock ─────────────────────────────────────────────────────────
  console.log('Seeding pharmacy stock…');
  const stockItems = [
    {
      name:'Amoxicillin', composition:'500mg', type:'Capsule', category:'Antibiotics',
      qpu:10, unit:'Strip', iunit:'Capsules', cpu:5.50,
      batches:[
        { lot:'AMX-A01', exp:'2026-06-30', qty:150, cost:5.50, mfr:'Cipla Ltd' },
        { lot:'AMX-A02', exp:'2026-09-30', qty:200, cost:5.25, mfr:'Cipla Ltd' },
        { lot:'AMX-A03', exp:'2027-03-31', qty:150, cost:5.75, mfr:'Sun Pharma' },
      ],
    },
    {
      name:'Metformin SR', composition:'500mg SR', type:'Tablet', category:'Anti-diabetics',
      qpu:15, unit:'Strip', iunit:'Tablets', cpu:1.20,
      batches:[
        { lot:'MET-B01', exp:'2027-01-31', qty:300, cost:1.20, mfr:'Sun Pharma' },
        { lot:'MET-B02', exp:'2027-06-30', qty:450, cost:1.15, mfr:'Cipla Ltd' },
      ],
    },
    {
      name:'Furosemide', composition:'40mg', type:'Tablet', category:'Diuretics',
      qpu:10, unit:'Strip', iunit:'Tablets', cpu:2.80,
      batches:[
        { lot:'FUR-C01', exp:'2026-08-31', qty:100, cost:2.80, mfr:'Cipla Ltd' },
        { lot:'FUR-C02', exp:'2027-02-28', qty:200, cost:2.75, mfr:'Cipla Ltd' },
      ],
    },
    {
      name:'Paracetamol', composition:'1g', type:'Tablet', category:'Analgesics',
      qpu:10, unit:'Strip', iunit:'Tablets', cpu:0.50,
      batches:[
        { lot:'PAR-D01', exp:'2027-04-30', qty:500, cost:0.50, mfr:'GSK' },
        { lot:'PAR-D02', exp:'2027-10-31', qty:500, cost:0.48, mfr:'GSK' },
      ],
    },
    {
      name:'Ceftriaxone', composition:'1g', type:'Injection', category:'Antibiotics',
      qpu:1, unit:'Vial', iunit:'Vials', cpu:45.00,
      batches:[
        { lot:'CEF-E01', exp:'2026-12-31', qty:60, cost:45.00, mfr:'Roche' },
        { lot:'CEF-E02', exp:'2027-06-30', qty:60, cost:44.00, mfr:'Roche' },
      ],
    },
    {
      name:'Morphine Sulphate', composition:'10mg/ml', type:'Injection', category:'Opioid Analgesics',
      qpu:1, unit:'Ampoule', iunit:'Ampoules', cpu:12.00,
      batches:[
        { lot:'MOR-F01', exp:'2027-01-31', qty:50, cost:12.00, mfr:'Hameln' },
        { lot:'MOR-F02', exp:'2027-07-31', qty:50, cost:11.50, mfr:'Hameln' },
      ],
    },
    {
      name:'Prednisolone', composition:'5mg', type:'Tablet', category:'Corticosteroids',
      qpu:28, unit:'Pack', iunit:'Tablets', cpu:1.80,
      batches:[
        { lot:'PRE-G01', exp:'2026-11-30', qty:280, cost:1.80, mfr:'Actavis' },
        { lot:'PRE-G02', exp:'2027-05-31', qty:280, cost:1.75, mfr:'Actavis' },
      ],
    },
    {
      name:'Enoxaparin', composition:'40mg/0.4ml', type:'Injection', category:'Anticoagulants',
      qpu:1, unit:'Syringe', iunit:'Syringes', cpu:8.50,
      batches:[
        { lot:'ENO-H01', exp:'2026-10-31', qty:80, cost:8.50, mfr:'Sanofi' },
        { lot:'ENO-H02', exp:'2027-04-30', qty:80, cost:8.25, mfr:'Sanofi' },
      ],
    },
  ];

  for (const item of stockItems) {
    const sid = crypto.randomUUID();
    const totalQty = item.batches.reduce((s, b) => s + b.qty, 0);
    await run(
      'INSERT INTO PharmacyStock (id,tenantId,name,composition,type,category,quantityPerUnit,totalUnits,totalQuantity,unit,itemUnit,costPerUnit,expiryDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [sid, TENANT, item.name, item.composition, item.type, item.category,
       item.qpu, Math.floor(totalQty / item.qpu), totalQty, item.unit, item.iunit, item.cpu, item.batches[0].exp]
    );
    for (const b of item.batches)
      await run(
        'INSERT INTO PharmacyBatches (id,tenantId,stockId,batchNumber,expiryDate,quantity,costPerUnit,manufacturer,receivedDate,status) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [crypto.randomUUID(), TENANT, sid, b.lot, b.exp, b.qty, b.cost, b.mfr, '2026-01-15', 'active']
      );
    console.log(`  ✓ ${item.name}: ${item.batches.length} batches, ${totalQty} units`);
  }

  console.log('\n✓ Test database seeded successfully.');
  console.log('─────────────────────────────────────────────────────');
  console.log('  Admin        → "Admin User"    password: admin123');
  console.log('  Doctor 1     → "Dr. Smith"     password: doctor123');
  console.log('  Doctor 2     → "Dr. Patel"     password: doctor123');
  console.log('  Nurse 1      → "Nurse Joy"     password: nurse123');
  console.log('  Nurse 2      → "Nurse Riya"    password: nurse123');
  console.log('  Pharmacist   → "PharmD Jones"  password: pharma123');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Patients: ${PATIENTS.length} | Medications: ${PATIENTS.reduce((s,p)=>s+p.meds.length,0)}`);
  console.log(`  Escalations: 6 | Tasks: 10 | Handover notes: 10`);
  console.log('─────────────────────────────────────────────────────\n');

  db.close();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  db.close();
  process.exit(1);
});
