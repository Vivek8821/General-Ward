const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const patientService = require('../services/PatientService');

// Create a patient (Doctor or Nurse)
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), async (req, res) => {
    try {
        const result = await patientService.createPatient(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all patients
router.get('/', authenticateToken, async (req, res) => {
    try {
        const patients = await patientService.getAllPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get patient by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const patient = await patientService.getPatientById(req.params.id);
        res.json(patient);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update patient
router.put('/:id', authenticateToken, requireRole(['doctor', 'nurse']), async (req, res) => {
    try {
        const result = await patientService.updatePatient(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

// Discharge patient (Doctor only)
router.post('/:id/discharge', authenticateToken, requireRole(['doctor']), async (req, res) => {
    try {
        const dischargedBy = req.user.name || 'Doctor';
        const result = await patientService.dischargePatient(req.params.id, req.body, dischargedBy);
        res.json(result);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message }); // Changed to 400 for validation errors
    }
});

module.exports = router;
