const dbSqlite = require('./db');
const dbPostgres = require('./db-postgres');
const logger = require('./utils/logger');

const dialect = process.env.DB_DIALECT || 'sqlite';

/**
 * Translates SQLite style '?' placeholders to PostgreSQL style '$1', '$2', etc.
 * Handles escaping and basic SQL shapes.
 */
function translatePlaceholders(sql) {
  if (dialect !== 'postgres') return sql;
  
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Normalizes rows from different drivers.
 * Postgres returns { rows: [] }, SQLite returns [].
 */
function normalizeRows(result) {
  if (dialect === 'postgres') {
    return result.rows || [];
  }
  return result || [];
}

const adapter = {
  dialect,

  async query(sql, params = []) {
    const translatedSql = translatePlaceholders(sql);
    if (dialect === 'postgres') {
      const res = await dbPostgres.pool.query(translatedSql, params);
      return res.rows;
    } else {
      return dbSqlite.allAsync(sql, params);
    }
  },

  async queryOne(sql, params = []) {
    const translatedSql = translatePlaceholders(sql);
    if (dialect === 'postgres') {
      const res = await dbPostgres.pool.query(translatedSql, params);
      return res.rows[0] || null;
    } else {
      return dbSqlite.getAsync(sql, params);
    }
  },

  async execute(sql, params = []) {
    const translatedSql = translatePlaceholders(sql);
    if (dialect === 'postgres') {
      const res = await dbPostgres.pool.query(translatedSql, params);
      const lastID = res.rows[0]?.id || null;
      return { changes: res.rowCount, lastID };
    } else {
      return dbSqlite.runAsync(sql, params);
    }
  },

  async withTransaction(fn) {
    if (dialect === 'postgres') {
      return dbPostgres.withTransaction(async (client) => {
        const wrappedClient = {
          query: async (sql, params = []) => {
            const res = await client.query(translatePlaceholders(sql), params);
            return res.rows;
          },
          queryOne: async (sql, params = []) => {
            const res = await client.query(translatePlaceholders(sql), params);
            return res.rows[0] || null;
          },
          execute: async (sql, params = []) => {
            const res = await client.query(translatePlaceholders(sql), params);
            const lastID = res.rows[0]?.id || null;
            return { changes: res.rowCount, lastID };
          }
        };
        // Compatibility aliases
        wrappedClient.all = wrappedClient.query;
        wrappedClient.get = wrappedClient.queryOne;
        wrappedClient.run = wrappedClient.execute;
        wrappedClient.allAsync = wrappedClient.query;
        wrappedClient.getAsync = wrappedClient.queryOne;
        wrappedClient.runAsync = wrappedClient.execute;
        
        return fn(wrappedClient);
      });
    } else {
      return dbSqlite.withTransaction(async (tx) => {
        const wrappedTx = {
          query: (sql, params = []) => tx.allAsync(sql, params),
          queryOne: (sql, params = []) => tx.getAsync(sql, params),
          execute: (sql, params = []) => tx.runAsync(sql, params)
        };
        // Compatibility aliases
        wrappedTx.all = wrappedTx.query;
        wrappedTx.get = wrappedTx.queryOne;
        wrappedTx.run = wrappedTx.execute;
        wrappedTx.allAsync = wrappedTx.query;
        wrappedTx.getAsync = wrappedTx.queryOne;
        wrappedTx.runAsync = wrappedTx.execute;
        
        return fn(wrappedTx);
      });
    }
  }
};

// Top-level compatibility aliases
adapter.all = adapter.query;
adapter.get = adapter.queryOne;
adapter.run = adapter.execute;
adapter.isPostgresEnabled = () => dialect === 'postgres';

module.exports = adapter;
