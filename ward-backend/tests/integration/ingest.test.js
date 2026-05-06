const request = require('supertest');
const express = require('express');

let mockTestRole = 'doctor';

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    authenticateToken: (req, res, next) => {
      req.user = { id: 'u1', name: 'Dr. Test', role: mockTestRole };
      next();
    },
    requireRole: actual.requireRole
  };
});

const { initDb, db } = require('../../db');
const observationsRoutes = require('../../controllers/ObservationController');

describe('Observation ingestion endpoint (Phase 5.3 backend)', () => {
  beforeAll(async () => {
    await initDb();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, 'tenant-default', ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['p1', 'Test Patient', 'MRN-TEST-1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  it('rejects invalid vital observations with VALIDATION_ERROR', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/observations', observationsRoutes);

    const res = await request(app).post('/api/observations/ingest').send({
      patientId: 'p1',
      measurementType: 'vital',
      data: {
        bpSystolic: 20,
        bpDiastolic: 10,
        temp: 37,
        pulse: 80
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('accepts valid vital observations and persists them', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/observations', observationsRoutes);

    const due = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const res = await request(app).post('/api/observations/ingest').send({
      patientId: 'p1',
      measurementType: 'vital',
      timestamp: due,
      source: 'device:simulator',
      units: { temp: 'C' },
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
    expect(res.body.id).toBeTruthy();

    const inserted = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM DailyStats WHERE id = ?`, [res.body.id], (err, row) => (err ? reject(err) : resolve(row)));
    });

    expect(inserted).toBeTruthy();
    expect(inserted.type).toBe('vital');
  });

  it('is idempotent when Idempotency-Key header is reused', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/observations', observationsRoutes);

    const due = new Date(Date.now() - 8 * 60 * 1000).toISOString();
    const idempotencyKey = 'idem-obs-1';

    const payload = {
      patientId: 'p1',
      measurementType: 'vital',
      timestamp: due,
      source: 'device:simulator',
      units: { temp: 'C' },
      data: {
        bpSystolic: 121,
        bpDiastolic: 71,
        temp: 37,
        pulse: 79,
        respRate: 16,
        spo2: 98
      }
    };

    const res1 = await request(app).post('/api/observations/ingest').set('Idempotency-Key', idempotencyKey).send(payload);
    expect(res1.status).toBe(201);
    expect(res1.body.id).toBeTruthy();

    const res2 = await request(app).post('/api/observations/ingest').set('Idempotency-Key', idempotencyKey).send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(res1.body.id);
  });
});

