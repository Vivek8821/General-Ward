const fs = require('fs');
const path = require('path');

function getMigrationsDir() {
  return path.join(__dirname, 'migrations');
}

function listMigrationFiles() {
  const dir = getMigrationsDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.endsWith('.sql'));
}

function parseMigrationName(fileName) {
  // Expect: `NNN_description.sql`
  const m = fileName.match(/^(\d{3})_(.+)\.sql$/);
  if (!m) return null;
  const num = Number(m[1]);
  const description = m[2];
  return { num, description, name: fileName.replace(/\.sql$/, '') };
}

function planMigrations() {
  const files = listMigrationFiles();
  const parsed = files
    .map((f) => {
      const p = parseMigrationName(f);
      return p ? { ...p, fileName: f } : null;
    })
    .filter(Boolean);

  parsed.sort((a, b) => a.num - b.num);

  return parsed.map((p) => ({
    name: p.name,
    filePath: path.join(getMigrationsDir(), p.fileName),
    num: p.num,
  }));
}

module.exports = { planMigrations };

