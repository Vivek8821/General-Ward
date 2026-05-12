const express = require('express');
const router = express.Router({ mergeParams: true });
const observationService = require('../services/ObservationService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { validateStats } = require('../utils/validation');
const rateLimit = require('express-rate-limit');

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many observation ingest requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/patients/:patientId/stats OR /api/patients/:patientId/history
router.post('/', authenticateToken, authorizeAny([PERMISSIONS.WRITE_VITALS, PERMISSIONS.WRITE_PATIENT]), requireTenantPatient('patientId'), async (req, res) => {
    let { type, data } = req.body;

    // Support legacy /history mount where data is the root body
    const isHistoryMount = req.baseUrl.endsWith('/history');
    if (isHistoryMount && !type) {
        type = 'history';
        data = req.body;
    }

    if (!type || !['vital', 'symptom', 'diet', 'sleep', 'history'].includes(type) || !validateStats(type, data)) {
        return res.status(400).json({ error: 'Invalid stat type or malformed data', code: 'VALIDATION_ERROR' });
    }

    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await observationService.recordObservation(req.params.patientId, tenantId, req.user, {
            type,
            data,
            timestamp: req.body.timestamp
        });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// GET /api/patients/:patientId/stats OR /api/patients/:patientId/history
router.get('/', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const isHistoryMount = req.baseUrl.endsWith('/history');
        
        if (isHistoryMount) {
            const result = await observationService.getObservations(req.params.patientId, tenantId, { type: 'history', limit: 1 });
            if (result.length === 0) return res.json({ data: null });
            return res.json(result[0]);
        }

        const result = await observationService.getObservations(req.params.patientId, tenantId, req.query);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// GET /api/patients/:patientId/stats/ews/latest
router.get('/ews/latest', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await observationService.getLatestEws(req.params.patientId, tenantId);
        if (!result) return res.status(404).json({ error: 'No vitals found' });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// GET /api/patients/:patientId/stats/trends
router.get('/trends', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const result = await observationService.getTrends(req.params.patientId, tenantId);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// POST /api/observations/ingest (Note: this is mounted at /api/observations)
router.post('/ingest', authenticateToken, ingestLimiter, authorizeAny([PERMISSIONS.WRITE_VITALS]), async (req, res) => {
    const { patientId, measurementType, data } = req.body || {};
    if (!patientId || measurementType !== 'vital' || !validateStats('vital', data)) {
        return res.status(400).json({ error: 'Invalid ingestion payload', code: 'VALIDATION_ERROR' });
    }
    try {
        const tenantId = req.user.tenantId || 'tenant-default';
        const idempotencyKey = req.get('Idempotency-Key');
        const { status, body } = await observationService.ingestObservation(patientId, tenantId, req.user, req.body, idempotencyKey);
        res.status(status).json(body);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;
