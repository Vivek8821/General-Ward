function isPostgresEnabled() {
  const url = process.env.DATABASE_URL;
  return Boolean(url && String(url).trim() !== '');
}

const impl = isPostgresEnabled() ? require('./postgresAdapter') : require('./sqliteAdapter');

module.exports = Object.assign({}, impl, { isPostgresEnabled });

