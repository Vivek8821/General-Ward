const express = require('express');
const router = express.Router({ mergeParams: true }); 
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// POST /api/patients/:patientId/stats
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { patientId } = req.params;
    const { type, data } = req.body;
    const id = crypto.randomUUID();
    
    // validate type
    if (!['vital', 'symptom', 'diet', 'sleep'].includes(type)) {
        return res.status(400).json({ error: 'Invalid stat type' });
    }

    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;

    db.run(
        `INSERT INTO DailyStats (id, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?)`,
        [id, patientId, type, dataString, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, patientId, type, data: dataString, recordedBy: req.user.name });
        }
    );
});

// GET /api/patients/:patientId/stats
router.get('/', authenticateToken, (req, res) => {
    const { patientId } = req.params;
    const { type } = req.query; // optional filter by type
    
    let query = `SELECT * FROM DailyStats WHERE patientId = ?`;
    let params = [patientId];
    
    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => {
            try {
                return { ...row, data: JSON.parse(row.data) };
            } catch(e) {
                return row;
            }
        }));
    });
});

module.exports = router;
