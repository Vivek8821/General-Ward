const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// POST /api/patients/:patientId/escalations (Nurse or Doctor)
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { patientId } = req.params;
    const { reason } = req.body;
    const id = crypto.randomUUID();
    
    // We need to use a single transaction or sequentially execute both queries
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
            `INSERT INTO Escalations (id, patientId, reason, escalatedBy) VALUES (?, ?, ?, ?)`,
            [id, patientId, reason, req.user.name],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                db.run(
                    `UPDATE Patients SET status = 'escalated' WHERE id = ?`,
                    [patientId],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        
                        db.run('COMMIT', () => {
                            res.status(201).json({ id, patientId, reason, status: 'pending' });
                        });
                    }
                );
            }
        );
    });
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
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(`UPDATE Escalations SET status = 'reviewed' WHERE id = ?`, [req.params.escalationId], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            
            // Need to get the patientId from the escalation to update the patient
            db.get(`SELECT patientId FROM Escalations WHERE id = ?`, [req.params.escalationId], (err, row) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                if (row) {
                    db.run(`UPDATE Patients SET status = 'active' WHERE id = ? AND status = 'escalated'`, [row.patientId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        
                        db.run('COMMIT', () => {
                            res.json({ message: 'Escalation marked as reviewed' });
                        });
                    });
                } else {
                    db.run('COMMIT', () => {
                        res.json({ message: 'Escalation marked as reviewed (Patient not found to update)' });
                    });
                }
            });
        });
    });
});

module.exports = router;
