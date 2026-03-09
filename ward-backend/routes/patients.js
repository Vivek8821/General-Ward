const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// Create a patient (Doctor or Nurse)
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity } = req.body;
    const id = crypto.randomUUID();
    
    db.run(
        `INSERT INTO Patients (id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [id, name, mrn, bedNumber, dob, diagnosis, allergies, careIntensity || 1],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.status(201).json({ id, name, mrn, bedNumber, status: 'active' });
        }
    );
});

// Get all patients
router.get('/', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM Patients`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get patient by ID
router.get('/:id', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM Patients WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Patient not found' });
        res.json(row);
    });
});

// Update patient
router.put('/:id', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { name, bedNumber, dob, diagnosis, allergies, careIntensity } = req.body;
    
    db.run(
        `UPDATE Patients SET name = ?, bedNumber = ?, dob = ?, diagnosis = ?, allergies = ?, careIntensity = ? WHERE id = ?`,
        [name, bedNumber, dob, diagnosis, allergies, careIntensity, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Patient not found' });
            res.json({ message: 'Patient updated successfully' });
        }
    );
});

// Discharge patient (Doctor only)
router.post('/:id/discharge', authenticateToken, requireRole(['doctor']), (req, res) => {
    db.run(`UPDATE Patients SET status = 'discharged' WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Patient not found' });
        res.json({ message: 'Patient discharged successfully' });
    });
});

module.exports = router;
