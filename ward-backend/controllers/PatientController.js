const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const patientService = require('../services/PatientService');
const clinicalAuditService = require('../services/ClinicalAuditService');
const medicationRoutes = require('./MedicationController');
const observationRoutes = require('./ObservationController');
const escalationRoutes = require('./EscalationController');
const handoverRoutes = require('./HandoverController');

// Sub-routers for nested resources
router.use('/:patientId/medications', medicationRoutes);
router.use('/:patientId/history', observationRoutes);
router.use('/:patientId/stats', observationRoutes);
router.use('/:patientId/escalations', escalationRoutes);
router.use('/:patientId', handoverRoutes);

// Create a patient (Doctor or Nurse)
router.post('/', authenticateToken, authorizeAny([PERMISSIONS.WRITE_PATIENT]), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await patientService.createPatient({ ...req.body, tenantId });
        await clinicalAuditService.recordPatientUpdate({
            tenantId,
            user: req.user,
            patientId: result.id,
            body: req.body,
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all patients
router.get('/', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const patients = await patientService.getAllPatients(tenantId);
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get archived (discharged) patients
router.get('/archives', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const patients = await patientService.getArchivedPatients(tenantId);
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Full immutable file for one archived admission (snapshot at discharge)
router.get('/archives/:archiveId', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const record = await patientService.getHospitalArchive(req.params.archiveId, tenantId);
        res.json(record);
    } catch (error) {
        if (error.message === 'Archive not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Get patient by ID
router.get('/:id', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const patient = await patientService.getPatientById(req.params.id, tenantId);
        res.json(patient);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Get discharge summary
router.get('/:id/discharge-summary', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const summary = await patientService.getDischargeSummary(req.params.id, tenantId);
        res.json(summary);
    } catch (error) {
        if (error.message === 'Summary not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update patient
router.put('/:id', authenticateToken, authorizeAny([PERMISSIONS.WRITE_PATIENT]), requireTenantPatient('id'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await patientService.updatePatient(req.params.id, req.body, tenantId);
        try {
            await clinicalAuditService.recordPatientUpdate({
                tenantId,
                user: req.user,
                patientId: req.params.id,
                body: req.body,
            });
        } catch (auditErr) {
            console.error('[ClinicalChangeLog] patient update', auditErr.message);
        }
        res.json(result);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

// Discharge patient (Doctor only)
router.post('/:id/discharge', authenticateToken, authorize(PERMISSIONS.DISCHARGE_PATIENT), requireTenantPatient('id'), async (req, res) => {
    try {
        const dischargedBy = req.user.name || 'Doctor';
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await patientService.dischargePatient(req.params.id, req.body, dischargedBy, tenantId);
        await clinicalAuditService.recordPatientUpdate({
            tenantId,
            user: req.user,
            patientId: req.params.id,
            body: { status: 'discharged' },
        });
        res.json(result);
    } catch (error) {
        if (error.message === 'Patient not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message }); // Changed to 400 for validation errors
    }
});

module.exports = router;
