const { getPool } = require('../postgres');

async function run(sql, params) {
  const pool = getPool();
  if (!pool) throw new Error('Postgres adapter requested but DATABASE_URL is not set');
  const result = await pool.query(sql, params);
  return { changes: result.rowCount, lastID: null };
}

async function get(sql, params) {
  const pool = getPool();
  if (!pool) throw new Error('Postgres adapter requested but DATABASE_URL is not set');
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params) {
  const pool = getPool();
  if (!pool) throw new Error('Postgres adapter requested but DATABASE_URL is not set');
  const result = await pool.query(sql, params);
  return result.rows;
}

async function withTransaction(work) {
  const pool = getPool();
  if (!pool) throw new Error('Postgres adapter requested but DATABASE_URL is not set');

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const result = await work({
      // Provide both naming conventions so repositories can migrate incrementally.
      run: async (sql, params) => {
        const r = await client.query(sql, params);
        return { changes: r.rowCount, lastID: null };
      },
      runAsync: async (sql, params) => {
        const r = await client.query(sql, params);
        return { changes: r.rowCount, lastID: null };
      },
      get: async (sql, params) => {
        const r = await client.query(sql, params);
        return r.rows[0] || null;
      },
      getAsync: async (sql, params) => {
        const r = await client.query(sql, params);
        return r.rows[0] || null;
      },
      all: async (sql, params) => {
        const r = await client.query(sql, params);
        return r.rows;
      },
      allAsync: async (sql, params) => {
        const r = await client.query(sql, params);
        return r.rows;
      },
    });
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { run, get, all, withTransaction };

