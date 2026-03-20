const NO_ALLERGY_PHRASES = new Set([
  'none',
  'no allergies',
  'no known allergies',
  'n/a',
  'na',
  'nil',
  'nka',
  'nkda',
]);

/**
 * @param {unknown} allergies
 * @returns {boolean} true if stored text should be shown as an allergy risk (red badge)
 */
export function allergiesHasRisk(allergies) {
  const s = allergies == null ? '' : String(allergies).trim();
  if (!s) return false;
  return !NO_ALLERGY_PHRASES.has(s.toLowerCase());
}

/**
 * @param {unknown} allergies
 * @returns {string} label for muted "no risk" display
 */
export function formatAllergiesMutedLabel(allergies) {
  const s = allergies == null ? '' : String(allergies).trim();
  if (!s) return 'None documented';
  return s;
}
