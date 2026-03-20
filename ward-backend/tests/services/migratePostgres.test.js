const { planMigrations } = require('../../postgres-migrations/planMigrations');

describe('Postgres migrations (D.2)', () => {
  it('planMigrations returns ordered SQL migrations without requiring DATABASE_URL', () => {
    const migrations = planMigrations();
    expect(Array.isArray(migrations)).toBe(true);
    expect(migrations.length).toBeGreaterThanOrEqual(1);

    // Ensure numeric ordering by the `num` prefix in filenames.
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].num).toBeGreaterThanOrEqual(migrations[i - 1].num);
    }

    // Ensure each migration has filePath and name.
    for (const m of migrations) {
      expect(typeof m.name).toBe('string');
      expect(typeof m.filePath).toBe('string');
    }
  });
});

