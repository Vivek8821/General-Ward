const DISEASE_CATEGORIES = {
  'Respiratory': [
    'pneumonia', 'asthma', 'copd', 'bronchitis', 'tuberculosis', 'tb',
    'pleural effusion', 'pneumothorax', 'ards', 'respiratory failure',
    'bronchiectasis', 'interstitial lung', 'pulmonary edema'
  ],
  'Cardiovascular': [
    'hypertension', 'heart failure', 'chf', 'myocardial infarction', 'mi',
    'cad', 'coronary', 'arrhythmia', 'atrial fibrillation', 'afib',
    'stroke', 'cva', 'dvt', 'pulmonary embolism', 'pe', 'pericarditis',
    'cardiomyopathy', 'angina', 'valvular'
  ],
  'Infectious': [
    'uti', 'urinary tract', 'sepsis', 'cellulitis', 'abscess', 'meningitis',
    'gastroenteritis', 'typhoid', 'malaria', 'dengue', 'chikungunya',
    'leptospirosis', 'hiv', 'aids', 'tb', 'endocarditis', 'osteomyelitis',
    'pyelonephritis', 'erysipelas', 'impetigo'
  ],
  'Endocrine/Metabolic': [
    'diabetes', 'dm', 'hypothyroid', 'hyperthyroid', 'dka', 'hhnk',
    'hypoglycemia', 'obesity', 'metabolic syndrome', 'cushing',
    'addison', 'hyperlipidemia', 'electrolyte imbalance'
  ],
  'Gastrointestinal': [
    'hepatitis', 'cirrhosis', 'pancreatitis', 'cholecystitis', 'appendicitis',
    'gastritis', 'gerd', 'peptic ulcer', 'ibd', 'crohn', 'ulcerative colitis',
    'gi bleed', 'hemorrhage', 'bowel obstruction', 'diverticulitis',
    'choledocholithiasis'
  ],
  'Renal': [
    'ckd', 'aki', 'renal failure', 'kidney', 'nephritis', 'nephrotic',
    'nephrolithiasis', 'renal calculi', 'hydronephrosis', 'electrolyte',
    'hyperkalemia', 'hyponatremia'
  ],
  'Neurological': [
    'epilepsy', 'seizure', 'migraine', 'parkinson', 'alzheimer', 'dementia',
    'neuropathy', 'multiple sclerosis', 'ms', 'guillain-barre', 'meningitis',
    'encephalitis', 'subdural', 'intracranial hemorrhage', 'subarachnoid',
    'transient ischemic', 'tia', 'bells palsy'
  ],
  'Musculoskeletal': [
    'fracture', 'arthritis', 'osteoarthritis', 'oa', 'rheumatoid', 'ra',
    'back pain', 'spondylitis', 'osteoporosis', 'gout', 'tendonitis',
    'bursitis', 'sciatica', 'disc', 'spondylosis', 'myalgia'
  ],
  'Psychiatric': [
    'depression', 'anxiety', 'schizophrenia', 'bipolar', 'ptsd',
    'ocd', 'substance', 'alcohol', 'withdrawal', 'psychosis',
    'delirium', 'dementia'
  ],
  'Trauma/Injury': [
    'trauma', 'injury', 'rta', 'road traffic', 'fall', 'burn',
    'concussion', 'laceration', 'contusion', 'hematoma', 'fracture',
    'dislocation', 'amputation', 'blast'
  ],
  'Obstetric/Gynecological': [
    'pregnancy', 'delivery', 'postpartum', 'menorrhagia', 'pid',
    'endometriosis', 'ovarian cyst', 'fibroid', 'eclampsia',
    'preeclampsia', 'abortion', 'miscarriage', 'ectopic'
  ],
  'Oncological': [
    'cancer', 'carcinoma', 'malignancy', 'leukemia', 'lymphoma',
    'sarcoma', 'melanoma', 'tumor', 'neoplasm', 'metastasis',
    'chemotherapy', 'radiation'
  ]
};

class DiseaseCategorizer {
  categorize(diagnosis) {
    if (!diagnosis || typeof diagnosis !== 'string') return 'Other';
    const lower = diagnosis.toLowerCase().trim();

    const scores = {};
    for (const [category, keywords] of Object.entries(DISEASE_CATEGORIES)) {
      scores[category] = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          scores[category] += kw.split(' ').length;
        }
      }
    }

    const best = Object.entries(scores)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    return best.length > 0 ? best[0][0] : 'Other';
  }

  getCategories() {
    return Object.keys(DISEASE_CATEGORIES);
  }
}

module.exports = new DiseaseCategorizer();
