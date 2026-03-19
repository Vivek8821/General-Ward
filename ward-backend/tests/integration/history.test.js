const request = require('supertest');
const express = require('express');

let mockTestRole = 'doctor';
let mockTestTenantId = 'tenant-default';

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    authenticateToken: (req, res, next) => {
      req.user = {
        id: 'u1',
        name: 'Dr. Test',
        role: mockTestRole,
        tenantId: mockTestTenantId
      };
      next();
    },
    requireRole: actual.requireRole
  };
});

const { initDb, db } = require('../../db');
const patientRoutes = require('../../controllers/PatientController');

describe('History endpoints (DailyStats.type=history)', () => {
  beforeAll(async () => {
    await initDb();

    // Seed patients in two tenants so tenant-scoped middleware can be validated.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['hp1', 'tenant-default', 'History Patient 1', 'MRN-TEST-HP1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['hp2', 'tenant-b', 'History Patient 2', 'MRN-TEST-HP2', '1B', '1990-01-02', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Ensure tenantId is correct even if the row already existed from a previous test run.
    await new Promise((resolve, reject) => {
      db.run(`UPDATE Patients SET tenantId = ? WHERE id = ?`, ['tenant-default', 'hp1'], (err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve, reject) => {
      db.run(`UPDATE Patients SET tenantId = ? WHERE id = ?`, ['tenant-b', 'hp2'], (err) => (err ? reject(err) : resolve()));
    });
  });

  it('creates and retrieves history for the same tenant', async () => {
    mockTestTenantId = 'tenant-default';
    mockTestRole = 'doctor';

    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const sentNotes = 'Tenant-default history notes: ' + Math.random().toString(16).slice(2);
    const createRes = await request(app).post('/api/patients/hp1/history').send({
      conditions: ['asthma'],
      familyHistory: ['none'],
      pastSurgeries: ['none'],
      socialHistory: ['smoker'],
      notes: sentNotes
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();

    const listRes = await request(app).get('/api/patients/hp1/history');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toBeTruthy();
    expect(listRes.body.data.notes).toBe(sentNotes);
  });

  it('rejects history writes across tenant boundaries with 403', async () => {
    mockTestTenantId = 'tenant-b';
    mockTestRole = 'doctor';

    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const res = await request(app).post('/api/patients/hp1/history').send({
      conditions: [],
      familyHistory: [],
      pastSurgeries: [],
      socialHistory: [],
      notes: 'should-not-write'
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access denied by tenant scope.');
  });

  it('allows history writes for the correct tenant', async () => {
    mockTestTenantId = 'tenant-b';
    mockTestRole = 'doctor';

    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const sentNotes = 'Tenant-b history notes: ' + Math.random().toString(16).slice(2);
    const createRes = await request(app).post('/api/patients/hp2/history').send({
      conditions: ['diabetes'],
      familyHistory: [],
      pastSurgeries: [],
      socialHistory: [],
      notes: sentNotes
    });

    expect(createRes.status).toBe(201);

    const listRes = await request(app).get('/api/patients/hp2/history');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toBeTruthy();
    expect(listRes.body.data.notes).toBe(sentNotes);
  });
});

