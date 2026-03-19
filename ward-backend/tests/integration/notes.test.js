const request = require('supertest');
const express = require('express');

const { initDb, db } = require('../../db');
const patientRoutes = require('../../controllers/PatientController');

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    authenticateToken: (req, res, next) => {
      req.user = { id: 'u1', name: 'Dr. Test', role: 'doctor' };
      next();
    },
    requireRole: actual.requireRole
  };
});

describe('Handover notes endpoints (Phase 4.4 backend)', () => {
  beforeAll(async () => {
    await initDb();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['p1', 'Test Patient', 'MRN-TEST-1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  it('rejects invalid note payloads with VALIDATION_ERROR', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const res = await request(app).post('/api/patients/p1/notes').send({
      shift: 'badshift',
      note: ''
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates and lists handover notes with shift filter', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const createRes = await request(app).post('/api/patients/p1/notes').send({
      shift: 'morning',
      note: 'Patient reports dizziness; observe orthostatics.'
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.patientId).toBe('p1');
    expect(createRes.body.shift).toBe('morning');

    const listRes = await request(app).get('/api/patients/p1/notes?shift=morning');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);

    const found = listRes.body.find((n) => n.id === createRes.body.id);
    expect(found).toBeTruthy();
  });
});

