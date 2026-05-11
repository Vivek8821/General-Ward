const dbAdapter = require('../db-adapter');
const diseaseCategorizer = require('./DiseaseCategorizer');

class StatisticsService {
  _computeAge(dob, referenceDate) {
    if (!dob) return null;
    const birth = new Date(dob);
    const ref = referenceDate ? new Date(referenceDate) : new Date();
    if (isNaN(birth.getTime())) return null;
    let age = ref.getFullYear() - birth.getFullYear();
    const m = ref.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
    return age;
  }

  _resolvePeriod(period) {
    const now = new Date();
    const from = new Date(now);
    switch (period) {
      case 'week':   from.setDate(from.getDate() - 7); break;
      case 'month':  from.setMonth(from.getMonth() - 1); break;
      case 'quarter': from.setMonth(from.getMonth() - 3); break;
      case 'year':   from.setFullYear(from.getFullYear() - 1); break;
      default:       from.setMonth(from.getMonth() - 1);
    }
    return { from: from.toISOString(), to: now.toISOString() };
  }

  _applyFilters(patients, filters) {
    return patients.filter(p => {
      if (filters.residence && p.residence !== filters.residence) return false;
      if (filters.gender && p.gender !== filters.gender) return false;
      const age = this._computeAge(p.dob, p.admittedAt || p.archivedAt);
      if (filters.ageMin != null && (age == null || age < Number(filters.ageMin))) return false;
      if (filters.ageMax != null && (age == null || age > Number(filters.ageMax))) return false;
      if (filters.disease) {
        const cat = diseaseCategorizer.categorize(p.diagnosis);
        if (cat !== filters.disease) return false;
      }
      return true;
    });
  }

  _ageGroup(age) {
    if (age == null) return 'Unknown';
    if (age <= 12) return '0-12';
    if (age <= 18) return '13-18';
    if (age <= 35) return '19-35';
    if (age <= 50) return '36-50';
    if (age <= 65) return '51-65';
    return '66+';
  }

  async _fetchActivePatients(tenantId, { from, to }) {
    const sqlFrom = new Date(from).toISOString().replace('T', ' ').slice(0, 19);
    const sqlTo = new Date(to).toISOString().replace('T', ' ').slice(0, 19);
    return dbAdapter.all(
      `SELECT id, name, mrn, dob, gender, diagnosis, status, admittedAt, careIntensity, residence
       FROM Patients
       WHERE tenantId = ? AND admittedAt <= ? AND (status != 'discharged' OR admittedAt >= ?)
       ORDER BY admittedAt`,
      [tenantId, sqlTo, sqlFrom]
    );
  }

  async _fetchArchivedPatients(tenantId, { from, to }) {
    const sqlFrom = new Date(from).toISOString().replace('T', ' ').slice(0, 19);
    const sqlTo = new Date(to).toISOString().replace('T', ' ').slice(0, 19);
    const rows = await dbAdapter.all(
      `SELECT id, patientId, patientName AS name, mrn, archivedAt, snapshotJson
       FROM HospitalArchives
       WHERE tenantId = ? AND archivedAt >= ? AND archivedAt <= ?
       ORDER BY archivedAt`,
      [tenantId, sqlFrom, sqlTo]
    );
    return rows.map(r => {
      let snapshot = null;
      try { snapshot = JSON.parse(r.snapshotJson); } catch {}
      const p = snapshot?.patient || {};
      return {
        id: r.patientId,
        name: r.name,
        mrn: r.mrn,
        dob: p.dob || null,
        gender: p.gender || null,
        diagnosis: p.diagnosis || null,
        status: 'discharged',
        admittedAt: p.admittedAt || null,
        archivedAt: r.archivedAt,
        careIntensity: p.careIntensity || 1,
        residence: p.residence || null,
        snapshot
      };
    });
  }

  _chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async _fetchMeds(tenantId, patientIds, { from, to }) {
    if (!patientIds.length) return { administrations: [], prescriptions: [] };
    const sqlFrom = new Date(from).toISOString().replace('T', ' ').slice(0, 19);
    const sqlTo = new Date(to).toISOString().replace('T', ' ').slice(0, 19);
    const allAdministrations = [];
    const allPrescriptions = [];
    for (const batch of this._chunk(patientIds, 500)) {
      const placeholders = batch.map(() => '?').join(',');
      const [admins, rxs] = await Promise.all([
        dbAdapter.all(
          `SELECT m.name, m.dosage, ma.status, ma.timestamp, ma.patientId, m.id
           FROM Medications m
           JOIN MedicationAdministrations ma ON ma.medicationId = m.id
           WHERE m.tenantId = ? AND m.patientId IN (${placeholders})
             AND ma.timestamp >= ? AND ma.timestamp <= ?
           ORDER BY ma.timestamp`,
          [tenantId, ...batch, sqlFrom, sqlTo]
        ),
        dbAdapter.all(
          `SELECT m.name, m.dosage, m.status AS prescriptionStatus, m.startDate, m.patientId, m.id
           FROM Medications m
           WHERE m.tenantId = ? AND m.patientId IN (${placeholders})
           ORDER BY m.startDate`,
          [tenantId, ...batch]
        )
      ]);
      allAdministrations.push(...admins);
      allPrescriptions.push(...rxs);
    }
    return { administrations: allAdministrations, prescriptions: allPrescriptions };
  }

