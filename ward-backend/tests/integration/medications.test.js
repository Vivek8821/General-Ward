const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user', name: 'Dr. Test', role: 'doctor' };
    next();
  },
  requireRole: () => (req, res, next) => next()
}));

const medicationsRouter = require('../../controllers/MedicationController');
const { initDb, db } = require('../../db');

describe('Medications routes validation', () => {
  let app;

  beforeAll(async () => {
    await initDb();

    // Seed a patient so tenant-scoped middleware can validate patientId.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['p1', 'Test Patient', 'MRN-TEST-1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Seed a medication so tenant-scoped middleware can validate medId.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Medications (id, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, prescribedBy, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['m1', 'p1', 'Test Med', '10mg', 'Oral', 'BID', null, 0, '2026-01-01', 'Dr. Test'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    app = express();
    app.use(express.json());
    app.use('/api/patients/:patientId/medications', medicationsRouter);
  });

  it('rejects medication creation with missing required fields', async () => {
    const res = await request(app)
      .post('/api/patients/p1/medications')
      .send({
        name: '',
        dosage: '',
        frequency: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects administration with invalid status', async () => {
    const res = await request(app)
      .post('/api/patients/p1/medications/m1/administer')
      .send({
        status: 'unknown',
        notes: 'Test'
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

