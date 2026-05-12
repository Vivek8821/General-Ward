const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient, requireTenantEscalation } = require('../middleware/tenant');
const escalationService = require('../services/EscalationService');
const { validateEscalationReason, bad } = require('../utils/validation');
const { escalationLimiter } = require('../middleware/rateLimiters');

// POST /api/patients/:patientId/escalations
router.post('/', authenticateToken, escalationLimiter, authorizeAny([PERMISSIONS.WRITE_PATIENT, PERMISSIONS.WRITE_VITALS]), requireTenantPatient('patientId'), async (req, res, next) => {
    const err = validateEscalationReason((req.body || {}).reason);
    if (err) return bad(res, [err]);

    try {
        const tenantId = req.tenantId;
        const result = await escalationService.createEscalation(req.params.patientId, req.body.reason.trim(), req.user.name, tenantId);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/escalations/all
router.get('/all', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const escalations = await escalationService.getPendingEscalations(tenantId);
        res.json(escalations);
    } catch (error) {
        next(error);
    }
});

// POST /api/patients/:patientId/escalations/:escalationId/review
router.post('/:escalationId/review', authenticateToken, escalationLimiter, authorize(PERMISSIONS.WRITE_PATIENT), requireTenantEscalation('escalationId'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const result = await escalationService.reviewEscalation(req.params.escalationId, tenantId);
        res.json(result);
    } catch (error) {
        if (error.message === 'Escalation not found') {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
});

module.exports = router;
