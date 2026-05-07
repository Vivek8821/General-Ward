const request = require('supertest');
const express = require('express');
const { initDb, db } = require('../../db');
const reportsRoutes = require('../../routes/reports');
const patientRoutes = require('../../controllers/PatientController');
const jwt = require('jsonwebtoken');
const config = require('../../config');

describe('Patient Treatment Reports Integration', () => {
  let app;
  const tenantId = 'tenant-reports-' + Date.now();
  const userId = 'user-reports-' + Date.now();
  const token = jwt.sign({ id: userId, role: 'doctor', tenantId }, config.jwtSecret);
  let patientId = 'P-' + Date.now();

  beforeAll(async () => {
    await initDb();
    app = express();
    app.use(express.json());
    app.use('/api/reports', reportsRoutes);
    app.use('/api/patients', patientRoutes);

    // Setup basic fixture
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = OFF', (err) => {
          if (err) return reject(err);
          db.run(`DELETE FROM PatientReports`, (err) => {
            if (err) return reject(err);
            db.run(`DELETE FROM DailyStats`, (err) => {
              if (err) return reject(err);
              db.run(`DELETE FROM Users`, (err) => {
                if (err) return reject(err);
                db.run(`DELETE FROM Patients`, (err) => {
                  if (err) return reject(err);
                  db.run(`INSERT INTO Users (id, name, role, tenantId, passwordHash) VALUES (?, ?, ?, ?, ?)`,
                    [userId, 'Reporter', 'doctor', tenantId, 'hash'], (err) => {
                      if (err) return reject(err);
                      db.run(`INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [patientId, tenantId, 'Report Patient', 'MRN-REP-' + Date.now(), 'B-1', '1990-01-01', 'Test Dx'], (err) => {
                          if (err) return reject(err);
                          db.run(`INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            ['stat-1', tenantId, patientId, 'vital', JSON.stringify({ pulse: 70, temp: 37, bpSystolic: 120, bpDiastolic: 80, respRate: 16, spo2: 98 }), 'Dr. Test', new Date().toISOString()], (err) => {
                              if (err) return reject(err);
                              db.run('PRAGMA foreign_keys = ON', (err) => {
                                if (err) return reject(err);
                                resolve();
                              });
                            });
                        });
                    });
                });
              });
            });
          });
        });
      });
    });
  });

  it('should generate a PDF treatment report', async () => {
    const res = await request(app)
      .post(`/api/reports/patient/${patientId}/generate`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain('attachment');
    expect(Buffer.isBuffer(res.body)).toBe(true);

    // Verify audit log
    const auditLog = await new Promise((resolve) => {
      db.get(`SELECT * FROM ClinicalChangeLog WHERE entityType = 'report' AND action = 'generate' ORDER BY timestamp DESC LIMIT 1`, [], (err, row) => resolve(row));
    });
    expect(auditLog).toBeDefined();
    expect(auditLog.summary).toContain('FULL_TREATMENT');
  });

  it('should return report history for a patient', async () => {
    const res = await request(app)
      .get(`/api/reports/patient/${patientId}/history`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].patientId).toBe(patientId);
  });

  it('should verify a valid report payload', async () => {
    // Get the report ID and hash from history
    const historyRes = await request(app)
      .get(`/api/reports/patient/${patientId}/history`)
      .set('Authorization', `Bearer ${token}`);
    
    const report = historyRes.body[0];
    const payload = JSON.stringify({
      rid: report.id,
      pid: 'MRN-STRESS-FAKE', // pid is MRN in QR but we used mrn in controller
      t: tenantId,
      h: report.reportHash.substring(0, 16),
      v: 1
    });

    const res = await request(app)
      .get(`/api/reports/verify?payload=${encodeURIComponent(payload)}`);
    
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.patient.name).toBe('Report Patient');
  });

  it('should fail verification for tampered hash', async () => {
    const historyRes = await request(app)
      .get(`/api/reports/patient/${patientId}/history`)
      .set('Authorization', `Bearer ${token}`);
    
    const report = historyRes.body[0];
    const payload = JSON.stringify({
      rid: report.id,
      pid: 'MRN-REP-FAKE',
      t: tenantId,
      h: 'wrong-hash-part',
      v: 1
    });

    const res = await request(app)
      .get(`/api/reports/verify?payload=${encodeURIComponent(payload)}`);
    
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.message).toContain('Hash mismatch');
  });

  it('should enforce tenant isolation during generation', async () => {
    const alienToken = jwt.sign({ id: 'alien', role: 'doctor', tenantId: 'alien-tenant' }, config.jwtSecret);
    const res = await request(app)
      .post(`/api/reports/patient/${patientId}/generate`)
      .set('Authorization', `Bearer ${alienToken}`);
    
    expect(res.status).toBe(403);
  });
});
