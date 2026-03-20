-- Initial migration scaffolding for Postgres migration tracking.
-- Actual clinical/business schema migrations will be added in later Phase D steps.
CREATE TABLE IF NOT EXISTS SchemaMigrations (
  name TEXT PRIMARY KEY,
  appliedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

