const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// GET /api/patients/:patientId/medications/administrations
router.get('/administrations', authenticateToken, (req, res) => {
    console.log(`[ADMIN] Fetching history. Params:`, req.params);
    const { patientId } = req.params;
    
    if (!patientId) {
        console.error('[ADMIN ERROR] No patientId in params');
        return res.status(400).json({ error: 'Patient ID is required' });
    }

    db.all(
        `SELECT ma.*, m.name as medName, m.dosage, m.route
         FROM MedicationAdministrations ma
         JOIN Medications m ON ma.medicationId = m.id
         WHERE ma.patientId = ?
         ORDER BY ma.timestamp DESC`,
        [patientId],
        (err, rows) => {
            if (err) {
                console.error('[ADMIN ERROR]', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[ADMIN] Found ${rows.length} records for ${patientId}`);
            res.json(rows);
        }
    );
});

// POST /api/patients/:patientId/medications (Doctor only)
router.post('/', authenticateToken, requireRole(['doctor']), (req, res) => {
    const { patientId } = req.params;
    let { name, dosage, route, frequency, scheduledTimes, prn, startDate } = req.body;
    const id = crypto.randomUUID();
    
    if (!route) route = 'Oral / Default';
    if (!startDate) startDate = new Date().toISOString().split('T')[0];
    
    db.run(
        `INSERT INTO Medications (id, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, status, prescribedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [id, patientId, name, dosage, route, frequency, scheduledTimes, prn ? 1 : 0, startDate, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, name, dosage, route });
        }
    );
});

// GET /api/patients/:patientId/medications
router.get('/', authenticateToken, (req, res) => {
    console.log(`[MEDS] Fetching meds for patient: ${req.params.patientId}`);
    db.all(`SELECT * FROM Medications WHERE patientId = ? ORDER BY startDate DESC`, [req.params.patientId], (err, rows) => {
        if (err) {
            console.error('[MEDS ERROR]', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[MEDS] Found ${rows.length} records`);
        res.json(rows);
    });
});

// PUT /api/patients/:patientId/medications/administrations/:adminId (Doctor or Nurse)
router.put('/administrations/:adminId', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { status, notes } = req.body;
    db.run(
        `UPDATE MedicationAdministrations SET status = ?, notes = ? WHERE id = ? AND patientId = ?`,
        [status, notes, req.params.adminId, req.params.patientId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Administration record updated' });
        }
    );
});

// DELETE /api/patients/:patientId/medications/administrations/:adminId (Doctor only)
router.delete('/administrations/:adminId', authenticateToken, requireRole(['doctor']), (req, res) => {
    db.run(
        `DELETE FROM MedicationAdministrations WHERE id = ? AND patientId = ?`,
        [req.params.adminId, req.params.patientId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Administration record deleted' });
        }
    );
});

// PUT /api/patients/:patientId/medications/:medId (Doctor only)
router.put('/:medId', authenticateToken, requireRole(['doctor']), (req, res) => {
    const { status } = req.body;
    db.run(
        `UPDATE Medications SET status = ? WHERE id = ? AND patientId = ?`,
        [status, req.params.medId, req.params.patientId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Medication status updated successfully' });
        }
    );
});

// POST /api/patients/:patientId/medications/:medId/administer (Nurse or Doctor)
router.post('/:medId/administer', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { status, notes, timestamp } = req.body;
    const { patientId, medId } = req.params;
    const id = crypto.randomUUID();

    const query = timestamp 
        ? `INSERT INTO MedicationAdministrations (id, medicationId, patientId, status, notes, administeredBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`
        : `INSERT INTO MedicationAdministrations (id, medicationId, patientId, status, notes, administeredBy) VALUES (?, ?, ?, ?, ?, ?)`;
    
    const params = timestamp
        ? [id, medId, patientId, status, notes, req.user.name, timestamp]
        : [id, medId, patientId, status, notes, req.user.name];

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id, message: "Dose recorded" });
    });
});

module.exports = router;
