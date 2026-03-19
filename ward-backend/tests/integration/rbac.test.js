const request = require('supertest');
const express = require('express');

let mockTestRole = 'viewer';

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    // Simulate an authenticated user with a configurable role.
    authenticateToken: (req, res, next) => {
      req.user = { id: 'u1', name: 'Dr. Test', role: mockTestRole };
      next();
    },
    // Use the real RBAC checker so behavior matches production code.
    requireRole: actual.requireRole
  };
});

const patientService = require('../../services/PatientService');

jest.mock('../../services/PatientService', () => ({
  createPatient: jest.fn(),
  getAllPatients: jest.fn(),
  getArchivedPatients: jest.fn(),
  getPatientById: jest.fn(),
  getDischargeSummary: jest.fn(),
  updatePatient: jest.fn(),
  dischargePatient: jest.fn()
}));

const patientRoutes = require('../../controllers/PatientController');

describe('RBAC enforcement (Phase 3)', () => {
  beforeEach(() => {
    patientService.getDischargeSummary.mockReset();
  });

  it('blocks unauthorized roles on discharge summary (403)', async () => {
    mockTestRole = 'viewer';
    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const res = await request(app).get('/api/patients/p1/discharge-summary');
    expect(res.status).toBe(403);
    expect(patientService.getDischargeSummary).not.toHaveBeenCalled();
  });

  it('allows doctor role on discharge summary (200)', async () => {
    mockTestRole = 'doctor';
    patientService.getDischargeSummary.mockResolvedValue({ id: 'sum1' });

    const app = express();
    app.use(express.json());
    app.use('/api/patients', patientRoutes);

    const res = await request(app).get('/api/patients/p1/discharge-summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'sum1' });
    expect(patientService.getDischargeSummary).toHaveBeenCalledTimes(1);
  });
});

