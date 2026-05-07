-- Migration 011: Add demographic columns to Patients
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS bloodGroup TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS contactNumber TEXT;
ALTER TABLE Patients ADD COLUMN IF NOT EXISTS emergencyContact TEXT;
