const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, ROLE_PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { protect } = require('../middleware/protect');
const dbAdapter = require('../db-adapter');
const patientService = require('../services/PatientService');
const clinicalAuditService = require('../services/ClinicalAuditService');
const logger = require('../utils/logger');
const { validatePatientCreate, validatePatientUpdate, validateDischargePayload, bad } = require('../utils/validation');
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
    const errors = validatePatientCreate(req.body || {});
    if (errors.length > 0) return bad(res, errors);

    try {
        const tenantId = req.tenantId;
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
router.get('/', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const patients = await patientService.getAllPatients(tenantId);
        res.json({ data: patients });
    } catch (error) {
        error.status = 500;
        next(error);
    }
});

// Get archived (discharged) patients
router.get('/archives', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const patients = await patientService.getArchivedPatients(tenantId);
        res.json({ data: patients });
    } catch (error) {
        error.status = 500;
        next(error);
    }
});

// Full immutable file for one archived admission (snapshot at discharge)
router.get('/archives/:archiveId', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const record = await patientService.getHospitalArchive(req.params.archiveId, tenantId);
        res.json(record);
    } catch (error) {
        if (error.message === 'Archive not found') {
            return res.status(404).json({ error: error.message });
        }
        error.status = 500;
        next(error);
    }
});

// Get patient by ID — example using protect() to combine auth + RBAC + tenant scope in one step
router.get('/:id',
    protect(async (req) => {
        // 1. RBAC: user must have READ_PATIENT permission
        const perms = ROLE_PERMISSIONS[req.user.role] || [];
        if (!perms.includes(PERMISSIONS.READ_PATIENT))
            return { allowed: false, reason: `missing permission: ${PERMISSIONS.READ_PATIENT}` };
        // 2. Tenant scope: patient must belong to the caller's hospital
        const tenantId = req.tenantId;
        const row = await dbAdapter.get('SELECT id FROM Patients WHERE id = ? AND tenantId = ?', [req.params.id, tenantId]);
        if (!row) return { allowed: false, reason: 'patient not in tenant scope' };
        return true;
    }, { resource: 'patient' }),
    async (req, res, next) => {
        try {
            const tenantId = req.tenantId;
            const patient = await patientService.getPatientById(req.params.id, tenantId);
            res.json(patient);
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({ error: error.message });
            }
            error.status = 500;
            next(error);
        }
    }
);

// Get discharge summary
router.get('/:id/discharge-summary', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const summary = await patientService.getDischargeSummary(req.params.id, tenantId);
        res.json(summary);
    } catch (error) {
        if (error.message === 'Summary not found') {
            return res.status(404).json({ error: error.message });
        }
        error.status = 500;
        next(error);
    }
});

// Update patient
router.put('/:id', authenticateToken, authorizeAny([PERMISSIONS.WRITE_PATIENT]), requireTenantPatient('id'), async (req, res) => {
    const errors = validatePatientUpdate(req.body || {}, req.user.role);
    if (errors.length > 0) return bad(res, errors);

    try {
        const tenantId = req.tenantId;
        const result = await patientService.updatePatient(req.params.id, req.body, tenantId);
        try {
            await clinicalAuditService.recordPatientUpdate({
                tenantId,
                user: req.user,
                patientId: req.params.id,
                body: req.body,
            });
        } catch (auditErr) {
            logger.warn('clinical_audit_write_failed', { patientId: req.params.id, error: auditErr.message });
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
    const errors = validateDischargePayload(req.body || {});
    if (errors.length > 0) return bad(res, errors);

    try {
        const dischargedBy = req.user.name || 'Doctor';
        const tenantId = req.tenantId;
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
