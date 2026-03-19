const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user', name: 'Dr. Test', role: 'doctor' };
    next();
  },
  requireRole: () => (req, res, next) => next()
}));

const medicationsRouter = require('../../routes/medications');
const { initDb } = require('../../db');

describe('Medications routes validation', () => {
  let app;

  beforeAll(async () => {
    await initDb();
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

