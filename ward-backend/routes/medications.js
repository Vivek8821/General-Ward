const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    requireTenantPatient,
    requireTenantMedication,
    requireTenantMedicationAdministration
} = require('../middleware/tenant');
const crypto = require('crypto');

const VALID_ADMIN_STATUSES = ['given', 'refused', 'missed'];

const validateMedicationPayload = (payload) => {
    const { name, dosage, route, frequency, scheduledTimes } = payload;
    if (!name || !dosage || !frequency) return false;
    // route is optional in API but we will default it if missing.

    // If scheduledTimes is provided, validate a simple "HH:MM, HH:MM, ..." format.
    if (scheduledTimes !== undefined && scheduledTimes !== null && String(scheduledTimes).trim() !== '') {
        if (typeof scheduledTimes !== 'string') return false;
        const parts = scheduledTimes
            .split(',')
            .map(p => p.trim())
            .filter(Boolean);

        if (parts.length === 0) return false;
        for (const t of parts) {
            if (!/^\d{2}:\d{2}$/.test(t)) return false;
            const [hh, mm] = t.split(':').map(Number);
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
        }
    }

    return true;
};

const validateAdministrationPayload = (payload) => {
    const { status, notes } = payload;
    if (!status || !VALID_ADMIN_STATUSES.includes(status)) {
        return false;
    }

    // For omissions/refusals, require a human-entered reason.
    if ((status === 'refused' || status === 'missed')) {
        if (typeof notes !== 'string' || notes.trim().length === 0) {
            return false;
        }
    }
    return true;
};

// GET /api/patients/:patientId/medications/administrations
router.get('/administrations', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), (req, res) => {
    console.log(`[ADMIN] Fetching history. Params:`, req.params);
    const { patientId } = req.params;
    const tenantId = req.user.tenantId || 'tenant-default';
    const { limit, cursor } = req.query;
    
    if (!patientId) {
        console.error('[ADMIN ERROR] No patientId in params');
        return res.status(400).json({ error: 'Patient ID is required' });
    }

    let query = `
      SELECT ma.*, m.name as medName, m.dosage, m.route
      FROM MedicationAdministrations ma
      JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
      WHERE ma.patientId = ? AND ma.tenantId = ?
    `;
    const params = [tenantId, patientId, tenantId];

    // Cursor pagination (descending timestamp):
    // cursor format: "<timestampISO>|<id>"
    if (cursor && typeof cursor === 'string') {
        const parts = cursor.split('|');
        if (parts.length === 2 && parts[0] && parts[1]) {
            const cursorTimestamp = parts[0];
            const cursorId = parts[1];
            query += ` AND (ma.timestamp < ? OR (ma.timestamp = ? AND ma.id < ?))`;
            params.push(cursorTimestamp, cursorTimestamp, cursorId);
        }
    }

    query += ` ORDER BY ma.timestamp DESC, ma.id DESC`;
    const parsedLimit = limit !== undefined ? Number(limit) : 200;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        query += ` LIMIT ?`;
        params.push(parsedLimit);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('[ADMIN ERROR]', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[ADMIN] Found ${rows.length} records for ${patientId}`);
        res.json(rows);
    });
});

// POST /api/patients/:patientId/medications (Doctor only)
router.post('/', authenticateToken, requireRole(['doctor']), requireTenantPatient('patientId'), (req, res) => {
    const { patientId } = req.params;
    let { name, dosage, route, frequency, scheduledTimes, prn, startDate } = req.body;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';

    if (!validateMedicationPayload({ name, dosage, route, frequency })) {
        return res.status(400).json({
            error: 'Missing or invalid medication fields (name, dosage, frequency are required)',
            code: 'VALIDATION_ERROR'
        });
    }
    
    if (!route) route = 'Oral / Default';
    if (!startDate) startDate = new Date().toISOString().split('T')[0];
    
    db.run(
        `INSERT INTO Medications (id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, status, prescribedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn ? 1 : 0, startDate, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, name, dosage, route });
        }
    );
});

