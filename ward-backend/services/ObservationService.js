const observationRepository = require('../repositories/ObservationRepository');
const patientRepository = require('../repositories/PatientRepository');
const scoringService = require('../services/ScoringService');
const clinicalAuditService = require('../services/ClinicalAuditService');
const crypto = require('crypto');

const STALE_THRESHOLDS_MINUTES = {
  vital: 240,   // 4 hours
  diet: 480,    // 8 hours
  sleep: 1440,  // 24 hours
  symptom: 720  // 12 hours
};

class ObservationService {
  computeStaleness(row) {
    const thresholdMinutes = STALE_THRESHOLDS_MINUTES[row.type];
    if (!thresholdMinutes) return { isStale: false, ageMinutes: null };

    const recordedAt = new Date(row.timestamp);
    if (Number.isNaN(recordedAt.getTime())) return { isStale: false, ageMinutes: null };

    const ageMinutes = Math.floor((Date.now() - recordedAt.getTime()) / 60000);
    return { isStale: ageMinutes > thresholdMinutes, ageMinutes };
  }

  async getObservations(patientId, tenantId, query) {
    const { type, limit, cursor } = query;
    let cursorTs, cursorId;
    if (cursor) [cursorTs, cursorId] = cursor.split('|');

    const rows = await observationRepository.findAllByPatientId(patientId, tenantId, {
      type,
      limit: limit ? Number(limit) : 200,
      cursorTs,
      cursorId
    });

    return rows.map(row => {
      let parsedData = row.data;
      try { parsedData = JSON.parse(row.data); } catch (e) {}

      const { isStale, ageMinutes } = this.computeStaleness(row);
      let ews = null;
      if (row.type === 'vital') {
        ews = scoringService.calculateFromVital(parsedData, row.timestamp);
      }

      return { ...row, data: parsedData, isStale, ageMinutes, earlyWarningScore: ews };
    });
  }

  async getLatestEws(patientId, tenantId) {
    const row = await observationRepository.findLatestByType(patientId, tenantId, 'vital');
    if (!row) return null;

    let parsedData = row.data;
    try { parsedData = JSON.parse(row.data); } catch (e) {}

    const { isStale, ageMinutes } = this.computeStaleness(row);
    const ews = scoringService.calculateFromVital(parsedData, row.timestamp);

    return {
      patientId,
      vital: { ...row, data: parsedData, isStale, ageMinutes },
      score: ews
    };
  }

  async getTrends(patientId, tenantId) {
    const rows = await observationRepository.findLatestTwoByType(patientId, tenantId, 'vital');
    if (!rows || rows.length < 2) return { patientId, trends: {} };

    const [latestRow, previousRow] = rows;
    let latestData, previousData;
    try { latestData = JSON.parse(latestRow.data); } catch (e) { latestData = latestRow.data; }
    try { previousData = JSON.parse(previousRow.data); } catch (e) { previousData = previousRow.data; }

    const mkTrend = (prevVal, latestVal) => {
      const p = Number(prevVal);
      const l = Number(latestVal);
      if (!Number.isFinite(p) || !Number.isFinite(l)) return null;
      const delta = l - p;
      const direction = Math.abs(delta) < 1e-6 ? 'stable' : delta > 0 ? 'up' : 'down';
      return { previous: p, latest: l, delta, direction };
    };

    return {
      patientId,
      fromTimestamp: previousRow.timestamp,
      toTimestamp: latestRow.timestamp,
      trends: {
        pulse: mkTrend(previousData.pulse, latestData.pulse),
        temp: mkTrend(previousData.temp, latestData.temp),
        systolic: mkTrend(previousData.bpSystolic, latestData.bpSystolic),
        diastolic: mkTrend(previousData.bpDiastolic, latestData.bpDiastolic),
        spo2: mkTrend(previousData.spo2, latestData.spo2),
        respRate: mkTrend(previousData.respRate, latestData.respRate)
      }
    };
  }

  async recordObservation(patientId, tenantId, user, payload) {
    const { type, data, timestamp } = payload;
    const id = crypto.randomUUID();

    await observationRepository.create({
      id,
      tenantId,
      patientId,
      type,
      data,
      recordedBy: user.name,
      timestamp
    });

    await clinicalAuditService.recordClinicalObservation({
      tenantId,
      user,
      patientId,
      observationId: id,
      type
    });

    return { id, patientId, type, data, recordedBy: user.name };
  }

  async ingestObservation(patientId, tenantId, user, payload, idempotencyKey) {
    const { data, timestamp, units, source } = payload;
    const id = crypto.randomUUID();
    const endpoint = 'observations/ingest';

    const enrichedData = {
      ...data,
      ...(units !== undefined ? { units } : {}),
      ...(source !== undefined ? { source } : {})
    };

    const responsePayload = { id, patientId, type: 'vital' };

    // SECURITY FIX: Verify patient belongs to tenant before proceeding
    const patientExists = await patientRepository.findById(patientId, tenantId);
    if (!patientExists) {
      return { status: 403, body: { error: 'Access denied by tenant scope or patient not found' } };
    }

    if (idempotencyKey) {
      const existing = await observationRepository.findIdempotencyKey(idempotencyKey, tenantId, user.id, patientId, endpoint);
      if (existing?.responseJson && existing?.responseStatus) {
        return { status: existing.responseStatus, body: JSON.parse(existing.responseJson) };
      }
      if (existing?.status === 'processing') {
        return { status: 409, body: { error: 'Idempotency request in progress' } };
      }
      await observationRepository.insertIdempotencyKey({ idempotencyKey, tenantId, userId: user.id, patientId, endpoint });
    }

    try {
      await observationRepository.create({
        id,
        tenantId,
        patientId,
        type: 'vital',
        data: enrichedData,
        recordedBy: user.name,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null
      });

      if (idempotencyKey) {
        await observationRepository.updateIdempotencyKey(idempotencyKey, tenantId, user.id, patientId, endpoint, {
          status: 'completed',
          responseStatus: 201,
          responseJson: JSON.stringify(responsePayload)
        });
      }

      await clinicalAuditService.recordClinicalObservation({
        tenantId,
        user,
        patientId,
        observationId: id,
        type: 'vital'
      });

      return { status: 201, body: responsePayload };
    } catch (err) {
      if (idempotencyKey) {
        await observationRepository.deleteIdempotencyKey(idempotencyKey, tenantId, user.id, patientId, endpoint);
      }
      throw err;
    }
  }
}

module.exports = new ObservationService();
