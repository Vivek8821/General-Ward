const express = require('express');
const router = express.Router({ mergeParams: true });
const dbAdapter = require('../dbAdapter');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    requireTenantPatient,
    requireTenantMedication,
    requireTenantMedicationAdministration,
} = require('../middleware/tenant');
const crypto = require('crypto');

const VALID_ADMIN_STATUSES = ['given', 'refused', 'missed'];

const validateMedicationPayload = (payload) => {
    const { name, dosage, route, frequency, scheduledTimes } = payload;
    if (!name || !dosage || !frequency) return false;

    if (scheduledTimes !== undefined && scheduledTimes !== null && String(scheduledTimes).trim() !== '') {
        if (typeof scheduledTimes !== 'string') return false;
        const parts = scheduledTimes
            .split(',')
            .map((p) => p.trim())
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

    if (status === 'refused' || status === 'missed') {
        if (typeof notes !== 'string' || notes.trim().length === 0) {
            return false;
        }
    }
    return true;
};

const isLockError = (err) => {
    if (!err) return false;
    const code = err.code;
    const msg = String(err.message || '').toLowerCase();
    return code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || msg.includes('locked') || msg.includes('busy');
};

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

router.get('/administrations', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), async (req, res) => {
    const { patientId } = req.params;
    const tenantId = req.user.tenantId || 'tenant-default';
    const { limit, cursor } = req.query;

    if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
    }

    let query = `
      SELECT ma.*, m.name as medName, m.dosage, m.route
      FROM MedicationAdministrations ma
      JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
      WHERE ma.patientId = ? AND ma.tenantId = ?
    `;
    const params = [tenantId, patientId, tenantId];

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

    try {
        const rows = await dbAdapter.all(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authenticateToken, requireRole(['doctor']), requireTenantPatient('patientId'), async (req, res) => {
    const { patientId } = req.params;
    let { name, dosage, route, frequency, scheduledTimes, prn, startDate } = req.body;
    const id = crypto.randomUUID();
    const tenantId = req.user.tenantId || 'tenant-default';

    if (!validateMedicationPayload({ name, dosage, route, frequency })) {
        return res.status(400).json({
            error: 'Missing or invalid medication fields (name, dosage, frequency are required)',
            code: 'VALIDATION_ERROR',
        });
    }

    if (!route) route = 'Oral / Default';
    if (!startDate) startDate = new Date().toISOString().split('T')[0];

    try {
        await dbAdapter.run(
            `INSERT INTO Medications (id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn, startDate, status, prescribedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
            [id, tenantId, patientId, name, dosage, route, frequency, scheduledTimes, prn ? 1 : 0, startDate, req.user.name]
        );
        res.status(201).json({ id, name, dosage, route });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantPatient('patientId'), async (req, res) => {
    const tenantId = req.user.tenantId || 'tenant-default';
    try {
        const rows = await dbAdapter.all(
            `SELECT * FROM Medications WHERE patientId = ? AND tenantId = ? ORDER BY startDate DESC`,
            [req.params.patientId, tenantId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put(
    '/administrations/:adminId',
    authenticateToken,
    requireRole(['doctor', 'nurse']),
    requireTenantMedicationAdministration('adminId', 'patientId'),
    async (req, res) => {
        const { status, notes } = req.body;
        const tenantId = req.user.tenantId || 'tenant-default';

        if (!validateAdministrationPayload({ status, notes })) {
            return res.status(400).json({
                error: 'Invalid administration status',
                code: 'VALIDATION_ERROR',
            });
        }

        const reasonCode = status === 'given' ? null : status;

        try {
            const row = await dbAdapter.get(
                `SELECT m.dosage AS medDosage
         FROM MedicationAdministrations ma
         JOIN Medications m ON ma.medicationId = m.id AND m.tenantId = ?
         WHERE ma.id = ? AND ma.patientId = ? AND ma.tenantId = ?`,
                [tenantId, req.params.adminId, req.params.patientId, tenantId]
            );

            const doseActuallyGiven = status === 'given' ? (row?.medDosage || null) : null;

            await dbAdapter.run(
                `UPDATE MedicationAdministrations
                 SET status = ?, notes = ?, doseActuallyGiven = ?, reasonCode = ?
                 WHERE id = ? AND patientId = ? AND tenantId = ?`,
                [status, notes, doseActuallyGiven, reasonCode, req.params.adminId, req.params.patientId, tenantId]
            );
            res.json({ message: 'Administration record updated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

router.delete(
    '/administrations/:adminId',
    authenticateToken,
    requireRole(['doctor']),
    requireTenantMedicationAdministration('adminId', 'patientId'),
    async (req, res) => {
        const tenantId = req.user.tenantId || 'tenant-default';
        try {
            await dbAdapter.run(
                `DELETE FROM MedicationAdministrations WHERE id = ? AND patientId = ? AND tenantId = ?`,
                [req.params.adminId, req.params.patientId, tenantId]
            );
            res.json({ message: 'Administration record deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

router.put(
    '/:medId',
    authenticateToken,
    requireRole(['doctor']),
    requireTenantMedication('medId', 'patientId'),
    async (req, res) => {
        const { status } = req.body;
        const tenantId = req.user.tenantId || 'tenant-default';
        try {
            await dbAdapter.run(
                `UPDATE Medications SET status = ? WHERE id = ? AND patientId = ? AND tenantId = ?`,
                [status, req.params.medId, req.params.patientId, tenantId]
            );
            res.json({ message: 'Medication status updated successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

router.post(
    '/:medId/administer',
    authenticateToken,
    requireRole(['doctor', 'nurse']),
    requireTenantMedication('medId', 'patientId'),
    async (req, res) => {
        const { status, notes, timestamp } = req.body;
        const { patientId, medId } = req.params;
        const id = crypto.randomUUID();
        const tenantId = req.user.tenantId || 'tenant-default';

        if (!validateAdministrationPayload({ status, notes })) {
            return res.status(400).json({
                error: 'Invalid administration status',
                code: 'VALIDATION_ERROR',
            });
        }

        const reasonCode = status === 'given' ? null : status;

        try {
            const medRow = await dbAdapter.get(
                `SELECT dosage FROM Medications WHERE id = ? AND patientId = ? AND tenantId = ?`,
                [medId, patientId, tenantId]
            );

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
            let lastErr;
            for (let retriesLeft = MAX_RETRIES; retriesLeft >= 0; retriesLeft--) {
                try {
                    await dbAdapter.run(query, params);
                    return res.status(201).json({ id, message: 'Dose recorded' });
                } catch (insertErr) {
                    lastErr = insertErr;
                    if (retriesLeft > 0 && isLockError(insertErr)) {
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    throw insertErr;
                }
            }
            throw lastErr;
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
