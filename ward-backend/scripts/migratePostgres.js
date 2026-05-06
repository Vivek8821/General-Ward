const fs = require('fs');
const path = require('path');
const { getPool } = require('./postgres');
const { planMigrations } = require('./postgres-migrations/planMigrations');

function getArg(flag) {
  return process.argv.includes(flag);
}

async function run() {
  const dryRun = getArg('--dry-run') || getArg('--dryrun');

  const migrations = planMigrations();
  if (migrations.length === 0) {
    console.log('[migratePostgres] No .sql migrations found.');
    return;
  }

  if (dryRun) {
    console.log('[migratePostgres] DRY RUN');
    migrations.forEach((m) => {
      console.log(`- ${m.name} (${path.basename(m.filePath)})`);
    });
    return;
  }

  const pool = getPool();
  if (!pool) {
    throw new Error('[migratePostgres] DATABASE_URL is required to run migrations');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // Ensure tracking table exists even if the first migration isn't applied yet.
    await client.query(`
      CREATE TABLE IF NOT EXISTS SchemaMigrations (
        name TEXT PRIMARY KEY,
        appliedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRows = await client.query('SELECT name FROM SchemaMigrations');
    const applied = new Set(appliedRows.rows.map((r) => r.name));

    for (const m of migrations) {
      if (applied.has(m.name)) continue;
      const sql = fs.readFileSync(m.filePath, 'utf8');
      // One migration file should contain a single statement or be safe to run as-is.
      await client.query(sql);
      await client.query(
        'INSERT INTO SchemaMigrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [m.name]
      );
    }

    await client.query('COMMIT;');
    console.log(`[migratePostgres] Migrations applied: ${migrations.length}`);
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // ignore rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

run().catch((err) => {
  console.error('[migratePostgres] Failed:', err?.message || err);
  process.exit(1);
});

