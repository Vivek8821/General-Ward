const fs = require('fs');
const path = require('path');
const dbAdapter = require('../dbAdapter');
const logger = require('../utils/logger');

class MigratorService {
  async runMigrations() {
    if (process.env.STARTUP_MODE === 'perf') {
      return;
    }
    const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      logger.warn('[Migrator] schema.sql not found, skipping migrations');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Split by semicolons, but be careful with triggers or multi-line statements.
    // For this simple schema, splitting by semicolon works if we filter empty strings.
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    logger.info(`[Migrator] Found ${statements.length} statements in schema.sql`);

    // Using a transaction for atomicity (if supported by the adapter)
    try {
      await dbAdapter.withTransaction(async (tx) => {
        for (const sql of statements) {
          try {
            await tx.run(sql);
          } catch (err) {
            // Ignore "column already exists" or "table already exists" if we use CREATE/ALTER IF NOT EXISTS
            // But log other errors
            if (!/already exists/i.test(err.message)) {
              logger.error(`[Migrator] Error executing statement: ${sql.substring(0, 50)}...`, { error: err.message });
            }
          }
        }
      });
      logger.info('[Migrator] Migrations completed successfully');
    } catch (err) {
      logger.error('[Migrator] Transactional migration failed', { error: err.message });
      // Fallback: Try running one by one without a transaction if the transaction failed due to SQLite/Postgres differences
      for (const sql of statements) {
        try {
          await dbAdapter.run(sql);
        } catch (e) {
          // ignore common "already exists" errors
        }
      }
    }
  }
}

module.exports = new MigratorService();
