if (process.env.NODE_ENV === 'production' || process.env.DB_DIALECT === 'postgres') {
  console.error('ERROR: comprehensive_seeder.js must not run in production or against PostgreSQL. Aborting.');
  process.exit(1);
}

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const db = new sqlite3.Database('ward.db');

const patients = [
    { id: 'p1', name: 'John Doe', diagnosis: 'Type 2 Diabetes', tenantId: 'tenant-default' },
    { id: 'p2', name: 'Jane Roe', diagnosis: 'Hypertension', tenantId: 'tenant-default' },
    { id: 'p3', name: 'Robert Smith', diagnosis: 'Post-Op Hip Replacement', tenantId: 'tenant-default' },
    { id: 'p4', name: 'Alice Williams', diagnosis: 'Acute Bronchitis', tenantId: 'tenant-default' },
    { id: 'p5', name: 'Michael Brown', diagnosis: 'Congestive Heart Failure', tenantId: 'tenant-default' },
    { id: 'p6', name: 'Emily Davis', diagnosis: 'Appendicitis', tenantId: 'tenant-default' },
    { id: 'p7', name: 'William Wilson', diagnosis: 'Pneumonia', tenantId: 'tenant-default' },
    { id: 'p8', name: 'Sarah Miller', diagnosis: 'Gastroenteritis', tenantId: 'tenant-default' },
    { id: 'p9', name: 'James Taylor', diagnosis: 'COPD Exacerbation', tenantId: 'tenant-default' },
    { id: 'p10', name: 'Linda Anderson', diagnosis: 'Urinary Tract Infection', tenantId: 'tenant-default' },
    { id: 'p11', name: 'David Thomas', diagnosis: 'Dengue Fever', tenantId: 'tenant-default' },
    { id: 'p12', name: 'Susan Moore', diagnosis: 'Migraine', tenantId: 'tenant-default' }
];

const recordedBy = 'System Seeder';
const prescribedBy = 'Dr. Smith';

