const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireRole } = require('../middleware/auth');
const escalationService = require('../services/EscalationService');

// POST /api/patients/:patientId/escalations (Nurse or Doctor)
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await escalationService.createEscalation(req.params.patientId, req.body.reason, req.user.name, tenantId);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/escalations/all (Global triage endpoint)
router.get('/all', authenticateToken, requireRole(['doctor']), async (req, res) => {
    try {
        const escalations = await escalationService.getPendingEscalations();
        res.json(escalations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark as reviewed (Doctor only)
router.post('/:escalationId/review', authenticateToken, requireRole(['doctor']), async (req, res) => {
    try {
        const result = await escalationService.reviewEscalation(req.params.escalationId);
        res.json(result);
    } catch (error) {
        if (error.message === 'Escalation not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
