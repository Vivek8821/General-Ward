-- Migration 015: Extended patient demographics for clinical discharge report
ALTER TABLE Patients ADD COLUMN uhid TEXT;
ALTER TABLE Patients ADD COLUMN nationality TEXT;
ALTER TABLE Patients ADD COLUMN occupation TEXT;
ALTER TABLE Patients ADD COLUMN maritalStatus TEXT CHECK(maritalStatus IS NULL OR maritalStatus IN ('single','married','widowed','divorced','other'));
ALTER TABLE Patients ADD COLUMN codeStatus TEXT CHECK(codeStatus IS NULL OR codeStatus IN ('full_code','dnr','dni','comfort_only')) DEFAULT 'full_code';
ALTER TABLE Patients ADD COLUMN insuranceProvider TEXT;
ALTER TABLE Patients ADD COLUMN insurancePolicyNo TEXT;
ALTER TABLE Patients ADD COLUMN tpaName TEXT;
ALTER TABLE Patients ADD COLUMN tpaClaimNo TEXT;
