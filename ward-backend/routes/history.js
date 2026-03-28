const express = require('express');
const router = express.Router({ mergeParams: true });
const dbAdapter = require('../dbAdapter');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');
const { requireTenantPatient } = require('../middleware/tenant');

const HISTORY_STAT_TYPE = 'symptom';

router.post('/', authenticateToken, requireRole(['doctor']), requireTenantPatient('patientId'), async (req, res) => {
    const { patientId } = req.params;
    const { conditions, familyHistory, pastSurgeries, socialHistory, notes } = req.body;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';

    try {
        await dbAdapter.run(
            `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                patientId,
                HISTORY_STAT_TYPE,
                JSON.stringify({ conditions, familyHistory, pastSurgeries, socialHistory, notes }),
                req.user.name,
            ]
        );
        res.status(201).json({ id, message: 'History updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), async (req, res) => {
    const tenantId = req.user.tenantId || 'tenant-default';
    try {
        const row = await dbAdapter.get(
            `SELECT * FROM DailyStats WHERE patientId = ? AND tenantId = ? AND type = ? ORDER BY timestamp DESC LIMIT 1`,
            [req.params.patientId, tenantId, HISTORY_STAT_TYPE]
        );
        if (!row) return res.json({ data: null });

        try {
            return res.json({ ...row, data: JSON.parse(row.data) });
        } catch (e) {
            return res.json(row);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
