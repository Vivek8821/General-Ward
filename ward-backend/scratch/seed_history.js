const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const db = new sqlite3.Database('ward.db');

const histories = [
    {
        patientId: 'p1', // John Doe
        data: {
            conditions: ['Type 2 Diabetes', 'Hyperlipidemia'],
            pastSurgeries: ['Appendectomy (2005)'],
            familyHistory: ['Father: Type 2 Diabetes', 'Mother: Hypertension'],
            socialHistory: ['Non-smoker', 'Social drinker'],
            notes: 'Patient compliant with Metformin. Monitoring HbA1c.'
        }
    },
    {
        patientId: 'p2', // Jane Roe
        data: {
            conditions: ['Hypertension'],
            pastSurgeries: ['Cholecystectomy (2018)'],
            familyHistory: ['Strong history of CAD'],
            socialHistory: ['Non-smoker'],
            notes: 'Occasional migraines managed with over-the-counter meds.'
        }
    },
    {
        patientId: 'p3', // Robert Smith
        data: {
            conditions: ['Post-Op Hip Replacement', 'Osteoarthritis'],
            pastSurgeries: ['Total Hip Replacement (Recent)', 'Knee Arthroscopy (2012)'],
            familyHistory: ['Brother: Osteoarthritis'],
            socialHistory: ['Retires', 'Sedentary lifestyle'],
            notes: 'Pain management optimized post-surgery.'
        }
    },
    {
        patientId: 'p4', // Alice Williams
        data: {
            conditions: ['Acute Bronchitis', 'Asthma'],
            pastSurgeries: ['Tonsillectomy (1995)'],
            familyHistory: ['Mother: Asthma'],
            socialHistory: ['Ex-smoker (quit 5 years ago)'],
            notes: 'Seasonal allergy triggers.'
        }
    },
    {
        patientId: 'p5', // Michael Brown
        data: {
            conditions: ['Congestive Heart Failure', 'Atrial Fibrillation'],
            pastSurgeries: ['CABG (2015)', 'Stent placement (2020)'],
            familyHistory: ['Father: MI at age 50'],
            socialHistory: ['Non-drinker'],
            notes: 'Strict fluid restriction. Daily weight monitoring.'
        }
    },
    {
        patientId: 'p6', // Emily Davis
        data: {
            conditions: ['Appendicitis'],
            pastSurgeries: ['None prior to admission'],
            familyHistory: ['Unremarkable'],
            socialHistory: ['Student', 'Active'],
            notes: 'Initial presentation with RLQ pain.'
        }
    },
    {
        patientId: 'p7', // William Wilson
        data: {
            conditions: ['Pneumonia'],
            pastSurgeries: ['Hernia repair (2010)'],
            familyHistory: ['Father: COPD'],
            socialHistory: ['Current smoker (1 pack/day)'],
            notes: 'Cessation counseling provided.'
        }
    },
    {
        patientId: 'p8', // Sarah Miller
        data: {
            conditions: ['Gastroenteritis'],
            pastSurgeries: ['None'],
            familyHistory: ['Sister: Crohn\'s disease'],
            socialHistory: ['Non-smoker'],
            notes: 'Dehydrated on admission. Rehydration protocol started.'
        }
    },
    {
        patientId: 'p9', // James Taylor
        data: {
            conditions: ['COPD Exacerbation'],
            pastSurgeries: ['Cataract surgery (2022)'],
            familyHistory: ['Brother: Lung cancer'],
            socialHistory: ['Long-term heavy smoker (40 pack-years)'],
            notes: 'Home oxygen user (2L/min).'
        }
    },
    {
        patientId: 'p10', // Linda Anderson
        data: {
            conditions: ['Urinary Tract Infection'],
            pastSurgeries: ['Hysterectomy (2014)'],
            familyHistory: ['Unremarkable'],
            socialHistory: ['Active senior'],
            notes: 'Recurrent UTIs in the past year.'
        }
    },
    {
        patientId: 'p11', // David Thomas
        data: {
            conditions: ['Dengue Fever'],
            pastSurgeries: ['None'],
            familyHistory: ['Father: G6PD deficiency'],
            socialHistory: ['Recent travel to tropical area'],
            notes: 'Monitoring platelet counts daily.'
        }
    },
    {
        patientId: 'p12', // Susan Moore
        data: {
            conditions: ['Migraine'],
            pastSurgeries: ['C-section x2'],
            familyHistory: ['Mother: Migraines'],
            socialHistory: ['Works in high-stress environment'],
            notes: 'Known triggers: Caffeine and lack of sleep.'
        }
    }
];

db.serialize(() => {
    // Optional: Clear existing history to avoid duplicates
    db.run("DELETE FROM DailyStats WHERE type = 'history'");

    const stmt = db.prepare("INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    for (const h of histories) {
        stmt.run(
            crypto.randomUUID(),
            'tenant-default',
            h.patientId,
            'history',
            JSON.stringify(h.data),
            'Clinical Seeder',
            new Date().toISOString()
        );
    }
    
    stmt.finalize();
    console.log("Mock medical history seeded for all patients.");
    db.close();
});
