const { runAsync, getAsync, allAsync, withTransaction } = require('../db');

async function run(sql, params) {
  return runAsync(sql, params);
}

async function get(sql, params) {
  return getAsync(sql, params);
}

async function all(sql, params) {
  return allAsync(sql, params);
}

async function withTx(work) {
  // Preserve SQLite's queued transaction semantics from db.js.
  return withTransaction(async ({ runAsync: run2, getAsync: get2, allAsync: all2 }) => {
    // Provide both naming conventions so repositories can migrate incrementally.
    return work({
      run: run2,
      get: get2,
      all: all2,
      runAsync: run2,
      getAsync: get2,
      allAsync: all2,
    });
  });
}

module.exports = { run, get, all, withTransaction: withTx };