// GET /api/patients/:patientId/medications
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), (req, res) => {
    console.log(`[MEDS] Fetching meds for patient: ${req.params.patientId}`);
    const tenantId = req.user.tenantId || 'tenant-default';
    db.all(
        `SELECT * FROM Medications WHERE patientId = ? AND tenantId = ? ORDER BY startDate DESC`,
        [req.params.patientId, tenantId],
        (err, rows) => {
        if (err) {
            console.error('[MEDS ERROR]', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[MEDS] Found ${rows.length} records`);
        res.json(rows);
        }
    );
});

// PUT /api/patients/:patientId/medications/administrations/:adminId (Doctor or Nurse)
router.put(
    '/administrations/:adminId',
    authenticateToken,
    requireRole(['doctor', 'nurse']),
    requireTenantMedicationAdministration('adminId', 'patientId'),
    (req, res) => {
    const { status, notes } = req.body;
    const tenantId = req.user.tenantId || 'tenant-default';

    if (!validateAdministrationPayload({ status, notes })) {
        return res.status(400).json({
            error: 'Invalid administration status',
            code: 'VALIDATION_ERROR'
        });
    }

    const reasonCode = status === 'given' ? null : status;

    db.get(
        `SELECT m.dosage AS medDosage
         FROM MedicationAdministrations ma
         JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
         WHERE ma.id = ? AND ma.patientId = ? AND ma.tenantId = ?`,
        [tenantId, req.params.adminId, req.params.patientId, tenantId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            const doseActuallyGiven = status === 'given' ? (row?.medDosage || null) : null;

            db.run(
                `UPDATE MedicationAdministrations
                 SET status = ?, notes = ?, doseActuallyGiven = ?, reasonCode = ?
                 WHERE id = ? AND patientId = ? AND tenantId = ?`,
                [status, notes, doseActuallyGiven, reasonCode, req.params.adminId, req.params.patientId, tenantId],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    res.json({ message: 'Administration record updated' });
                }
            );
        }
    );
});

// DELETE /api/patients/:patientId/medications/administrations/:adminId (Doctor only)
router.delete(
    '/administrations/:adminId',
    authenticateToken,
    requireRole(['doctor']),
    requireTenantMedicationAdministration('adminId', 'patientId'),
    (req, res) => {
    const tenantId = req.user.tenantId || 'tenant-default';
    db.run(
        `DELETE FROM MedicationAdministrations WHERE id = ? AND patientId = ? AND tenantId = ?`,
        [req.params.adminId, req.params.patientId, tenantId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Administration record deleted' });
        }
    );
});

// PUT /api/patients/:patientId/medications/:medId (Doctor only)
router.put(
    '/:medId',
    authenticateToken,
    requireRole(['doctor']),
    requireTenantMedication('medId', 'patientId'),
    (req, res) => {
    const { status } = req.body;
    const tenantId = req.user.tenantId || 'tenant-default';
    db.run(
        `UPDATE Medications SET status = ? WHERE id = ? AND patientId = ? AND tenantId = ?`,
        [status, req.params.medId, req.params.patientId, tenantId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Medication status updated successfully' });
        }
    );
});

// POST /api/patients/:patientId/medications/:medId/administer (Nurse or Doctor)
router.post(
    '/:medId/administer',
    authenticateToken,
    requireRole(['doctor', 'nurse']),
    requireTenantMedication('medId', 'patientId'),
    (req, res) => {
    const { status, notes, timestamp } = req.body;
    const { patientId, medId } = req.params;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';

    if (!validateAdministrationPayload({ status, notes })) {
        return res.status(400).json({
            error: 'Invalid administration status',
            code: 'VALIDATION_ERROR'
        });
    }

    const reasonCode = status === 'given' ? null : status;

    // Fetch medication dosage so we can persist what was actually given (or scheduled).
    db.get(
        `SELECT dosage FROM Medications WHERE id = ? AND patientId = ? AND tenantId = ?`,
        [medId, patientId, tenantId],
        (err, medRow) => {
            if (err) return res.status(500).json({ error: err.message });

            const doseActuallyGiven = status === 'given' ? (medRow?.dosage || null) : null;

            const query = timestamp
                ? `INSERT INTO MedicationAdministrations (id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                : `INSERT INTO MedicationAdministrations (id, tenantId, medicationId, patientId, status, notes, doseActuallyGiven, reasonCode, administeredBy)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = timestamp
                ? [id, tenantId, medId, patientId, status, notes, doseActuallyGiven, reasonCode, req.user.name, timestamp]
                : [id, tenantId, medId, patientId, status, notes, doseActuallyGiven, reasonCode, req.user.name];

            const MAX_RETRIES = 3;
            const RETRY_DELAY_MS = 50;
            const isLockError = (err) => {
                if (!err) return false;
                const code = err.code;
                const msg = String(err.message || '').toLowerCase();
                return code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || msg.includes('locked') || msg.includes('busy');
            };

            const attemptInsert = (retriesLeft) => {
                db.run(query, params, function(insertErr) {
                    if (insertErr && retriesLeft > 0 && isLockError(insertErr)) {
                        return setTimeout(() => attemptInsert(retriesLeft - 1), RETRY_DELAY_MS);
                    }
                    if (insertErr) return res.status(500).json({ error: insertErr.message });
                    res.status(201).json({ id, message: "Dose recorded" });
                });
            };

            attemptInsert(MAX_RETRIES);
        }
    );
});

module.exports = router;
