const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// POST /api/patients/:patientId/history (Doctor only)
router.post('/', authenticateToken, requireRole(['doctor']), (req, res) => {
    const { patientId } = req.params;
    const { conditions, familyHistory, pastSurgeries, socialHistory, notes } = req.body;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';
    
    // Simplistic schema: Create if not exist, or just insert new record
    db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy) VALUES (?, ?, ?, 'history', ?, ?)`,
        [id, tenantId, patientId, JSON.stringify({ conditions, familyHistory, pastSurgeries, socialHistory, notes }), req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, message: "History updated" });
        }
    );
});

// GET /api/patients/:patientId/history
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), (req, res) => {
    db.get(
        `SELECT * FROM DailyStats WHERE patientId = ? AND type = 'history' ORDER BY timestamp DESC LIMIT 1`,
        [req.params.patientId],
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
