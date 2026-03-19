const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
// Tenant enforcement for observations is done inside the handler because `patientId` is in the request body.

// Validation shared with in-hospital vital validation.
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

// Enterprise rate limiting hardening for ingest writes.
// Keep thresholds high enough to not interfere with safe retries (idempotency).
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // allow bursts but throttle abusive clients
  message: { error: 'Too many observation ingest requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

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

    // Enforce tenant scoping for the referenced patient (patientId is in the request body).
    const patientInTenant = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM Patients WHERE id = ? AND tenantId = ?`,
        [patientId, tenantId],
        (err, row) => (err ? reject(err) : resolve(Boolean(row)))
      );
    });

    if (!patientInTenant) {
      return res.status(403).json({ error: 'Access denied by tenant scope.' });
    }

    // Idempotency handling: if Idempotency-Key is supplied, repeat requests return the same response.
    if (idempotencyKey) {
      const existing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT status, responseStatus, responseJson
           FROM IdempotencyKeys
           WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
          [idempotencyKey, tenantId, userId, patientId, endpoint],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (existing?.responseJson && existing?.responseStatus) {
        return res.status(existing.responseStatus).json(JSON.parse(existing.responseJson));
      }

      // If it's already being processed, fail fast to avoid duplicate inserts.
      if (existing?.status === 'processing') {
        return res.status(409).json({ error: 'Idempotency request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      }

      // Mark as processing so concurrent requests don't both write.
      // `INSERT OR IGNORE` lets the "losing" concurrent request detect that it shouldn't proceed.
      const inserted = await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO IdempotencyKeys (idempotencyKey, tenantId, userId, patientId, endpoint, status)
           VALUES (?, ?, ?, ?, ?, 'processing')`,
          [idempotencyKey, tenantId, userId, patientId, endpoint],
          function (err) {
            if (err) return reject(err);
            resolve(this.changes);
          }
        );
      });

      if (inserted === 0) {
        const afterInsert = await new Promise((resolve, reject) => {
          db.get(
            `SELECT status, responseStatus, responseJson
             FROM IdempotencyKeys
             WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
            [idempotencyKey, tenantId, userId, patientId, endpoint],
            (err, row) => (err ? reject(err) : resolve(row))
          );
        });

        if (afterInsert?.responseJson && afterInsert?.responseStatus) {
          return res.status(afterInsert.responseStatus).json(JSON.parse(afterInsert.responseJson));
        }

        return res.status(409).json({ error: 'Idempotency request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      }
    }

    const enrichedData = {
      ...data,
      ...(units !== undefined ? { units } : {}),
      ...(source !== undefined ? { source } : {})
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

    if (timestampToStore) {
      db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, 'vital', dataString, recordedBy, timestampToStore],
        function (err) {
          if (err) {
            if (idempotencyKey) {
              db.run(
                `DELETE FROM IdempotencyKeys
                 WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
                [idempotencyKey, tenantId, userId, patientId, endpoint]
              );
            }
            return res.status(500).json({ error: err.message });
          }

          const responsePayload = { id, patientId, type: 'vital' };
          if (idempotencyKey) {
            db.run(
              `UPDATE IdempotencyKeys
               SET status = 'completed', responseStatus = ?, responseJson = ?, updatedAt = CURRENT_TIMESTAMP
               WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
              [201, JSON.stringify(responsePayload), idempotencyKey, tenantId, userId, patientId, endpoint],
              function () {
                return res.status(201).json(responsePayload);
              }
            );
            return;
          }

          return res.status(201).json(responsePayload);
        }
      );
    } else {
      db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, 'vital', dataString, recordedBy],
        function (err) {
          if (err) {
            if (idempotencyKey) {
              db.run(
                `DELETE FROM IdempotencyKeys
                 WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
                [idempotencyKey, tenantId, userId, patientId, endpoint]
              );
            }
            return res.status(500).json({ error: err.message });
          }

          const responsePayload = { id, patientId, type: 'vital' };
          if (idempotencyKey) {
            db.run(
              `UPDATE IdempotencyKeys
               SET status = 'completed', responseStatus = ?, responseJson = ?, updatedAt = CURRENT_TIMESTAMP
               WHERE idempotencyKey = ? AND tenantId = ? AND userId = ? AND patientId = ? AND endpoint = ?`,
              [201, JSON.stringify(responsePayload), idempotencyKey, tenantId, userId, patientId, endpoint],
              function () {
                return res.status(201).json(responsePayload);
              }
            );
            return;
          }

          return res.status(201).json(responsePayload);
        }
      );
    }
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;

