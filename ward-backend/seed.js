const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const db = new sqlite3.Database('ward.db');

async function seed() {
  console.log('Seeding database with enterprise pharmacy data...');

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, (err) => err ? reject(err) : resolve());
  });

  const saltRounds = 10;
  const adminHash = await bcrypt.hash('admin123', saltRounds);
  const nurseHash = await bcrypt.hash('nurse123', saltRounds);
  const doctorHash = await bcrypt.hash('doctor123', saltRounds);

  // Users
  await run('DELETE FROM Users');
  await run('INSERT INTO Users (id, tenantId, name, role, passwordHash) VALUES (?, ?, ?, ?, ?)', ['u1', 'tenant-default', 'Admin User', 'admin', adminHash]);
  await run('INSERT INTO Users (id, tenantId, name, role, passwordHash) VALUES (?, ?, ?, ?, ?)', ['u2', 'tenant-default', 'Nurse Joy', 'nurse', nurseHash]);
  await run('INSERT INTO Users (id, tenantId, name, role, passwordHash) VALUES (?, ?, ?, ?, ?)', ['u3', 'tenant-default', 'Dr. Smith', 'doctor', doctorHash]);

  // Patients
  await run('DELETE FROM Patients');
  await run('INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    ['p1', 'tenant-default', 'John Doe', 'MRN001', 'Ward A-1', '1985-05-15', 'Type 2 Diabetes', 'Penicillin', 2, 'active']);
  await run('INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    ['p2', 'tenant-default', 'Jane Roe', 'MRN002', 'Ward B-3', '1992-11-20', 'Hypertension', 'None', 1, 'active']);

  // Pharmacy Inventory (EDL) - Real Medications with Batch Data
  await run('DELETE FROM PharmacyBatches');
  await run('DELETE FROM PharmacyTransactions');
  await run('DELETE FROM PharmacyStock');

  const meds = [
    { 
      name: 'Amoxicillin', composition: '500mg', type: 'Capsule', category: 'Antibiotics', 
      quantityPerUnit: 10, totalUnits: 50, unit: 'Strip', itemUnit: 'Capsules', costPerUnit: 5.50,
      batches: [
        { lot: 'AMX-2026-A01', expiry: '2026-06-30', qty: 150, cost: 5.50, manufacturer: 'Cipla Ltd' },
        { lot: 'AMX-2026-A02', expiry: '2026-09-30', qty: 200, cost: 5.25, manufacturer: 'Cipla Ltd' },
        { lot: 'AMX-2026-A03', expiry: '2027-03-31', qty: 150, cost: 5.75, manufacturer: 'Sun Pharma' }
      ]
    },
    { 
      name: 'Metformin', composition: '500mg (SR)', type: 'Tablet', category: 'Anti-diabetics', 
      quantityPerUnit: 15, totalUnits: 100, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 1.20,
      batches: [
        { lot: 'MET-2026-B01', expiry: '2026-08-15', qty: 500, cost: 1.20, manufacturer: 'USV Pvt Ltd' },
        { lot: 'MET-2026-B02', expiry: '2027-01-31', qty: 500, cost: 1.15, manufacturer: 'USV Pvt Ltd' },
        { lot: 'MET-2027-B03', expiry: '2027-06-30', qty: 500, cost: 1.25, manufacturer: 'Dr. Reddy\'s' }
      ]
    },
    { 
      name: 'Atorvastatin', composition: '20mg', type: 'Tablet', category: 'Statins', 
      quantityPerUnit: 10, totalUnits: 30, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 12.00,
      batches: [
        { lot: 'ATV-2026-C01', expiry: '2026-07-15', qty: 100, cost: 12.00, manufacturer: 'Ranbaxy' },
        { lot: 'ATV-2026-C02', expiry: '2027-02-28', qty: 200, cost: 11.50, manufacturer: 'Ranbaxy' }
      ]
    },
    { 
      name: 'Amlodipine', composition: '5mg', type: 'Tablet', category: 'Antihypertensives', 
      quantityPerUnit: 10, totalUnits: 40, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 2.50,
      batches: [
        { lot: 'AML-2026-D01', expiry: '2026-10-31', qty: 200, cost: 2.50, manufacturer: 'Pfizer' },
        { lot: 'AML-2027-D02', expiry: '2027-04-30', qty: 200, cost: 2.45, manufacturer: 'Pfizer' }
      ]
    },
    { 
      name: 'Salbutamol', composition: '100mcg/dose', type: 'Other', category: 'Bronchodilators', 
      quantityPerUnit: 200, totalUnits: 15, unit: 'Inhaler', itemUnit: 'Puffs', costPerUnit: 1.80,
      batches: [
        { lot: 'SAL-2026-E01', expiry: '2026-12-31', qty: 1500, cost: 1.80, manufacturer: 'GlaxoSmithKline' },
        { lot: 'SAL-2027-E02', expiry: '2027-06-30', qty: 1500, cost: 1.85, manufacturer: 'GlaxoSmithKline' }
      ]
    },
    { 
      name: 'Ceftriaxone', composition: '1g', type: 'Injection', category: 'Antibiotics', 
      quantityPerUnit: 1, totalUnits: 100, unit: 'Vial', itemUnit: 'Vials', costPerUnit: 45.00,
      batches: [
        { lot: 'CFT-2026-F01', expiry: '2026-05-31', qty: 20, cost: 45.00, manufacturer: 'Lupin' },
        { lot: 'CFT-2026-F02', expiry: '2026-11-30', qty: 40, cost: 44.00, manufacturer: 'Lupin' },
        { lot: 'CFT-2027-F03', expiry: '2027-05-31', qty: 40, cost: 46.00, manufacturer: 'Aurobindo' }
      ]
    },
    { 
      name: 'Pantoprazole', composition: '40mg', type: 'Tablet', category: 'Antacids', 
      quantityPerUnit: 10, totalUnits: 60, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 8.50,
      batches: [
        { lot: 'PAN-2026-G01', expiry: '2026-09-15', qty: 300, cost: 8.50, manufacturer: 'Alkem' },
        { lot: 'PAN-2027-G02', expiry: '2027-03-15', qty: 300, cost: 8.25, manufacturer: 'Alkem' }
      ]
    },
    { 
      name: 'Paracetamol', composition: '500mg', type: 'Tablet', category: 'Analgesics', 
      quantityPerUnit: 10, totalUnits: 200, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 0.50,
      batches: [
        { lot: 'PCM-2026-H01', expiry: '2026-06-15', qty: 500, cost: 0.50, manufacturer: 'Micro Labs' },
        { lot: 'PCM-2026-H02', expiry: '2026-12-31', qty: 700, cost: 0.48, manufacturer: 'Micro Labs' },
        { lot: 'PCM-2027-H03', expiry: '2027-09-30', qty: 800, cost: 0.52, manufacturer: 'Cipla Ltd' }
      ]
    }
  ];

  for (const m of meds) {
    const stockId = crypto.randomUUID();
    // Calculate total from batch quantities
    const batchTotal = m.batches.reduce((sum, b) => sum + b.qty, 0);
    const totalUnits = Math.floor(batchTotal / m.quantityPerUnit);

    await run(`INSERT INTO PharmacyStock (id, tenantId, name, composition, type, category, quantityPerUnit, totalUnits, totalQuantity, unit, itemUnit, costPerUnit, expiryDate) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [stockId, 'tenant-default', m.name, m.composition, m.type, m.category, m.quantityPerUnit, totalUnits, batchTotal, m.unit, m.itemUnit, m.costPerUnit, m.batches[0].expiry]);

    // Seed batches
    for (const b of m.batches) {
      await run(`INSERT INTO PharmacyBatches (id, tenantId, stockId, batchNumber, expiryDate, quantity, costPerUnit, manufacturer, receivedDate, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [crypto.randomUUID(), 'tenant-default', stockId, b.lot, b.expiry, b.qty, b.cost, b.manufacturer, '2026-01-15']);
    }

    console.log(`  ✓ ${m.name}: ${m.batches.length} batches, ${batchTotal} total units`);
  }

  console.log('Database seeded successfully.');
  db.close();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
