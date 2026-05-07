const request = require('supertest');
const express = require('express');
const patientRoutes = require('../../controllers/PatientController');
const { initDb, db } = require('../../db');
const authMiddleware = require('../../middleware/auth');

// Mock auth
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user', tenantId: 'tenant-default', role: 'doctor' };
    next();
  }
}));

describe('Patient Update Guard', () => {
    let app;

    beforeAll(async () => {
        await initDb();
        app = express();
        app.use(express.json());
        app.use('/api/patients', patientRoutes);
    });

    it('should preserve admittedAt when updating other fields', async () => {
        const originalDate = '2023-01-01T12:00:00Z';
        const patientId = 'test-patient-guard';
        
        // Setup patient
        await new Promise((resolve) => {
          db.run(`DELETE FROM Patients WHERE id = ?`, [patientId], () => {
            db.run(`INSERT INTO Patients (id, tenantId, name, mrn, bedNumber, dob, diagnosis, careIntensity, admittedAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [patientId, 'tenant-default', 'Old Name', 'MRN-GUARD', 'B1', '1990-01-01', 'Initial', 1, originalDate],
              () => resolve()
            );
          });
        });

        const updatePayload = {
          name: 'New Name',
          bedNumber: 'B2',
          dob: '1990-01-01',
          diagnosis: 'Updated',
          careIntensity: 2
          // admittedAt is missing
        };

        const res = await request(app).put(`/api/patients/${patientId}`).send(updatePayload);
        expect(res.status).toBe(200);

        const updated = await new Promise((resolve) => {
          db.get(`SELECT * FROM Patients WHERE id = ?`, [patientId], (err, row) => resolve(row));
        });

        expect(updated.name).toBe('New Name');
        expect(updated.admittedAt).toBe(originalDate);
    });
});
