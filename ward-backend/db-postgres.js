const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'warddb',
  user: process.env.PG_USER || 'wardapp',
  password: process.env.PG_PASSWORD || 'changeme',
  max: parseInt(process.env.PG_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function initPostgresDb() {
  const migrationsDir = path.join(__dirname, 'postgres-migrations', 'migrations');
  
  // Create migrations table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS SchemaMigrations (
      name TEXT PRIMARY KEY,
      appliedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(migrationsDir).sort();
  const { rows: applied } = await pool.query('SELECT name FROM SchemaMigrations');
  const appliedNames = new Set(applied.map(r => r.name));

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    if (appliedNames.has(file)) continue;

    console.log(`📦 Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO SchemaMigrations (name) VALUES ($1)', [file]);
    });
  }
}

module.exports = {
  pool,
  withTransaction,
  initPostgresDb
};
