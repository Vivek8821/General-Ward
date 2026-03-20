import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Clock, Plus } from 'lucide-react';

const SHIFT_OPTIONS = ['morning', 'afternoon', 'night'];
const RANGE_OPTIONS = [
  { id: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All time', ms: null }
];

export default function HandoverNotesPanel({ patientId, readOnly }) {
  const { user } = useAuth();

  const canCreate = ['doctor', 'nurse', 'admin'].includes(user?.role);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createShift, setCreateShift] = useState('morning');
  const [noteText, setNoteText] = useState('');
  const [tags, setTags] = useState('');

  const [shiftFilter, setShiftFilter] = useState('all'); // all | morning | afternoon | night
  const [range, setRange] = useState('24h'); // 24h | 7d | all

  const rangeFromIso = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.id === range);
    if (!opt || !opt.ms) return null;
    return new Date(Date.now() - opt.ms).toISOString();
  }, [range]);

  const fetchNotes = async () => {
    try {
      if (!patientId) {
        setNotes([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      const params = new URLSearchParams();
      if (shiftFilter !== 'all') params.set('shift', shiftFilter);
      if (rangeFromIso) params.set('from', rangeFromIso);
      params.set('limit', '50');

      const qs = params.toString();
      const endpoint = qs
        ? `/patients/${patientId}/notes?${qs}`
        : `/patients/${patientId}/notes`;

      const data = await api.get(endpoint);
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      if (err?.status === 404) {
        setNotes([]);
      } else {
        toast.error('Failed to load handover notes: ' + (err.message || 'unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, shiftFilter, range]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/patients/${patientId}/notes`, {
        shift: createShift,
        note: noteText,
        tags: tags || ''
      });
      setNoteText('');
      setTags('');
      toast.success('Handover note saved.');
      await fetchNotes();
    } catch (err) {
      toast.error('Failed to save note: ' + (err.message || 'unknown error'));
    }
  };

  return (
    <div className="animate-in fade-in pt-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Clock className="text-slate-500 dark:text-slate-400 shrink-0" size={18} aria-hidden /> Handover Notes
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Shift-based notes to support clinical handover and accountability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-text-muted uppercase tracking-widest">
              Shift
            </label>
            <select
              className="input-field !py-2 !text-sm !rounded-md"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="all">All shifts</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-text-muted uppercase tracking-widest">
              Range
            </label>
            <select
              className="input-field !py-2 !text-sm !rounded-md"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canCreate && !readOnly && (
        <form onSubmit={handleCreate} className="bg-bg-tertiary p-5 rounded-md border border-border space-y-4">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="min-w-[160px]">
              <label className="block text-xs font-bold mb-1 text-text-secondary uppercase tracking-widest">
                Shift
              </label>
              <select
                className="input-field !py-2 !rounded-md"
                value={createShift}
                onChange={(e) => setCreateShift(e.target.value)}
              >
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold mb-1 text-text-secondary uppercase tracking-widest">
                Note
              </label>
              <textarea
                className="input-field min-h-[90px] !rounded-md"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g., Overnight observation, response to treatment, outstanding items..."
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-text-secondary uppercase tracking-widest">
              Tags (optional)
            </label>
            <input
              type="text"
              className="input-field !py-2 !rounded-md"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated (e.g., sepsis, falls)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="submit" className="btn btn-primary !py-2 !px-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Save Note
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-10 text-center text-text-muted">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Clock className="w-10 h-10 opacity-20" />
          <p className="font-semibold">No handover notes found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => (
            <div key={n.id} className="bg-bg-tertiary p-5 rounded-md border border-border">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {n.shift}
                    </span>
                    <span className="text-sm text-text-muted">
                      By <span className="font-semibold">{n.createdBy}</span>
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-2">
                    {n.timestamp ? new Date(n.timestamp).toLocaleString() : '--'}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-text-primary/90 whitespace-pre-wrap">
                {n.note}
              </div>
              {n.tags && (
                <div className="mt-3">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">
                    Tags
                  </div>
                  <div className="text-sm text-text-primary/90 whitespace-pre-wrap">
                    {n.tags}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
