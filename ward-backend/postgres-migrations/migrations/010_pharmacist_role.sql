-- Migration 010: Add pharmacist role
ALTER TABLE Users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE Users ADD CONSTRAINT users_role_check
  CHECK (role IN ('doctor', 'nurse', 'pharmacist', 'admin'));
