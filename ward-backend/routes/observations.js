const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const dbAdapter = require('../dbAdapter');
const { authenticateToken, requireRole } = require('../middleware/auth');

const validateVitalData = (data) => {
  if (typeof data !== 'object' || data === null) return false;

  const { bpSystolic, bpDiastolic, temp, pulse, respRate, spo2 } = data;

  if (
    bpSystolic === undefined ||
    bpDiastolic === undefined ||
    temp === undefined ||
    pulse === undefined
  ) {
    return false;
  }

  const sys = Number(bpSystolic);
  const dia = Number(bpDiastolic);
  const temperature = Number(temp);
  const heartRate = Number(pulse);
  const rr = respRate !== undefined ? Number(respRate) : null;
  const oxygen = spo2 !== undefined ? Number(spo2) : null;

  if (
    !Number.isFinite(sys) ||
    !Number.isFinite(dia) ||
    !Number.isFinite(temperature) ||
    !Number.isFinite(heartRate)
  ) {
    return false;
  }

  if (sys < 50 || sys > 260) return false;
  if (dia < 30 || dia > 150) return false;
  if (temperature < 30 || temperature > 43) return false;
  if (heartRate < 20 || heartRate > 250) return false;

  if (rr !== null) {
    if (!Number.isFinite(rr) || rr < 4 || rr > 60) return false;
  }

  if (oxygen !== null) {
    if (!Number.isFinite(oxygen) || oxygen < 50 || oxygen > 100) return false;
  }

  return true;
};

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many observation ingest requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function insertIdempotencyRow(idempotencyKey, tenantId, userId, patientId, endpoint) {
  if (dbAdapter.isPostgresEnabled()) {
    return dbAdapter.run(
      `INSERT INTO IdempotencyKeys (idempotencyKey, tenantId, userId, patientId, endpoint, status)
       VALUES (?, ?, ?, ?, ?, 'processing')
       ON CONFLICT (idempotencyKey, tenantId, userId, patientId, endpoint) DO NOTHING`,
      [idempotencyKey, tenantId, userId, patientId, endpoint]
    );
  }
  return dbAdapter.run(
    `INSERT OR IGNORE INTO IdempotencyKeys (idempotencyKey, tenantId, userId, patientId, endpoint, status)
     VALUES (?, ?, ?, ?, ?, 'processing')`,
    [idempotencyKey, tenantId, userId, patientId, endpoint]
  );
}

router.post('/ingest', ingestLimiter, authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const { patientId, measurementType, data, timestamp, units, source } = req.body || {};
    const idempotencyKey = req.get('Idempotency-Key');

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required', code: 'VALIDATION_ERROR' });
    }

    if (measurementType !== 'vital') {
      return res.status(400).json({ error: 'Unsupported measurementType', code: 'VALIDATION_ERROR' });
    }

    if (!validateVitalData(data)) {
      return res.status(400).json({ error: 'Invalid vital observation data', code: 'VALIDATION_ERROR' });
    }

    const id = crypto.randomUUID();
    const recordedBy = req.user.name;
    const tenantId = req.user.tenantId || 'tenant-default';
    const userId = req.user.id;
    const endpoint = 'observations/ingest';

    const patientRow = await dbAdapter.get(`SELECT id FROM Patients WHERE id = ? AND tenantId = ?`, [
      patientId,
      tenantId,
    ]);
    if (!patientRow) {
      return res.status(403).json({ error: 'Access denied by tenant scope.' });
    }

    if (idempotencyKey) {
      const existing = await dbAdapter.get(
        `SELECT status, responseStatus, responseJson
         FROM IdempotencyKeys
         WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
        [idempotencyKey, tenantId, userId, patientId, endpoint]
      );

      if (existing?.responseJson && existing?.responseStatus) {
        return res.status(existing.responseStatus).json(JSON.parse(existing.responseJson));
      }

      if (existing?.status === 'processing') {
        return res
          .status(409)
          .json({ error: 'Idempotency request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      }

      const ins = await insertIdempotencyRow(idempotencyKey, tenantId, userId, patientId, endpoint);

      if (!ins.changes) {
        const afterInsert = await dbAdapter.get(
          `SELECT status, responseStatus, responseJson
           FROM IdempotencyKeys
           WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
          [idempotencyKey, tenantId, userId, patientId, endpoint]
        );

        if (afterInsert?.responseJson && afterInsert?.responseStatus) {
          return res.status(afterInsert.responseStatus).json(JSON.parse(afterInsert.responseJson));
        }

        return res
          .status(409)
          .json({ error: 'Idempotency request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      }
    }

    const enrichedData = {
      ...data,
      ...(units !== undefined ? { units } : {}),
      ...(source !== undefined ? { source } : {}),
    };

    let timestampToStore = null;
    if (timestamp !== undefined && timestamp !== null && String(timestamp).trim() !== '') {
      const t = new Date(timestamp);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({ error: 'timestamp must be a valid date', code: 'VALIDATION_ERROR' });
      }
      timestampToStore = t.toISOString();
    }

    const dataString = JSON.stringify(enrichedData);
    const responsePayload = { id, patientId, type: 'vital' };

    const cleanupIdempotency = async () => {
      if (!idempotencyKey) return;
      await dbAdapter.run(
        `DELETE FROM IdempotencyKeys
         WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
        [idempotencyKey, tenantId, userId, patientId, endpoint]
      );
    };

    try {
      if (timestampToStore) {
        await dbAdapter.run(
          `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, tenantId, patientId, 'vital', dataString, recordedBy, timestampToStore]
        );
      } else {
        await dbAdapter.run(
          `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, tenantId, patientId, 'vital', dataString, recordedBy]
        );
      }

      if (idempotencyKey) {
        await dbAdapter.run(
          `UPDATE IdempotencyKeys
           SET status = 'completed', responseStatus = ?, responseJson = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
          [201, JSON.stringify(responsePayload), idempotencyKey, tenantId, userId, patientId, endpoint]
        );
      }

      return res.status(201).json(responsePayload);
    } catch (err) {
      await cleanupIdempotency();
      return res.status(500).json({ error: err.message });
    }
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;
