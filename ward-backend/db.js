const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ward.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Users Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
            passwordHash TEXT NOT NULL
          )
        `);

        // Patients Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mrn TEXT UNIQUE NOT NULL,
            bedNumber TEXT NOT NULL,
            dob TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            allergies TEXT,
            careIntensity INTEGER CHECK(careIntensity IN (1, 2, 3, 4)) DEFAULT 1,
            status TEXT DEFAULT 'active'
          )
        `);

        // Daily Stats Table
        // Using JSON/Text for 'data' flexiblity across different stat types
        db.run(`
          CREATE TABLE IF NOT EXISTS DailyStats (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            type TEXT CHECK(type IN ('vital', 'symptom', 'diet', 'sleep')) NOT NULL,
            data TEXT NOT NULL,
            recordedBy TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id) ON DELETE CASCADE
          )
        `);

        // Medications Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Medications (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            route TEXT NOT NULL,
            frequency TEXT NOT NULL,
            scheduledTimes TEXT,
            prn BOOLEAN DEFAULT 0,
            startDate DATE NOT NULL,
            prescribedBy TEXT NOT NULL,
            FOREIGN KEY (patientId) REFERENCES Patients(id) ON DELETE CASCADE
          )
        `);

        // Escalations Table
        db.run(`
          CREATE TABLE IF NOT EXISTS Escalations (
            id TEXT PRIMARY KEY,
            patientId TEXT NOT NULL,
            reason TEXT NOT NULL,
            escalatedBy TEXT NOT NULL,
            status TEXT CHECK(status IN ('pending', 'reviewed')) DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patientId) REFERENCES Patients(id) ON DELETE CASCADE
          )
        `);

        // Audit Logs Table
        db.run(`
          CREATE TABLE IF NOT EXISTS AuditLogs (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            userRole TEXT NOT NULL,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            ipAddress TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

// Auto-init on load for normal server runs
initDb();

module.exports = { db, initDb };
