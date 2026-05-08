/**
 * Deterministic critical-patient classification.
 *
 * A patient qualifies as "critical" (shown in the alert and Review Cases filter) when:
 *   1. A nurse formally escalated their case, OR
 *   2. Their NEWS2 score is ≥ 7 AND at least one core cardiovascular vital
 *      (HR, BP, or SpO2) was actually recorded — so the score isn't driven
 *      purely by unrelated parameters with no cardiovascular data present.
 *
 * NEWS2 thresholds (for reference):
 *   HR:  ≤40 or ≥131 → 3 pts  |  41-50 or 111-130 → 2 pts  |  91-110 → 1 pt
 *   SBP: ≤90 or ≥220 → 3 pts  |  91-100 → 2 pts             |  101-110 → 1 pt
 *   SpO2: ≤91 → 3 pts          |  92-93 → 2 pts              |  94-95 → 1 pt
 *   Score ≥7 = HIGH risk (clinical emergency response required)
 */
export function isPatientCritical(patient) {
  if (patient.status === 'escalated') return true;

  const ews = patient.ews;
  if (!ews) return false;

  // Require at least one core cardiovascular vital to be on record.
  // This guards against a score built only from temperature / consciousness
  // with no HR, BP, or SpO2 data available.
  const hasCoreVital =
    ews.heartRate != null ||
    ews.systolicBP != null ||
    ews.spo2 != null;

  if (!hasCoreVital) return false;

  return ews.score >= 7;
}

/**
 * "Warning" tier: NEWS2 score 5-6, or patient is escalated without hitting
 * the full critical threshold. Used for amber card borders.
 */
export function isPatientWarning(patient) {
  if (isPatientCritical(patient)) return false;
  const ews = patient.ews;
  if (!ews) return false;
  return ews.score >= 5 || patient.status === 'escalated';
}
