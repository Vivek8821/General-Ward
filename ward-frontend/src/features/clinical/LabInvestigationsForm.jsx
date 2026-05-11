import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const BLANK = { investigationDate: '', dayLabel: '', resultsText: '' };

export default function LabInvestigationsForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { data: labs = [], isLoading } = useQuery({
    queryKey: queryKeys.clinical.labInvestigations(patientId),
    queryFn: () => api.get(`/patients/${patientId}/labs`),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (body) => {
      let results = body.resultsText;
      try { results = JSON.parse(body.resultsText); } catch {}
      return api.post(`/patients/${patientId}/labs`, {
        investigationDate: body.investigationDate,
        dayLabel: body.dayLabel || undefined,
        results,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.labInvestigations(patientId) });
      setAddForm(null);
      toast.success('Lab investigation added.');
    },
    onError: (e) => toast.error(e.message || 'Failed to add lab'),
  });

  const deleteMutation = useMutation({
    mutationFn: (labId) => api.delete(`/patients/${patientId}/labs/${labId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.labInvestigations(patientId) });
      toast.success('Lab investigation removed.');
    },
    onError: (e) => toast.error(e.message || 'Failed to remove'),
  });

  const renderResults = (raw) => {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return <pre className="text-xs whitespace-pre-wrap">{raw}</pre>; }
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return (
        <table className="w-full text-xs mt-2 border-collapse">
          <thead><tr className="bg-bg-tertiary"><th className="text-left p-1">Parameter</th><th className="text-left p-1">Value</th><th className="text-left p-1">Unit</th><th className="text-left p-1">Reference</th><th className="text-left p-1">Status</th></tr></thead>
          <tbody>
            {Object.entries(parsed).map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <td className="p-1 font-medium">{k}</td>
                <td className="p-1">{typeof v === 'object' ? v.value ?? '—' : String(v)}</td>
                <td className="p-1">{typeof v === 'object' ? v.unit || '' : ''}</td>
                <td className="p-1">{typeof v === 'object' ? v.referenceRange || '' : ''}</td>
                <td className="p-1">{typeof v === 'object' ? v.status || '' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>;
  };

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-text-primary">Laboratory Investigations</h3>
        {!readOnly && !addForm && (
          <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={() => setAddForm({ ...BLANK })}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {labs.map((lab) => (
        <div key={lab.id} className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex justify-between items-center px-3 py-2 bg-bg-secondary text-sm"
            onClick={() => setExpanded(p => ({ ...p, [lab.id]: !p[lab.id] }))}
          >
            <span className="font-medium">{lab.dayLabel || lab.investigationDate} — {lab.investigationDate}</span>
            <span className="flex items-center gap-2">
              {!readOnly && (
                <Trash2
                  className="w-3 h-3 text-red-500 hover:text-red-700"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(lab.id); }}
                />
              )}
              {expanded[lab.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
          {expanded[lab.id] && (
            <div className="p-3">{renderResults(lab.results)}</div>
          )}
        </div>
      ))}

      {labs.length === 0 && !addForm && <p className="text-text-muted text-sm">No lab investigations recorded.</p>}

      {addForm && (
        <form className="space-y-3 border border-border rounded-lg p-3 bg-bg-secondary" onSubmit={(e) => { e.preventDefault(); addMutation.mutate(addForm); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Investigation Date *</label>
              <input type="date" className="input-field !text-sm" required value={addForm.investigationDate} onChange={e => setAddForm({ ...addForm, investigationDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Day Label (optional)</label>
              <input className="input-field !text-sm" placeholder="e.g. Day 1, Day 4 (Mid-stay)" value={addForm.dayLabel} onChange={e => setAddForm({ ...addForm, dayLabel: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Results (JSON or free text) *</label>
            <textarea
              className="input-field min-h-[120px] font-mono !text-xs"
              required
              placeholder={'{"Hemoglobin": {"value": 12.5, "unit": "g/dL", "referenceRange": "12-17", "status": "normal"}}'}
              value={addForm.resultsText}
              onChange={e => setAddForm({ ...addForm, resultsText: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={addMutation.isPending}>Add</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddForm(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
