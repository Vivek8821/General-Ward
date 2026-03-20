const { Pool } = require('pg');

let pool = null;

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url || String(url).trim() === '') return null;

  if (pool) return pool;

  // Keep defaults conservative: Phase D.1 is driver/pool only (no repository port yet).
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

async function checkPostgresConnectivity() {
  const p = getPool();
  if (!p) return { enabled: false };

  try {
    await p.query('SELECT 1;');
    return { enabled: true, ok: true };
  } catch (err) {
    return { enabled: true, ok: false, error: err?.message || 'unknown' };
  }
}

module.exports = { getPool, checkPostgresConnectivity };

