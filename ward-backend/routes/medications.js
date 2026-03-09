const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// POST /api/patients/:patientId/medications (Doctor only)
router.post('/', authenticateToken, requireRole(['doctor']), (req, res) => {
    const { patientId } = req.params;
    const { name, dosage, route, frequency, scheduledTimes, prn, startDate } = req.body;
    const id = crypto.randomUUID();
    
    db.run(
        `INSERT INTO Medications (id, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, prescribedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, patientId, name, dosage, route, frequency, scheduledTimes, prn ? 1 : 0, startDate, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, name, dosage, route });
        }
    );
});

// GET /api/patients/:patientId/medications
router.get('/', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM Medications WHERE patientId = ? ORDER BY startDate DESC`, [req.params.patientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
