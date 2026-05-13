const LOCALE = 'en-IN';

type DateInput = string | number | Date | null | undefined;

function toDate(ts: DateInput): Date | null {
  if (ts == null || ts === '') return null;
  const d = new Date(ts as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "02 May 2026" */
export function fmtDate(ts: DateInput): string {
  const d = toDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "02 May 2026, 13:30" — 24 h, clinical standard */
export function fmtDateTime(ts: DateInput): string {
  const d = toDate(ts);
  if (!d) return '—';
  const date = d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

/** "13:30" */
export function fmtTime(ts: DateInput): string {
  const d = toDate(ts);
  if (!d) return '—';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "2 May" — compact timeline sidebar labels */
export function fmtDayMonth(ts: DateInput): string {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

/** "2 May 13:30" — tight chart axis ticks */
export function fmtChartLabel(ts: DateInput): string {
  const d = toDate(ts);
  if (!d) return '';
  const date = d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}
