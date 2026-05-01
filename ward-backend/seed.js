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

  // Pharmacy Inventory (EDL) - Real Medications
  await run('DELETE FROM PharmacyStock');
  const meds = [
    { name: 'Amoxicillin', composition: '500mg', type: 'Capsule', category: 'Antibiotics', quantityPerUnit: 10, totalUnits: 50, unit: 'Strip', itemUnit: 'Capsules', costPerUnit: 5.50 },
    { name: 'Metformin', composition: '500mg (SR)', type: 'Tablet', category: 'Anti-diabetics', quantityPerUnit: 15, totalUnits: 100, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 1.20 },
    { name: 'Atorvastatin', composition: '20mg', type: 'Tablet', category: 'Statins', quantityPerUnit: 10, totalUnits: 30, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 12.00 },
    { name: 'Amlodipine', composition: '5mg', type: 'Tablet', category: 'Antihypertensives', quantityPerUnit: 10, totalUnits: 40, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 2.50 },
    { name: 'Salbutamol', composition: '100mcg/dose', type: 'Other', category: 'Bronchodilators', quantityPerUnit: 200, totalUnits: 15, unit: 'Inhaler', itemUnit: 'Puffs', costPerUnit: 1.80 },
    { name: 'Ceftriaxone', composition: '1g', type: 'Injection', category: 'Antibiotics', quantityPerUnit: 1, totalUnits: 100, unit: 'Vial', itemUnit: 'Vials', costPerUnit: 45.00 },
    { name: 'Pantoprazole', composition: '40mg', type: 'Tablet', category: 'Antacids', quantityPerUnit: 10, totalUnits: 60, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 8.50 },
    { name: 'Paracetamol', composition: '500mg', type: 'Tablet', category: 'Analgesics', quantityPerUnit: 10, totalUnits: 200, unit: 'Strip', itemUnit: 'Tablets', costPerUnit: 0.50 }
  ];

  for (const m of meds) {
    await run(`INSERT INTO PharmacyStock (id, tenantId, name, composition, type, category, quantityPerUnit, totalUnits, totalQuantity, unit, itemUnit, costPerUnit, expiryDate) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [crypto.randomUUID(), 'tenant-default', m.name, m.composition, m.type, m.category, m.quantityPerUnit, m.totalUnits, m.totalUnits * m.quantityPerUnit, m.unit, m.itemUnit, m.costPerUnit, '2026-12-31']);
  }

  console.log('Database seeded successfully.');
  db.close();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
