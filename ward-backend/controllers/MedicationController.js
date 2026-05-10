const express = require('express');
const router = express.Router({ mergeParams: true });
const medicationService = require('../services/MedicationService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const {
    requireTenantPatient,
    requireTenantMedication,
    requireTenantMedicationAdministration,
} = require('../middleware/tenant');

const VALID_ADMIN_STATUSES = ['given', 'refused', 'missed'];

const validateMedicationPayload = (payload) => {
    const { name, dosage, frequency, scheduledTimes } = payload;
    if (!name || !dosage || !frequency) return false;

    if (scheduledTimes !== undefined && scheduledTimes !== null && String(scheduledTimes).trim() !== '') {
        if (typeof scheduledTimes !== 'string') return false;
        const parts = scheduledTimes
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

        if (parts.length === 0) return false;
        for (const t of parts) {
            if (!/^\d{2}:\d{2}$/.test(t)) return false;
            const [hh, mm] = t.split(':').map(Number);
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
        }
    }
    return true;
};

const validateAdministrationPayload = (payload) => {
    const { status, notes } = payload;
    if (!status || !VALID_ADMIN_STATUSES.includes(status)) return false;
    if ((status === 'refused' || status === 'missed') && (!notes || notes.trim().length === 0)) return false;
    return true;
};

// GET /api/patients/:patientId/medications
router.get('/', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.getMedications(req.params.patientId, tenantId);
        res.json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// POST /api/patients/:patientId/medications
router.post('/', authenticateToken, authorizeAny([PERMISSIONS.WRITE_MEDICATIONS]), requireTenantPatient('patientId'), async (req, res) => {
    if (!validateMedicationPayload(req.body)) {
        return res.status(400).json({ error: 'Invalid medication payload', code: 'VALIDATION_ERROR' });
    }
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.prescribeMedication(req.params.patientId, tenantId, req.user, req.body);
        res.status(201).json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// GET /api/patients/:patientId/medications/administrations
router.get('/administrations', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.getAdministrations(req.params.patientId, tenantId, req.query);
        res.json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// POST /api/patients/:patientId/medications/:medId/administer
router.post('/:medId/administer', authenticateToken, authorizeAny([PERMISSIONS.ADMINISTER_MEDS]), requireTenantMedication('medId', 'patientId'), async (req, res) => {
    if (!validateAdministrationPayload(req.body)) {
        return res.status(400).json({ error: 'Invalid administration payload', code: 'VALIDATION_ERROR' });
    }
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.administerMedication(req.params.medId, req.params.patientId, tenantId, req.user, req.body);
        res.status(201).json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// PUT /api/patients/:patientId/medications/administrations/:adminId
router.put('/administrations/:adminId', authenticateToken, authorizeAny([PERMISSIONS.ADMINISTER_MEDS]), requireTenantMedicationAdministration('adminId', 'patientId'), async (req, res, next) => {
    if (!validateAdministrationPayload(req.body)) {
        return res.status(400).json({ error: 'Invalid administration payload', code: 'VALIDATION_ERROR' });
    }
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.updateAdministration(req.params.adminId, req.params.patientId, tenantId, req.user, req.body);
        res.json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// DELETE /api/patients/:patientId/medications/administrations/:adminId
router.delete('/administrations/:adminId', authenticateToken, authorizeAny([PERMISSIONS.ADMINISTER_MEDS]), requireTenantMedicationAdministration('adminId', 'patientId'), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.deleteAdministration(req.params.adminId, req.params.patientId, tenantId, req.user);
        res.json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

// PUT /api/patients/:patientId/medications/:medId
router.put('/:medId', authenticateToken, authorizeAny([PERMISSIONS.WRITE_MEDICATIONS]), requireTenantMedication('medId', 'patientId'), async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await medicationService.updateMedicationStatus(req.params.medId, req.params.patientId, tenantId, req.user, req.body.status);
        res.json(result);
    } catch (err) {
        err.status = 500;
        next(err);
    }
});

module.exports = router;
