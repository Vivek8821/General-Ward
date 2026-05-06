const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ward.db');
db.all("PRAGMA table_info(PharmacyStock)", (err, rows) => {
  if (err) console.error(err);
  else console.log('PharmacyStock:', rows.map(r => r.name).join(', '));
  db.all("PRAGMA table_info(PharmacyBatches)", (err, rows) => {
    if (err) console.error(err);
    else console.log('PharmacyBatches:', rows.map(r => r.name).join(', '));
    db.close();
  });
});
