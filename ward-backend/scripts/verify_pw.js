const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('ward.db');

db.get("SELECT passwordHash FROM Users WHERE name = 'Dr. Smith'", async (err, row) => {
  if (err) {
    console.error(err);
  } else if (!row) {
    console.log("Dr. Smith not found in DB");
  } else {
    const passwords = ['doctor123', '1234', 'doctor', 'password'];
    for (const pw of passwords) {
      const match = await bcrypt.compare(pw, row.passwordHash);
      console.log(`Password "${pw}" matches: ${match}`);
    }
  }
  db.close();
});
