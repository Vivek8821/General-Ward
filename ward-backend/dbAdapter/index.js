const { getPool } = require('../postgres');

function isPostgresEnabled() {
  const url = process.env.DATABASE_URL;
  return url && String(url).trim() !== '';
}

module.exports = isPostgresEnabled() ? require('./postgresAdapter') : require('./sqliteAdapter');

