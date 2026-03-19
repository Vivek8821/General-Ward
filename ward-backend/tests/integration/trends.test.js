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
const statsRouter = require('../../routes/stats');

describe('Trend analytics endpoint (Phase 5.1)', () => {
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

  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM DailyStats WHERE patientId = ? AND type = 'vital'`, ['p1'], (err) => (err ? reject(err) : resolve()));
    });
  });

  it('computes pulse trend direction from latest two vital entries', async () => {
    const tPrev = '2026-03-19T00:00:00.000Z';
    const tLatest = '2026-03-19T01:00:00.000Z';

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `INSERT INTO DailyStats (id, patientId, type, data, recordedBy, timestamp)
           VALUES (?, ?, 'vital', ?, ?, ?)`,
          ['trend-prev', 'p1', JSON.stringify({ bpSystolic: 120, bpDiastolic: 70, temp: 37, pulse: 70, respRate: 16, spo2: 98 }), 'Dr. Test', tPrev],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO DailyStats (id, patientId, type, data, recordedBy, timestamp)
         VALUES (?, ?, 'vital', ?, ?, ?)`,
        ['trend-latest', 'p1', JSON.stringify({ bpSystolic: 120, bpDiastolic: 70, temp: 37.5, pulse: 80, respRate: 16, spo2: 97 }), 'Dr. Test', tLatest],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const app = express();
    app.use(express.json());
    app.use('/api/patients/:patientId/stats', statsRouter);

    const res = await request(app).get('/api/patients/p1/stats/trends');
    expect(res.status).toBe(200);
    expect(res.body.trends).toBeTruthy();
    expect(res.body.trends.pulse).toMatchObject({ direction: 'up' });
  });
});