async function seed() {
    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, (err) => err ? reject(err) : resolve());
    });

    try {
        console.log('Starting comprehensive data seeding...');

        // Clear existing data to avoid mess
        await run("DELETE FROM DailyStats WHERE type != 'history'");
        await run("DELETE FROM Medications");
        await run("DELETE FROM MedicationAdministrations");

        for (const p of patients) {
            // 1. Vitals
            const vitals = [
                { pulse: 72 + Math.floor(Math.random() * 10), bpSystolic: 120 + Math.floor(Math.random() * 20), bpDiastolic: 80, respRate: 16 + Math.floor(Math.random() * 4), temp: 36.6 + (Math.random() * 0.5), spo2: 95 + Math.floor(Math.random() * 5), levelOfConsciousness: 'alert' },
                { pulse: 75 + Math.floor(Math.random() * 10), bpSystolic: 125 + Math.floor(Math.random() * 20), bpDiastolic: 82, respRate: 18 + Math.floor(Math.random() * 4), temp: 36.8 + (Math.random() * 0.5), spo2: 96 + Math.floor(Math.random() * 4), levelOfConsciousness: 'alert' }
            ];
            for (const v of vitals) {
                await run("INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [crypto.randomUUID(), p.tenantId, p.id, 'vital', JSON.stringify(v), recordedBy, new Date(Date.now() - Math.random() * 86400000).toISOString()]);
            }

            // 2. Symptoms
            const symptoms = [
                { severity: 'mild', description: 'Occasional dizziness', location: 'Head', onset: 'Morning' },
                { severity: 'moderate', description: 'Fatigue', location: 'Generalized', onset: 'Evening' }
            ];
            await run("INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [crypto.randomUUID(), p.tenantId, p.id, 'symptom', JSON.stringify(symptoms[0]), recordedBy, new Date(Date.now() - 40000000).toISOString()]);

            // 3. Diet
            let dietLogs = [];
            if (p.diagnosis.includes('CHF')) {
                dietLogs = [
                    { mealType: 'Breakfast', consumedPercentage: '70', fluidIntakeMl: '120', notes: 'Adhering to fluid restriction' },
                    { mealType: 'Lunch', consumedPercentage: '100', fluidIntakeMl: '150', notes: 'Fluid intake monitored closely' }
                ];
            } else if (p.diagnosis.includes('Gastroenteritis')) {
                dietLogs = [
                    { mealType: 'Breakfast', consumedPercentage: '30', fluidIntakeMl: '400', notes: 'Poor appetite, focusing on rehydration' },
                    { mealType: 'Lunch', consumedPercentage: '50', fluidIntakeMl: '500', notes: 'Tolerating clear liquids better' }
                ];
            } else {
                dietLogs = [
                    { mealType: 'Breakfast', consumedPercentage: '85', fluidIntakeMl: '250', notes: 'Good appetite' },
                    { mealType: 'Lunch', consumedPercentage: '100', fluidIntakeMl: '500', notes: 'Finished all' }
                ];
            }
            
            for (const d of dietLogs) {
                await run("INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [crypto.randomUUID(), p.tenantId, p.id, 'diet', JSON.stringify(d), recordedBy, new Date(Date.now() - Math.random() * 86400000).toISOString()]);
            }

            // 4. Sleep
            const sleepLogs = [
                { hoursSlept: '7.5', quality: 'Good', interrupted: false, nap: false, notes: 'Rested' },
                { hoursSlept: '6.25', quality: 'Fair', interrupted: true, nap: false, notes: 'Slightly restless' }
            ];
            await run("INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [crypto.randomUUID(), p.tenantId, p.id, 'sleep', JSON.stringify(sleepLogs[0]), recordedBy, new Date(Date.now() - 86400000).toISOString()]);

            // 5. Medications (Ongoing Treatment)
            let meds = [];
            if (p.diagnosis.includes('Diabetes')) {
                meds = [
                    { name: 'Metformin', dosage: '500mg', route: 'Oral', frequency: 'Twice daily', scheduledTimes: '08:00, 20:00', prn: 0 },
                    { name: 'Insulin Glargine', dosage: '10 units', route: 'Subcutaneous', frequency: 'Nightly', scheduledTimes: '22:00', prn: 0 }
                ];
            } else if (p.diagnosis.includes('Hypertension')) {
                meds = [
                    { name: 'Lisinopril', dosage: '10mg', route: 'Oral', frequency: 'Daily', scheduledTimes: '09:00', prn: 0 },
                    { name: 'Amlodipine', dosage: '5mg', route: 'Oral', frequency: 'Daily', scheduledTimes: '09:00', prn: 0 }
                ];
            } else if (p.diagnosis.includes('CHF')) {
                meds = [
                    { name: 'Furosemide', dosage: '40mg', route: 'Oral', frequency: 'Daily', scheduledTimes: '08:00', prn: 0 },
                    { name: 'Carvedilol', dosage: '6.25mg', route: 'Oral', frequency: 'Twice daily', scheduledTimes: '08:00, 20:00', prn: 0 }
                ];
            } else if (p.diagnosis.includes('COPD')) {
                meds = [
                    { name: 'Salbutamol', dosage: '2 puffs', route: 'Inhalation', frequency: 'Every 4 hours', scheduledTimes: 'PRN', prn: 1 },
                    { name: 'Tiotropium', dosage: '18mcg', route: 'Inhalation', frequency: 'Daily', scheduledTimes: '08:00', prn: 0 }
                ];
            } else {
                meds = [
                    { name: 'Paracetamol', dosage: '1g', route: 'Oral', frequency: 'Every 6 hours', scheduledTimes: 'PRN', prn: 1 },
                    { name: 'Pantoprazole', dosage: '40mg', route: 'Oral', frequency: 'Daily', scheduledTimes: '08:00', prn: 0 }
                ];
            }

            for (const m of meds) {
                const medId = crypto.randomUUID();
                await run(`INSERT INTO Medications (id, patientId, tenantId, name, dosage, route, frequency, scheduledTimes, prn, startDate, prescribedBy, status) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [medId, p.id, p.tenantId, m.name, m.dosage, m.route, m.frequency, m.scheduledTimes, m.prn, '2026-05-01', prescribedBy, 'active']);

                // Add some administrations
                await run(`INSERT INTO MedicationAdministrations (id, medicationId, patientId, tenantId, status, administeredBy, doseActuallyGiven, timestamp) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [crypto.randomUUID(), medId, p.id, p.tenantId, 'given', 'Nurse Joy', m.dosage, new Date(Date.now() - 3600000).toISOString()]);
            }
        }

        console.log('Comprehensive data seeding completed successfully.');
    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        db.close();
    }
}

seed();
