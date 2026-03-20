const NO_ALLERGY_PHRASES = new Set<string>([
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
 * True if stored text should be shown as an allergy risk (red badge).
 */
export function allergiesHasRisk(allergies: unknown): boolean {
  const s = allergies == null ? '' : String(allergies).trim();
  if (!s) return false;
  return !NO_ALLERGY_PHRASES.has(s.toLowerCase());
}

/**
 * Label for muted "no risk" display.
 */
export function formatAllergiesMutedLabel(allergies: unknown): string {
  const s = allergies == null ? '' : String(allergies).trim();
  if (!s) return 'None documented';
  return s;
}

