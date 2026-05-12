const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(__dirname, 'ward.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (!err) {
        db.run('PRAGMA foreign_keys = ON;'); // Crucial for cascading deletes in SQLite
        // Better concurrency characteristics under load.
        // WAL lets readers proceed while a writer is active.
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA synchronous = NORMAL;');
        // Avoid immediate failures while the DB is locked by another writer.
        db.run('PRAGMA busy_timeout = 5000;');
    }
});

const { initDb: runInitDb } = require('./db/schema');

// SQLite is single-writer and the `sqlite3` Database instance is shared across requests.
// Manual `BEGIN TRANSACTION` blocks can overlap under concurrent load, causing
// "cannot start a transaction within a transaction". This queue ensures only one
// explicit transaction runs at a time.
let transactionChain = Promise.resolve();

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

function withTransaction(work) {
  // Ensure a previous failure doesn't poison the global transaction queue.
  transactionChain = transactionChain.catch(() => {}).then(async () => {
    await runAsync('BEGIN IMMEDIATE;');
    try {
      const result = await work({ runAsync, getAsync, allAsync });
      await runAsync('COMMIT;');
      return result;
    } catch (err) {
      try {
        await runAsync('ROLLBACK;');
      } catch (_) {
        // ignore rollback errors
      }
      throw err;
    }
  });

  return transactionChain;
}

const initDb = () => runInitDb(db);

// Export for explicit initialization in server.js or setup scripts
module.exports = { db, initDb, withTransaction, runAsync, getAsync, allAsync };
