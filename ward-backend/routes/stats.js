const express = require('express');
const router = express.Router({ mergeParams: true }); 
const { db } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');
const scoringService = require('../services/ScoringService');

// Physiological and data-quality validation for different stat types.
// These ranges are deliberately conservative and can be tuned with clinical input.
const validateStats = (type, data) => {
    if (typeof data !== 'object' || data === null) return false;

    switch (type) {
        case 'vital': {
            const {
                bpSystolic,
                bpDiastolic,
                temp,
                pulse,
                respRate,
                spo2
            } = data;

            // All primary vital fields must be present
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

            // Reasonable general-ward physiological ranges
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
        }
        case 'diet': {
            const { mealType, consumedPercentage } = data;
            if (!mealType) return false;
            const consumed = Number(consumedPercentage);
            if (!Number.isFinite(consumed) || consumed < 0 || consumed > 100) return false;
            return true;
        }
        case 'sleep': {
            const { hoursSlept, quality } = data;
            const hours = Number(hoursSlept);
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) return false;
            if (!quality) return false;
            return true;
        }
        case 'symptom': {
            const { severity, description } = data;
            if (!description) return false;
            const sev = Number(severity);
            if (!Number.isFinite(sev) || sev < 0 || sev > 10) return false;
            return true;
        }
        default:
            return false;
    }
};

// Thresholds (in minutes) for considering stats "stale".
const STALE_THRESHOLDS_MINUTES = {
    vital: 240,   // 4 hours
    diet: 480,    // 8 hours
    sleep: 1440,  // 24 hours
    symptom: 720  // 12 hours
};

const computeStaleness = (row) => {
    const type = row.type;
    const thresholdMinutes = STALE_THRESHOLDS_MINUTES[type];
    if (!thresholdMinutes) {
        return { isStale: false, ageMinutes: null };
    }

    const recordedAt = new Date(row.timestamp);
    if (Number.isNaN(recordedAt.getTime())) {
        return { isStale: false, ageMinutes: null };
    }

    const now = new Date();
    const ageMs = now.getTime() - recordedAt.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);

    return {
        isStale: ageMinutes > thresholdMinutes,
        ageMinutes
    };
};

// POST /api/patients/:patientId/stats
router.post('/', authenticateToken, requireRole(['doctor', 'nurse']), (req, res) => {
    const { patientId } = req.params;
    const { type, data } = req.body;
    const id = crypto.randomUUID();
    
    if (!type) {
        return res.status(400).json({
            error: 'Stat type is required',
            code: 'VALIDATION_ERROR'
        });
    }

    // validate type and content
    if (!['vital', 'symptom', 'diet', 'sleep'].includes(type) || !validateStats(type, data)) {
        return res.status(400).json({
            error: 'Invalid stat type or malformed/physiologically invalid data',
            code: 'VALIDATION_ERROR'
        });
    }

    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;

    db.run(
        `INSERT INTO DailyStats (id, patientId, type, data, recordedBy) VALUES (?, ?, ?, ?, ?)`,
        [id, patientId, type, dataString, req.user.name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
                id,
                patientId,
                type,
                data,
                recordedBy: req.user.name
            });
        }
    );
});

// GET /api/patients/:patientId/stats
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), (req, res) => {
    const { patientId } = req.params;
    const { type, limit } = req.query; // optional filter by type
    
    let query = `SELECT * FROM DailyStats WHERE patientId = ?`;
    const params = [patientId];
    
    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }
    
    query += ` ORDER BY timestamp DESC`;

    const parsedLimit = limit !== undefined ? Number(limit) : 200;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        query += ` LIMIT ?`;
        params.push(parsedLimit);
    }
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const enriched = rows.map(row => {
            let parsedData = row.data;
            try {
                parsedData = JSON.parse(row.data);
            } catch (e) {
                // leave as-is if not valid JSON
            }

            const { isStale, ageMinutes } = computeStaleness(row);
            let ews = null;
            if (row.type === 'vital') {
                ews = scoringService.calculateFromVital(parsedData, row.timestamp);
            }

            return {
                ...row,
                data: parsedData,
                isStale,
                ageMinutes,
                earlyWarningScore: ews
            };
        });

        res.json(enriched);
    });
});

// GET /api/patients/:patientId/stats/ews/latest
// Returns the most recent vital entry with its computed early warning score.
router.get('/ews/latest', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), (req, res) => {
    const { patientId } = req.params;

    db.get(
        `SELECT * FROM DailyStats WHERE patientId = ? AND type = 'vital' ORDER BY timestamp DESC LIMIT 1`,
        [patientId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) {
                return res.status(404).json({ error: 'No vitals found for patient' });
            }

            let parsedData = row.data;
            try {
                parsedData = JSON.parse(row.data);
            } catch (e) {
                // leave as-is
            }

            const { isStale, ageMinutes } = computeStaleness(row);
            const ews = scoringService.calculateFromVital(parsedData, row.timestamp);

            if (!ews) {
                return res.status(400).json({
                    error: 'Unable to compute early warning score from stored vitals',
                    code: 'SCORING_ERROR'
                });
            }

            res.json({
                patientId,
                vital: {
                    ...row,
                    data: parsedData,
                    isStale,
                    ageMinutes
                },
                score: ews
            });
        }
    );
});

// GET /api/patients/:patientId/stats/trends
// Computes simple trend directions from the latest two vital sign entries.
router.get('/trends', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), (req, res) => {
    const { patientId } = req.params;

    db.all(
        `SELECT * FROM DailyStats
         WHERE patientId = ? AND type = 'vital'
         ORDER BY timestamp DESC
         LIMIT 2`,
        [patientId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!rows || rows.length < 2) {
                return res.status(200).json({
                    patientId,
                    trends: {}
                });
            }

            const [latestRow, previousRow] = rows;
            let latestData = latestRow.data;
            let previousData = previousRow.data;

            try {
                latestData = JSON.parse(latestRow.data);
            } catch (e) {}
            try {
                previousData = JSON.parse(previousRow.data);
            } catch (e) {}

            const mkTrend = (prevVal, latestVal) => {
                if (prevVal === undefined || latestVal === undefined) return null;
                const p = Number(prevVal);
                const l = Number(latestVal);
                if (!Number.isFinite(p) || !Number.isFinite(l)) return null;
                const delta = l - p;
                const direction = Math.abs(delta) < 1e-6 ? 'stable' : delta > 0 ? 'up' : 'down';
                return { previous: p, latest: l, delta, direction };
            };

            const trends = {
                pulse: mkTrend(previousData.pulse, latestData.pulse),
                temp: mkTrend(previousData.temp, latestData.temp),
                systolic: mkTrend(previousData.bpSystolic, latestData.bpSystolic),
                diastolic: mkTrend(previousData.bpDiastolic, latestData.bpDiastolic),
                spo2: mkTrend(previousData.spo2, latestData.spo2),
                respRate: mkTrend(previousData.respRate, latestData.respRate)
            };

            return res.json({
                patientId,
                fromTimestamp: previousRow.timestamp,
                toTimestamp: latestRow.timestamp,
                trends
            });
        }
    );
});

module.exports = router;
