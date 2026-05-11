const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient, requireTenantEscalation } = require('../middleware/tenant');
const escalationService = require('../services/EscalationService');
const { validateEscalationReason, bad } = require('../utils/validation');

// POST /api/patients/:patientId/escalations (Nurse or Doctor)
router.post('/', authenticateToken, authorizeAny([PERMISSIONS.WRITE_PATIENT, PERMISSIONS.WRITE_VITALS]), requireTenantPatient('patientId'), async (req, res) => {
    const err = validateEscalationReason((req.body || {}).reason);
    if (err) return bad(res, [err]);

    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await escalationService.createEscalation(req.params.patientId, req.body.reason.trim(), req.user.name, tenantId);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/escalations/all (Global triage endpoint)
router.get('/all', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const escalations = await escalationService.getPendingEscalations(tenantId);
        res.json(escalations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark as reviewed (Doctor only)
router.post('/:escalationId/review', authenticateToken, authorize(PERMISSIONS.WRITE_PATIENT), requireTenantEscalation('escalationId'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await escalationService.reviewEscalation(req.params.escalationId, tenantId);
        res.json(result);
    } catch (error) {
        if (error.message === 'Escalation not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
