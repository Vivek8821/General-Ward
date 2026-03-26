#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const defaultSqlitePath = path.resolve(__dirname, '..', 'ward.db');
const sqlitePath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : defaultSqlitePath;
const databaseUrl = process.env.DATABASE_URL;

const tables = [
  'Users',
  'Tenants',
  'Patients',
  'DailyStats',
  'Medications',
  'MedicationAdministrations',
  'Escalations',
  'DischargeSummaries',
  'Tasks',
  'HandoverNotes',
  'AuditLogs',
  'ClinicalChangeLog',
  'IdempotencyKeys',
  'AuthLoginAttempts',
];

function sqliteCount(db, table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) AS count FROM ${table}`, (err, row) => {
      if (err) return reject(err);
      resolve(Number(row?.count || 0));
    });
  });
}

async function pgCount(pool, table) {
  const res = await pool.query(`SELECT COUNT(*)::BIGINT AS count FROM ${table}`);
  return Number(res.rows[0]?.count || 0);
}

async function main() {
  if (!databaseUrl || String(databaseUrl).trim() === '') {
    throw new Error('DATABASE_URL is required');
  }

  const sqliteDb = new sqlite3.Database(sqlitePath);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    let mismatch = false;
    console.log(`[count-verify] SQLite: ${sqlitePath}`);
    console.log('[count-verify] Comparing table row counts:');
    for (const table of tables) {
      const [sqliteRows, pgRows] = await Promise.all([sqliteCount(sqliteDb, table), pgCount(pool, table)]);
      const ok = sqliteRows === pgRows;
      if (!ok) mismatch = true;
      console.log(
        `${ok ? 'OK  ' : 'DIFF'} ${table.padEnd(26)} sqlite=${String(sqliteRows).padStart(8)} postgres=${String(pgRows).padStart(8)}`
      );
    }

    if (mismatch) {
      process.exitCode = 1;
      console.error('[count-verify] One or more table counts differ.');
      return;
    }
    console.log('[count-verify] All compared table counts match.');
  } finally {
    sqliteDb.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[count-verify] Failed:', err?.message || err);
  process.exit(1);
});
