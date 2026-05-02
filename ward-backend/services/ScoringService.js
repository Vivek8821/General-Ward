/**
 * ScoringService.js
 * 
 * Implements clinical scoring protocols for patient risk assessment.
 * Standard: NEWS2 (National Early Warning Score 2)
 */

class ScoringService {
  /**
   * Calculates the NEWS2 score based on patient vitals.
   * @param {Object} vitals - The patient's vital signs.
   * @param {number} vitals.respirationRate - Breaths per minute.
   * @param {number} vitals.spo2 - Oxygen saturation percentage.
   * @param {boolean} vitals.onOxygen - Whether the patient is on supplemental oxygen.
   * @param {number} vitals.systolicBP - Systolic blood pressure (mmHg).
   * @param {number} vitals.heartRate - Beats per minute.
   * @param {string} vitals.consciousness - AVPU scale (A, V, P, U) or 'alert', 'voice', 'pain', 'unresponsive'.
   * @param {number} vitals.temperature - Body temperature in Celsius.
   * @returns {Object} { score: number, riskLevel: string, status: string }
   */
  calculateNEWS2(vitals) {
    let score = 0;
    const warnings = [];

    // 1. Respiration Rate
    if (vitals.respirationRate !== undefined) {
      const rr = vitals.respirationRate;
      if (rr <= 8) score += 3;
      else if (rr >= 9 && rr <= 11) score += 1;
      else if (rr >= 12 && rr <= 20) score += 0;
      else if (rr >= 21 && rr <= 24) score += 2;
      else if (rr >= 25) score += 3;
    } else {
      warnings.push('Respiration rate missing');
    }

    // 2. SpO2 (Scale 1 - default)
    if (vitals.spo2 !== undefined) {
      const sp = vitals.spo2;
      if (sp <= 91) score += 3;
      else if (sp >= 92 && sp <= 93) score += 2;
      else if (sp >= 94 && sp <= 95) score += 1;
      else if (sp >= 96) score += 0;
    } else {
      warnings.push('SpO2 missing');
    }

    // 3. Air or Oxygen
    if (vitals.onOxygen !== undefined) {
      if (vitals.onOxygen === true) score += 2;
      else score += 0;
    } else {
      warnings.push('Oxygen status missing');
    }

    // 4. Systolic BP
    if (vitals.systolicBP !== undefined) {
      const sbp = vitals.systolicBP;
      if (sbp <= 90) score += 3;
      else if (sbp >= 91 && sbp <= 100) score += 2;
      else if (sbp >= 101 && sbp <= 110) score += 1;
      else if (sbp >= 111 && sbp <= 219) score += 0;
      else if (sbp >= 220) score += 3;
    } else {
      warnings.push('Systolic BP missing');
    }

    // 5. Heart Rate
    if (vitals.heartRate !== undefined) {
      const hr = vitals.heartRate;
      if (hr <= 40) score += 3;
      else if (hr >= 41 && hr <= 50) score += 1;
      else if (hr >= 51 && hr <= 90) score += 0;
      else if (hr >= 91 && hr <= 110) score += 1;
      else if (hr >= 111 && hr <= 130) score += 2;
      else if (hr >= 131) score += 3;
    } else {
      warnings.push('Heart rate missing');
    }

    // 6. Consciousness (AVPU)
    if (vitals.consciousness !== undefined) {
      const c = String(vitals.consciousness).toLowerCase();
      if (c === 'a' || c === 'alert') score += 0;
      else if (['v', 'p', 'u', 'voice', 'pain', 'unresponsive', 'confusion'].includes(c)) score += 3;
    } else {
      warnings.push('Consciousness status missing');
    }

    // 7. Temperature
    if (vitals.temperature !== undefined) {
      const temp = vitals.temperature;
      if (temp <= 35.0) score += 3;
      else if (temp >= 35.1 && temp <= 36.0) score += 1;
      else if (temp >= 36.1 && temp <= 38.0) score += 0;
      else if (temp >= 38.1 && temp <= 39.0) score += 1;
      else if (temp >= 39.1) score += 2;
    } else {
      warnings.push('Temperature missing');
    }

    let riskLevel = 'LOW';
    let status = 'healthy';

    if (score >= 7) {
      riskLevel = 'HIGH';
      status = 'critical';
    } else if (score >= 5) {
      riskLevel = 'MEDIUM';
      status = 'warning';
    } else if (score >= 1) {
      riskLevel = 'LOW';
      status = 'stable';
    }

    return {
      score,
      riskLevel,
      status,
      warnings,
      isComplete: warnings.length === 0
    };
  }

  /**
   * Compatibility wrapper for legacy vital data format.
   * @param {Object} data - Legacy vital data (bpSystolic, pulse, temp, etc.)
   * @param {string} timestamp - Observation timestamp
   */
  calculateFromVital(data, timestamp) {
    if (!data) return null;

    // Map legacy fields to NEWS2 fields
    const vitals = {
      respirationRate: data.respRate !== undefined ? Number(data.respRate) : undefined,
      spo2: data.spo2 !== undefined ? Number(data.spo2) : undefined,
      onOxygen: data.onOxygen || false,
      systolicBP: data.bpSystolic !== undefined ? Number(data.bpSystolic) : undefined,
      heartRate: data.pulse !== undefined ? Number(data.pulse) : undefined,
      consciousness: data.consciousness || 'alert',
      temperature: data.temp !== undefined ? Number(data.temp) : undefined
    };

    const news2 = this.calculateNEWS2(vitals);
    
    return {
      ...news2,
      risk: news2.status, // Legacy field mapping
      timestamp: timestamp || null
    };
  }
}

module.exports = new ScoringService();
