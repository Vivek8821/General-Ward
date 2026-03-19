const request = require('supertest');
const express = require('express');

let mockTestRole = 'viewer';

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

jest.mock('../../services/PatientService', () => ({
  createPatient: jest.fn(),
  getAllPatients: jest.fn(),
  getArchivedPatients: jest.fn(),
  getPatientById: jest.fn(),
  getDischargeSummary: jest.fn(),
  updatePatient: jest.fn(),
  dischargePatient: jest.fn()
}));

const patientService = require('../../services/PatientService');
const patientRoutes = require('../../controllers/PatientController');
const { auditLog } = require('../../middleware/audit');
const { initDb, db } = require('../../db');

const getLatestAuditForResource = (userId, resource) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM AuditLogs WHERE userId = ? AND resource = ? ORDER BY timestamp DESC LIMIT 1`,
      [userId, resource],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });
};

describe('Audit logging enhancements (Phase 3)', () => {
  beforeAll(async () => {
    await initDb();
    // Seed patient so tenant-scoped middleware can validate patientId.
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ['p1', 'Test Patient', 'MRN-TEST-1', '1A', '1990-01-01', 'Test dx', 'None', 1],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  beforeEach(async () => {
    // Clean slate for consistent assertions.
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM AuditLogs WHERE userId = ?`, ['u1'], (err) => (err ? reject(err) : resolve()));
    });
  });

  it('records statusCode/success for denied access (403)', async () => {
    mockTestRole = 'viewer';
    const resource = '/api/patients/p1/discharge-summary';

    const app = express();
    app.use(express.json());
    app.use(auditLog);
    app.use('/api/patients', patientRoutes);

    const res = await request(app).get(resource);
    expect(res.status).toBe(403);

    // Wait a tick for the res.finish audit insert.
    await new Promise((r) => setTimeout(r, 30));

    const latest = await getLatestAuditForResource('u1', resource);
    expect(latest).toBeTruthy();
    expect(latest.statusCode).toBe(403);
    expect(latest.success).toBe(0);
  });

  it('records statusCode/success for allowed access (200)', async () => {
    mockTestRole = 'doctor';
    const resource = '/api/patients/p1/discharge-summary';
    patientService.getDischargeSummary.mockResolvedValue({ id: 'sum1' });

    const app = express();
    app.use(express.json());
    app.use(auditLog);
    app.use('/api/patients', patientRoutes);

    const res = await request(app).get(resource);
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 30));

    const latest = await getLatestAuditForResource('u1', resource);
    expect(latest).toBeTruthy();
    expect(latest.statusCode).toBe(200);
    expect(latest.success).toBe(1);
  });
});

