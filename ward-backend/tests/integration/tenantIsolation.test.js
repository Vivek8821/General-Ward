const request = require('supertest');
const express = require('express');

const patientRoutes = require('../../controllers/PatientController');
const escalationRoutes = require('../../controllers/EscalationController');
const observationsRoutes = require('../../controllers/ObservationController');

const { initDb, db } = require('../../db');

let mockTenantId = 'tenant-default';

jest.mock('../../middleware/auth', () => {
  return {
    authenticateToken: (req, res, next) => {
      req.user = {
        id: 'u1',
        name: 'Dr. Test',
        role: 'doctor',
        tenantId: mockTenantId
      };
      next();
    },
    // Ignore role checks; we validate tenant scoping separately.
    requireRole: () => (req, res, next) => next()
  };
});

describe('Phase 5.1 tenant isolation (403 cross-tenant, 200 same-tenant)', () => {
  const patientDefault = 'tpA';
  const patientTenantB = 'tpB';

  beforeAll(async () => {
    await initDb();

    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM Escalations`, (err) => (err ? reject(err) : resolve()));
    });

    // Seed patients in two tenants so tenant-scoped middleware can be validated.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO Patients
          (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientDefault,
          'tenant-default',
          'Tenant Default Patient',
          'MRN-TP-A',
          '1A',
          '1990-01-01',
          'Test dx',
          'None',
          1,
          'active'
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO Patients
          (id, tenantId, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientTenantB,
          'tenant-b',
          'Tenant B Patient',
          'MRN-TP-B',
          '1B',
          '1990-01-02',
          'Test dx',
          'None',
          1,
          'active'
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);
    app.use('/api/escalations', escalationRoutes);
    app.use('/api/observations', observationsRoutes);
    return app;
  }

  it('stats: allows same-tenant write/read and blocks cross-tenant (403)', async () => {
    const app = makeApp();

    // Same-tenant (tenant-default)
    mockTenantId = 'tenant-default';
    const postRes = await request(app).post(`/api/patients/${patientDefault}/stats`).send({
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
    expect(postRes.status).toBe(201);

    const getRes = await request(app).get(`/api/patients/${patientDefault}/stats?type=vital&limit=50`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);

    // Cross-tenant (tenant-b accessing tenant-default patient)
    mockTenantId = 'tenant-b';
    const crossPostRes = await request(app).post(`/api/patients/${patientDefault}/stats`).send({
      type: 'vital',
      data: {
        bpSystolic: 121,
        bpDiastolic: 71,
        temp: 37,
        pulse: 81,
        respRate: 16,
        spo2: 98
      }
    });
    expect(crossPostRes.status).toBe(403);
    expect(crossPostRes.body.error).toBe('Access denied by tenant scope.');
  });

  it('medications: allows same-tenant create and blocks cross-tenant reads (403)', async () => {
    const app = makeApp();

    mockTenantId = 'tenant-default';
    const created = await request(app).post(`/api/patients/${patientDefault}/medications`).send({
      name: 'StressMedA',
      dosage: '10mg',
      frequency: 'BID',
      route: 'Oral'
    });
    expect(created.status).toBe(201);

    mockTenantId = 'tenant-b';
    const crossGet = await request(app).get(`/api/patients/${patientDefault}/medications`);
    expect(crossGet.status).toBe(403);
    expect(crossGet.body.error).toBe('Access denied by tenant scope.');

    // Same-tenant for tenant-b patient should succeed once a med exists
    const createdB = await request(app).post(`/api/patients/${patientTenantB}/medications`).send({
      name: 'StressMedB',
      dosage: '5mg',
      frequency: 'OD',
      route: 'Oral'
    });
    expect(createdB.status).toBe(201);

    const sameGetB = await request(app).get(`/api/patients/${patientTenantB}/medications`);
    expect(sameGetB.status).toBe(200);
  });

  it('tasks: allows same-tenant create/list and blocks cross-tenant list (403)', async () => {
    const app = makeApp();

    const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    mockTenantId = 'tenant-default';
    const createTask = await request(app).post(`/api/patients/${patientDefault}/tasks`).send({
      type: 'vital',
      dueAt,
      notes: 'Tenant-default task'
    });
    expect(createTask.status).toBe(201);

    // Cross tenant listing should be denied by requireTenantPatient
    mockTenantId = 'tenant-b';
    const crossList = await request(app).get(`/api/patients/${patientDefault}/tasks?status=open`);
    expect(crossList.status).toBe(403);
    expect(crossList.body.error).toBe('Access denied by tenant scope.');

    // Same-tenant for tenant-b patient
    const dueAtB = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const createTaskB = await request(app).post(`/api/patients/${patientTenantB}/tasks`).send({
      type: 'vital',
      dueAt: dueAtB,
      notes: 'Tenant-b task'
    });
    expect(createTaskB.status).toBe(201);

    const sameListB = await request(app).get(`/api/patients/${patientTenantB}/tasks?status=open&limit=50`);
    expect(sameListB.status).toBe(200);
    expect(Array.isArray(sameListB.body)).toBe(true);
  });

  it('notes: allows same-tenant create/list and blocks cross-tenant list (403)', async () => {
    const app = makeApp();

    mockTenantId = 'tenant-default';
    const createNote = await request(app).post(`/api/patients/${patientDefault}/notes`).send({
      shift: 'morning',
      note: 'Tenant-default note',
      tags: 'stress'
    });
    expect(createNote.status).toBe(201);

    mockTenantId = 'tenant-b';
    const crossList = await request(app).get(`/api/patients/${patientDefault}/notes?shift=morning&limit=50`);
    expect(crossList.status).toBe(403);
    expect(crossList.body.error).toBe('Access denied by tenant scope.');

    // Same-tenant for tenant-b patient
    const createNoteB = await request(app).post(`/api/patients/${patientTenantB}/notes`).send({
      shift: 'morning',
      note: 'Tenant-b note',
      tags: 'stress'
    });
    expect(createNoteB.status).toBe(201);

    const sameListB = await request(app).get(`/api/patients/${patientTenantB}/notes?shift=morning&limit=50`);
    expect(sameListB.status).toBe(200);
    expect(Array.isArray(sameListB.body)).toBe(true);
  });

  it('observations ingest: allows same-tenant and blocks cross-tenant (403)', async () => {
    const app = makeApp();

    const due = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockTenantId = 'tenant-default';
    const ok = await request(app).post('/api/observations/ingest').send({
      patientId: patientDefault,
      measurementType: 'vital',
      timestamp: due,
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
    expect(ok.status).toBe(201);

    mockTenantId = 'tenant-b';
    const denied = await request(app).post('/api/observations/ingest').send({
      patientId: patientDefault,
      measurementType: 'vital',
      timestamp: due,
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
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('Access denied by tenant scope or patient not found');
  });

  it('escalations: tenant-scoped global triage endpoint (tenant-b sees none of tenant-default escalations)', async () => {
    const app = makeApp();

    mockTenantId = 'tenant-default';
    const created = await request(app).post(`/api/patients/${patientDefault}/escalations`).send({
      reason: 'Tenant-default escalation'
    });
    expect(created.status).toBe(201);

    mockTenantId = 'tenant-b';
    const pending = await request(app).get('/api/escalations/all');
    expect(pending.status).toBe(200);
    expect(Array.isArray(pending.body)).toBe(true);
    expect(pending.body.length).toBe(0);
  });
});

