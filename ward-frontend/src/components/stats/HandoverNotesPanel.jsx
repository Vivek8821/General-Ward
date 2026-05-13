import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Clock, Copy, Check, Send } from 'lucide-react';
import { fmtDateTime, fmtTime, fmtDayMonth } from '../../utils/dateFormat';

const MAX_CHARS = 500;
const SHIFT_OPTIONS = ['morning', 'afternoon', 'night'];
const RANGE_OPTIONS = [
  { id: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All time', ms: null },
];

const SHIFT_STYLES = {
  morning:   { badge: 'bg-amber-500/10 border-amber-400/40 text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500'   },
  afternoon: { badge: 'bg-sky-500/10 border-sky-400/40 text-sky-600 dark:text-sky-400',           dot: 'bg-sky-500'     },
  night:     { badge: 'bg-violet-500/10 border-violet-400/40 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
};

function ShiftBadge({ shift }) {
  const s = SHIFT_STYLES[shift] ?? SHIFT_STYLES.morning;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${s.badge}`}>
      {shift}
    </span>
  );
}

function ShiftPill({ shift, active, onClick }) {
  const activeMap = {
    morning:   'bg-amber-500 border-amber-500 text-white',
    afternoon: 'bg-sky-500 border-sky-500 text-white',
    night:     'bg-violet-600 border-violet-600 text-white',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border transition-colors ${
        active ? (activeMap[shift] ?? activeMap.morning) : 'bg-bg-secondary border-border text-text-muted hover:bg-bg-tertiary'
      }`}
    >
      {shift}
    </button>
  );
}

const formatTime = fmtTime;
const formatDate = fmtDayMonth;

