const { initDb, db } = require('../db');

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function seed() {
  await initDb();
  const tenantId = 'tenant-default';
  const pharmId = 'stress-pharm-A';
  
  console.log('Seeding pharmacy items for stress test...');
  
  await dbRun('PRAGMA foreign_keys = OFF;');
  await dbRun(`INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)`, [tenantId, 'Tenant A']);
  
  await dbRun(`DELETE FROM PharmacyStock WHERE id = ?`, [pharmId]);
  await dbRun(
    `INSERT INTO PharmacyStock (id, tenantId, name, composition, type, category, quantityPerUnit, totalUnits, totalQuantity, unit, itemUnit, costPerUnit, lastUpdated)
     VALUES (?, ?, ?, ?, 'Tablet', 'Analgesics', 10, 100, 1000, 'Strips', 'Tablets', 1.5, CURRENT_TIMESTAMP)`,
    [pharmId, tenantId, `StressMed-A`, '10mg']
  );
  await dbRun('PRAGMA foreign_keys = ON;');
  
  console.log('Seed complete.');
  db.close();
}

seed().catch(console.error);
