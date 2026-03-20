const { checkPostgresConnectivity, getPool } = require('../../postgres');
const dbAdapter = require('../../dbAdapter');

const hasDatabaseUrl = !!process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim() !== '';

(hasDatabaseUrl ? describe : describe.skip)('Postgres smoke (D.5)', () => {
  it('connects and can execute a trivial query via dbAdapter', async () => {
    const conn = await checkPostgresConnectivity();
    expect(conn.enabled).toBe(true);
    expect(conn.ok).toBe(true);

    const pool = getPool();
    expect(pool).not.toBeNull();

    const row = await dbAdapter.get('SELECT 1 AS x', []);
    expect(Number(row?.x)).toBe(1);
  });

  it('verifies migration tracking table exists', async () => {
    // Phase D.5 CI runs `node ward-backend/migratePostgres.js` before this test.
    const reg = await dbAdapter.get("SELECT to_regclass('SchemaMigrations') AS reg", []);
    expect(reg?.reg).toBe('SchemaMigrations');
  });
});