export default function HandoverNotesPanel({ patientId, readOnly }) {
  const { user } = useAuth();
  const canCreate = ['doctor', 'nurse', 'admin'].includes(user?.role);

  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied]     = useState(false);

  const [createShift, setCreateShift] = useState('morning');
  const [noteText, setNoteText] = useState('');
  const [tags, setTags]         = useState('');

  const [shiftFilter, setShiftFilter] = useState('all');
  const [range, setRange]       = useState('24h');

  const rangeFromIso = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.id === range);
    if (!opt?.ms) return null;
    return new Date(Date.now() - opt.ms).toISOString();
  }, [range]);

  const buildEndpoint = (pid) => {
    const params = new URLSearchParams();
    if (shiftFilter !== 'all') params.set('shift', shiftFilter);
    if (rangeFromIso) params.set('from', rangeFromIso);
    params.set('limit', '50');
    const qs = params.toString();
    return qs ? `/patients/${pid}/notes?${qs}` : `/patients/${pid}/notes`;
  };

  useEffect(() => {
    if (!patientId) { setNotes([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    api.get(buildEndpoint(patientId), { signal: controller.signal })
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(err => {
        if (!controller.signal.aborted) {
          if (err?.status === 404) setNotes([]);
          else toast.error('Failed to load handover notes: ' + (err.message || 'unknown error'));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, shiftFilter, rangeFromIso]);

  const fetchNotes = async () => {
    if (!patientId) return;
    try {
      const data = await api.get(buildEndpoint(patientId));
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.status === 404) setNotes([]);
      else toast.error('Failed to load handover notes: ' + (err.message || 'unknown error'));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`/patients/${patientId}/notes`, {
        shift: createShift,
        note: noteText,
        tags: tags || '',
      });
      setNoteText('');
      setTags('');
      const label = createShift.charAt(0).toUpperCase() + createShift.slice(1);
      const ts = fmtTime(new Date());
      toast.success(`Note saved — ${label} shift, ${ts}`);
      await fetchNotes();
    } catch (err) {
      toast.error('Failed to save note: ' + (err.message || 'unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyHandover = async () => {
    const last3 = notes.slice(0, 3);
    if (!last3.length) return;
    const text = last3.map((n) => {
      const ts = n.timestamp
        ? fmtDateTime(n.timestamp)
        : '--';
      const shift = n.shift ? n.shift.charAt(0).toUpperCase() + n.shift.slice(1) : '';
      const header = `[${ts}]  ${shift} Shift  |  ${n.createdBy || 'Unknown'}`;
      return `${header}\n${n.note}${n.tags ? `\nTags: ${n.tags}` : ''}`;
    }).join('\n\n─────────────────────────\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Clipboard access denied');
    }
  };

  const charsLeft = MAX_CHARS - noteText.length;
  const charColor = charsLeft <= 50 ? 'text-red-500' : charsLeft <= 100 ? 'text-amber-500' : 'text-text-muted';

  return (
    <div className="animate-in fade-in pt-4 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-50">
            <Clock className="text-slate-600 dark:text-slate-400 shrink-0" size={18} aria-hidden />
            Handover Notes
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Shift-based notes to support clinical handover and accountability.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-text-muted uppercase tracking-widest">Shift</label>
            <select className="input-field !py-2 !text-sm !rounded-md" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
              <option value="all">All shifts</option>
              {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 text-text-muted uppercase tracking-widest">Range</label>
            <select className="input-field !py-2 !text-sm !rounded-md" value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Input form ─────────────────────────────────────────────── */}
      {canCreate && !readOnly && (
        <form onSubmit={handleCreate} className="bg-bg-tertiary rounded-xl border border-border p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-text-primary">New Note</span>
            <div className="flex gap-1.5">
              {SHIFT_OPTIONS.map((s) => (
                <ShiftPill key={s} shift={s} active={createShift === s} onClick={() => setCreateShift(s)} />
              ))}
            </div>
          </div>

          <div className="relative">
            <textarea
              className="input-field min-h-[110px] !rounded-lg w-full resize-none pb-8"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="e.g., Overnight observations, response to treatment, outstanding items for next shift…"
              required
            />
            <span className={`absolute bottom-3 right-3 text-xs font-mono font-semibold pointer-events-none select-none ${charColor}`}>
              {noteText.length} / {MAX_CHARS}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-text-muted uppercase tracking-widest">
              Tags <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              className="input-field !py-2 !rounded-md"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated — e.g., sepsis, falls, pain"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting || !noteText.trim()}
              className="btn btn-primary !py-2.5 !px-6 flex items-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Saving…' : 'Submit Note'}
            </button>
          </div>
        </form>
      )}

      {/* ── Notes timeline ─────────────────────────────────────────── */}
      {loading ? (
        <div className="p-10 text-center text-text-muted animate-pulse">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Clock className="w-10 h-10 opacity-20" />
          <p className="font-semibold">No handover notes found for this filter.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
            <button
              type="button"
              onClick={handleCopyHandover}
              className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy for Handover'}
            </button>
          </div>

          {/* Timeline */}
          <div className="space-y-0">
            {notes.map((n, idx) => {
              const dotColor = SHIFT_STYLES[n.shift]?.dot ?? 'bg-primary';
              const isLast = idx === notes.length - 1;
              return (
                <div key={n.id} className="flex gap-0 items-start">

                  {/* Timestamp column */}
                  <div className="w-[62px] shrink-0 text-right pr-3 pt-1">
                    <div className="text-[11px] font-mono font-bold text-text-primary leading-tight tabular-nums">
                      {formatTime(n.timestamp)}
                    </div>
                    <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                      {formatDate(n.timestamp)}
                    </div>
                  </div>

                  {/* Dot + vertical connector */}
                  <div className="flex flex-col items-center w-5 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10 ${dotColor}`} />
                    {!isLast && <div className="flex-1 w-px bg-border/70 mt-1 mb-0 min-h-[24px]" />}
                  </div>

                  {/* Note card */}
                  <div className={`flex-1 ml-3 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
                    <div className="bg-bg-secondary border border-border rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <ShiftBadge shift={n.shift} />
                        <span className="text-xs text-text-muted">
                          <span className="font-semibold text-text-secondary">{n.createdBy}</span>
                        </span>
                      </div>

                      <p className="text-sm text-text-primary/90 whitespace-pre-wrap leading-relaxed">
                        {n.note}
                      </p>

                      {n.tags && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {n.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-tertiary border border-border text-text-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
