const { db } = require('../db');
const { pool } = require('../db-postgres');
const logger = require('../utils/logger');

async function migrate() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...');

  const tables = [
    'Tenants',
    'Users',
    'Patients',
    'AuthLoginAttempts',
    'IdempotencyKeys',
    'PharmacyStock',
    'PharmacyBatches',
    'PharmacyTransactions',
    'WasteRecords',
    'PurchaseOrders',
    'BarcodeRegistrations',
    'MedicationAdministrations',
    'DailyStats',
    'Escalations',
    'Tasks',
    'HandoverNotes',
    'ClinicalChangeLog',
    'AuditLogs',
    'PatientReports'
  ];

  for (const table of tables) {
    console.log(`\n📦 Migrating table: ${table}`);
    
    // Check if table exists in SQLite
    const exists = await new Promise((resolve) => {
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
        resolve(!!row);
      });
    });

    if (!exists) {
      console.log(`⚠️  Table ${table} does not exist in SQLite, skipping.`);
      continue;
    }

    // Get all rows from SQLite
    const rows = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (rows.length === 0) {
      console.log(`ℹ️  Table ${table} is empty.`);
      continue;
    }

    console.log(`  Found ${rows.length} rows in SQLite.`);

    // Prepare Postgres insert
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnsJoined = columns.map(c => `"${c}"`).join(', ');
    const insertSql = `INSERT INTO "${table}" (${columnsJoined}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let successCount = 0;
    for (const row of rows) {
      try {
        const values = columns.map(col => {
          const val = row[col];
          // Basic transformation for JSON fields if they are strings in SQLite but JSONB in Postgres
          // The Postgres driver usually handles objects well, so we try to parse if it's a string that looks like JSON
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try { return JSON.parse(val); } catch { return val; }
          }
          return val;
        });
        await pool.query(insertSql, values);
        successCount++;
      } catch (err) {
        logger.error(`Failed to migrate row in ${table}:`, err.message);
      }
    }

    console.log(`  Successfully migrated ${successCount}/${rows.length} rows.`);

    // Reset SERIAL sequences if applicable
    // We'll check if the table has an 'id' column that is a sequence
    try {
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1)
        )
      `);
      console.log(`  Reset sequence for ${table}.id`);
    } catch (err) {
      // Not all tables have serial 'id'
    }
  }

  console.log('\n✅ Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Fatal migration error:', err);
  process.exit(1);
});
