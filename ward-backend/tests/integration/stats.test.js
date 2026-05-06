const request = require('supertest');
const express = require('express');

// Mock auth middleware so stats routes see an authenticated doctor user.
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user', name: 'Dr. Test', role: 'doctor' };
    next();
  },
  requireRole: () => (req, res, next) => next()
}));

const statsRouter = require('../../controllers/ObservationController');
const { initDb, db } = require('../../db');

describe('Stats routes validation and staleness', () => {
  let app;

  beforeAll(async () => {
    await initDb();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        ['p2', 'Test Patient', 'MRN-TEST', '01A', '1990-01-01', 'Test diagnosis'],
        (err) => (err ? reject(err) : resolve())
      );
    });
    app = express();
    app.use(express.json());
    // Inject a fake user before hitting the router, then reuse real auth/role middleware.
    app.use((req, res, next) => {
      req.user = { id: 'test-user', name: 'Dr. Test', role: 'doctor' };
      next();
    });
    app.use('/api/patients/:patientId/stats', statsRouter);
  });

  it('rejects physiologically impossible vital data with VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/patients/p2/stats')
      .send({
        type: 'vital',
        data: {
          bpSystolic: 20, // too low
          bpDiastolic: 10,
          temp: 37,
          pulse: 80
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('accepts reasonable vital data', async () => {
    const res = await request(app)
      .post('/api/patients/p2/stats')
      .send({
        type: 'vital',
        data: {
          bpSystolic: 120,
          bpDiastolic: 70,
          temp: 37,
          pulse: 80,
          respRate: 16,
          spo2: 98
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('vital');
    expect(res.body.data.pulse).toBe(80);
  });

  it('returns stats with staleness metadata', async () => {
    const res = await request(app)
      .get('/api/patients/p2/stats?type=vital');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('isStale');
      expect(res.body[0]).toHaveProperty('ageMinutes');
    }
  });
});

