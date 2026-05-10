-- Migration 013: Add signup fields — employeeCode, tokenVersion on Users; code on Tenants
ALTER TABLE Users ADD COLUMN IF NOT EXISTS employeeCode TEXT;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS tokenVersion INTEGER DEFAULT 0;
ALTER TABLE Tenants ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
