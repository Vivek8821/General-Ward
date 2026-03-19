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
const patientRoutes = require('../../controllers/PatientController');
const tasksRoutes = require('../../routes/tasks');

describe('Tasks workflow endpoints (Phase 4.2 backend)', () => {
  beforeAll(async () => {
    await initDb();

    // Seed a patient so FK constraints pass.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['p1', 'Test Patient', 'MRN-TEST-1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  it('creates a task for a patient and lists it (open)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createRes = await request(app)
      .post('/api/patients/p1/tasks')
      .send({ type: 'vital', dueAt, notes: 'Check BP re-test' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.patientId).toBe('p1');
    expect(createRes.body.status).toBe('open');

    const listRes = await request(app).get('/api/patients/p1/tasks?status=open');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);

    // Complete via cross-patient endpoint.
    const taskId = listRes.body[0].id;
    const tasksApp = express();
    tasksApp.use(express.json());
    tasksApp.use('/api/tasks', tasksRoutes);

    const completeRes = await request(tasksApp).put(`/api/tasks/${taskId}/complete`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.message).toContain('Task completed successfully');

    const myTasksRes = await request(tasksApp).get('/api/tasks/my');
    expect(myTasksRes.status).toBe(200);
    expect(Array.isArray(myTasksRes.body)).toBe(true);
  });

  it('rejects invalid payloads with VALIDATION_ERROR', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const res = await request(app).post('/api/patients/p1/tasks').send({
      type: 'invalid',
      dueAt: 'not-a-date'
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