  async _fetchEscalations(tenantId, patientIds) {
    if (!patientIds.length) return [];
    const allRows = [];
    for (const batch of this._chunk(patientIds, 500)) {
      const placeholders = batch.map(() => '?').join(',');
      const rows = await dbAdapter.all(
        `SELECT patientId, reason, status, timestamp
         FROM Escalations
         WHERE tenantId = ? AND patientId IN (${placeholders})`,
        [tenantId, ...batch]
      );
      allRows.push(...rows);
    }
    return allRows;
  }

  async getDiseaseDistribution(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const all = this._applyFilters([...active, ...archived], filters);

    const byCategory = {};
    const byDiagnosis = {};
    for (const p of all) {
      if (!p.diagnosis) continue;
      const cat = diseaseCategorizer.categorize(p.diagnosis);
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const diag = p.diagnosis.trim();
      byDiagnosis[diag] = (byDiagnosis[diag] || 0) + 1;
    }

    const total = all.length || 1;
    const categories = Object.entries(byCategory)
      .map(([category, count]) => ({ category, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    const diagnoses = Object.entries(byDiagnosis)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { total, categories, topDiagnoses: diagnoses, period: range };
  }

  async getDemographicBreakdown(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const all = this._applyFilters([...active, ...archived], filters);

    const gender = {};
    const residence = {};
    const ageGroups = {};

    for (const p of all) {
      const age = this._computeAge(p.dob, p.admittedAt || p.archivedAt);
      const ag = this._ageGroup(age);
      const g = p.gender || 'Unknown';
      const r = p.residence || 'Unknown';

      gender[g] = (gender[g] || 0) + 1;
      residence[r] = (residence[r] || 0) + 1;
      if (!ageGroups[ag]) ageGroups[ag] = { male: 0, female: 0, other: 0, unknown: 0 };
      const gKey = g.toLowerCase();
      ageGroups[ag][gKey === 'male' ? 'male' : gKey === 'female' ? 'female' : 'other'] += 1;
    }

    return {
      gender: Object.entries(gender).map(([label, count]) => ({ label, count })),
      residence: Object.entries(residence).map(([label, count]) => ({ label, count })),
      ageGroups: Object.entries(ageGroups).map(([group, counts]) => ({ group, ...counts })),
      total: all.length,
      period: range
    };
  }

  async getMedicationStats(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const filtered = this._applyFilters([...active, ...archived], filters);
    const patientIds = filtered.map(p => p.id).filter(Boolean);
    if (!patientIds.length) return { medications: [], total: 0, period: range };

    const medsData = await this._fetchMeds(tenantId, patientIds, range);
    const { administrations = [], prescriptions = [] } = medsData;

    const byName = {};
    for (const m of administrations) {
      const name = m.name || 'Unknown';
      if (!byName[name]) byName[name] = { name, given: 0, refused: 0, missed: 0, total: 0 };
      byName[name][m.status] = (byName[name][m.status] || 0) + 1;
      byName[name].total += 1;
    }

    const medications = Object.values(byName)
      .sort((a, b) => b.total - a.total)
      .slice(0, 25);

    return { medications, totalPatients: patientIds.length, totalAdministrations: administrations.length, period: range };
  }

  async getAdmissionTrend(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const filtered = this._applyFilters([...active, ...archived], filters);

    const segmentBy = period === 'week' || period === 'month' ? 'day' : period === 'quarter' ? 'week' : 'month';
    const periodFrom = new Date(range.from);
    const periodTo = new Date(range.to);

    const buckets = {};
    for (const p of filtered) {
      const admitDate = (p.admittedAt || p.archivedAt || '').slice(0, segmentBy === 'day' ? 10 : 7);
      if (!admitDate) continue;

      const admitTime = new Date(p.admittedAt || p.archivedAt);
      const isInPeriod = !isNaN(admitTime) && admitTime >= periodFrom && admitTime <= periodTo;

      if (isInPeriod) {
        if (!buckets[admitDate]) buckets[admitDate] = { date: admitDate, admitted: 0, discharged: 0 };
        buckets[admitDate].admitted += 1;
      }

      if (p.status === 'discharged' && p.archivedAt) {
        const disDate = (p.archivedAt || '').slice(0, segmentBy === 'day' ? 10 : 7);
        if (disDate) {
          const disTime = new Date(p.archivedAt);
          const disInPeriod = !isNaN(disTime) && disTime >= periodFrom && disTime <= periodTo;
          if (disInPeriod) {
            if (!buckets[disDate]) buckets[disDate] = { date: disDate, admitted: 0, discharged: 0 };
            buckets[disDate].discharged += 1;
          }
        }
      }
    }

    const timeline = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

    const totalAdmissions = active.filter(a => {
      const t = new Date(a.admittedAt);
      return !isNaN(t) && t >= periodFrom && t <= periodTo;
    }).length + archived.filter(a => {
      const t = new Date(a.admittedAt || a.archivedAt);
      return !isNaN(t) && t >= periodFrom && t <= periodTo;
    }).length;

    return { timeline, totalAdmissions, totalDischarges: filtered.filter(p => p.status === 'discharged').length, period: range };
  }

  async getClinicalOutcomes(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const filtered = this._applyFilters([...active, ...archived], filters);
    const filteredArchived = this._applyFilters(archived, filters);
    const patientIds = filtered.map(p => p.id).filter(Boolean);

    let totalLOS = 0;
    let losCount = 0;
    for (const p of filteredArchived) {
      if (p.admittedAt && p.archivedAt) {
        const admit = new Date(p.admittedAt);
        const arch = new Date(p.archivedAt);
        if (!isNaN(admit.getTime()) && !isNaN(arch.getTime())) {
          totalLOS += (arch - admit) / (1000 * 60 * 60 * 24);
          losCount++;
        }
      }
    }
    const avgLOS = losCount > 0 ? Math.round(totalLOS / losCount * 10) / 10 : 0;

    let escalationCount = 0;
    if (patientIds.length) {
      const escalations = await this._fetchEscalations(tenantId, patientIds);
      escalationCount = escalations.length;
    }

    const totalPatients = filtered.length || 1;
    const dischargeRate = Math.round((filteredArchived.length / totalPatients) * 100);
    const escalationRate = Math.round((escalationCount / totalPatients) * 100);

    const criticalCount = filteredArchived.filter(p => (p.careIntensity || 1) >= 3 || p.diagnosis?.toLowerCase().includes('sepsis')).length;
    const criticalRate = Math.round((criticalCount / totalPatients) * 100);

    return {
      avgLengthOfStay: avgLOS,
      dischargeRate,
      escalationRate,
      criticalRate,
      totalPatients,
      totalDischarges: filteredArchived.length,
      totalEscalations: escalationCount,
      period: range
    };
  }

  async getSummary(tenantId, period, filters = {}) {
    const range = filters.from ? { from: filters.from, to: filters.to || new Date().toISOString() } : this._resolvePeriod(period);
    const [active, archived] = await Promise.all([
      this._fetchActivePatients(tenantId, range),
      this._fetchArchivedPatients(tenantId, range)
    ]);
    const filtered = this._applyFilters([...active, ...archived], filters);
    const filteredArchived = this._applyFilters(archived, filters);
    const patientIds = filtered.map(p => p.id).filter(Boolean);

    const totalPatients = filtered.length;
    const currentlyActive = active.filter(a => a.status !== 'discharged').length;

    const diseaseCats = {};
    for (const p of filtered) {
      if (!p.diagnosis) continue;
      const cat = diseaseCategorizer.categorize(p.diagnosis);
      diseaseCats[cat] = (diseaseCats[cat] || 0) + 1;
    }
    const topCategory = Object.entries(diseaseCats).sort((a, b) => b[1] - a[1])[0];

    let totalMeds = 0;
    if (patientIds.length) {
      const medsData = await this._fetchMeds(tenantId, patientIds, range);
      totalMeds = medsData.administrations.length;
    }

    let totalLOS = 0; let losCount = 0;
    for (const p of filteredArchived) {
      if (p.admittedAt && p.archivedAt) {
        const admit = new Date(p.admittedAt), arch = new Date(p.archivedAt);
        if (!isNaN(admit) && !isNaN(arch)) { totalLOS += (arch - admit) / 86400000; losCount++; }
      }
    }

    return {
      totalPatients,
      currentlyActive,
      totalDischarged: filteredArchived.length,
      topDisease: topCategory ? { category: topCategory[0], count: topCategory[1] } : null,
      totalMedicationAdministrations: totalMeds,
      avgLengthOfStay: losCount > 0 ? Math.round(totalLOS / losCount * 10) / 10 : 0,
      period: range
    };
  }
}

module.exports = new StatisticsService();
