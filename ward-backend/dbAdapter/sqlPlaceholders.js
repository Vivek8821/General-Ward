/**
 * Convert SQLite-style `?` placeholders to PostgreSQL `$1`, `$2`, ...
 * @param {string} sql
 * @returns {string}
 */
function sqlitePlaceholdersToPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

module.exports = { sqlitePlaceholdersToPg };
