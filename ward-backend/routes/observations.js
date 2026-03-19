const express = require('express');
const router = express.Router();
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

router.post('/ingest', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const { patientId, measurementType, data, timestamp, units, source } = req.body || {};

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
          if (err) return res.status(500).json({ error: err.message });
          return res.status(201).json({ id, patientId, type: 'vital' });
        }
      );
    } else {
      db.run(
        `INSERT INTO DailyStats (id, tenantId, patientId, type, data, recordedBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, tenantId, patientId, 'vital', dataString, recordedBy],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          return res.status(201).json({ id, patientId, type: 'vital' });
        }
      );
    }
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;

