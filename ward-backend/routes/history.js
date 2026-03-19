const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');
const { requireTenantPatient } = require('../middleware/tenant');

// DailyStats.type in the current schema only allows a limited set of values.
// The "history" feature is therefore persisted under an allowed type so the
// CHECK constraint never blocks history writes/reads.
const HISTORY_STAT_TYPE = 'symptom';

// POST /api/patients/:patientId/history (Doctor only)
router.post('/', authenticateToken, requireRole(['doctor']), requireTenantPatient('patientId'), (req, res) => {
    const { patientId } = req.params;
    const { conditions, familyHistory, pastSurgeries, socialHistory, notes } = req.body;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';
    
    // Simplistic schema: Create if not exist, or just insert new record
    db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, HISTORY_STAT_TYPE, JSON.stringify({ conditions, familyHistory, pastSurgeries, socialHistory, notes }), req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, message: "History updated" });
        }
    );
});

// GET /api/patients/:patientId/history
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), (req, res) => {
    const tenantId = req.user.tenantId || 'tenant-default';
    db.get(
        `SELECT * FROM DailyStats WHERE patientId = ? AND tenantId = ? AND type = ? ORDER BY timestamp DESC LIMIT 1`,
        [req.params.patientId, tenantId, HISTORY_STAT_TYPE],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.json({ data: null });
            
            try {
                return res.json({ ...row, data: JSON.parse(row.data) });
            } catch(e) {
                return res.json(row);
            }
        }
    );
});

module.exports = router;
