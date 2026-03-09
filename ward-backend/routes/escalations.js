const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// POST /api/patients/:patientId/escalations (Nurse or Doctor)
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { patientId } = req.params;
    const { reason } = req.body;
    const id = crypto.randomUUID();
    
    db.run(
        `INSERT INTO Escalations (id, patientId, reason, escalatedBy) VALUES (?, ?, ?, ?)`,
        [id, patientId, reason, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, patientId, reason, status: 'pending' });
        }
    );
});

// GET /api/escalations (Global triage endpoint)
router.get('/all', authenticateToken, requireRole(['doctor']), (req, res) => {
    db.all(`SELECT * FROM Escalations WHERE status = 'pending' ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Mark as reviewed (Doctor only)
router.post('/:escalationId/review', authenticateToken, requireRole(['doctor']), (req, res) => {
    db.run(`UPDATE Escalations SET status = 'reviewed' WHERE id = ?`, [req.params.escalationId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Escalation marked as reviewed' });
    });
});

module.exports = router;
