const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireRole } = require('../middleware/auth');
const patientService = require('../services/PatientService');
const medicationRoutes = require('../routes/medications');
const historyRoutes = require('../routes/history');
const statRoutes = require('../routes/stats');
const escalationRoutes = require('./EscalationController');
const patientTasksRoutes = require('../routes/patientTasks');
const patientNotesRoutes = require('../routes/patientNotes');

// Sub-routers for nested resources
router.use('/:patientId/medications', medicationRoutes);
router.use('/:patientId/history', historyRoutes);
router.use('/:patientId/stats', statRoutes);
router.use('/:patientId/escalations', escalationRoutes);
router.use('/:patientId/tasks', patientTasksRoutes);
router.use('/:patientId/notes', patientNotesRoutes);

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
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
    try {
        const patients = await patientService.getAllPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get archived (discharged) patients
router.get('/archives', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
    try {
        const patients = await patientService.getArchivedPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get patient by ID
router.get('/:id', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
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

// Get discharge summary
router.get('/:id/discharge-summary', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
    try {
        const summary = await patientService.getDischargeSummary(req.params.id);
        res.json(summary);
    } catch (error) {
        if (error.message === 'Summary not found') {
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
