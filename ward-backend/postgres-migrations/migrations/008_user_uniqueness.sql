-- Add unique constraint to Users table
-- SQLite doesn't support ALTER TABLE ADD UNIQUE, so we must recreate the table.
-- However, for the application bootstrap, we can just update the schema.sql and the initDb logic.

-- Migration 008: Enforce unique usernames
CREATE TABLE Users_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
  tenantId TEXT,
  passwordHash TEXT NOT NULL
);

INSERT INTO Users_new SELECT * FROM Users;
DROP TABLE Users;
ALTER TABLE Users_new RENAME TO Users;
