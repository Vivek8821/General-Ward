const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ward.db');
db.all("SELECT name, role FROM Users", (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows));
  db.close();
});
