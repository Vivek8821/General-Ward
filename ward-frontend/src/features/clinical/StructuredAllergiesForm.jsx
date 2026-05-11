import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const CATEGORIES = ['drug', 'food', 'environmental', 'other'];
const SEVERITIES = ['mild', 'moderate', 'severe', 'high'];

const BLANK = { allergen: '', category: 'drug', reaction: '', severity: 'moderate', verificationMethod: '' };

export default function StructuredAllergiesForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState(null);

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: queryKeys.clinical.structuredAllergies(patientId),
    queryFn: () => api.get(`/patients/${patientId}/allergies`),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post(`/patients/${patientId}/allergies`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.structuredAllergies(patientId) });
      setAddForm(null);
      toast.success('Allergy added.');
    },
    onError: (e) => toast.error(e.message || 'Failed to add allergy'),
  });

  const deleteMutation = useMutation({
    mutationFn: (allergyId) => api.delete(`/patients/${patientId}/allergies/${allergyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.structuredAllergies(patientId) });
      toast.success('Allergy removed.');
    },
    onError: (e) => toast.error(e.message || 'Failed to remove allergy'),
  });

  const severityColor = { mild: 'text-yellow-600', moderate: 'text-orange-500', severe: 'text-red-500', high: 'text-red-700' };

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-text-primary">Structured Allergies</h3>
        {!readOnly && !addForm && (
          <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={() => setAddForm({ ...BLANK })}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {allergies.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left p-2 text-text-muted">Allergen</th>
              <th className="text-left p-2 text-text-muted">Category</th>
              <th className="text-left p-2 text-text-muted">Reaction</th>
              <th className="text-left p-2 text-text-muted">Severity</th>
              {!readOnly && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {allergies.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2 font-medium">{a.allergen}</td>
                <td className="p-2 capitalize">{a.category}</td>
                <td className="p-2">{a.reaction}</td>
                <td className={`p-2 font-semibold capitalize ${severityColor[a.severity] || ''}`}>{a.severity}</td>
                {!readOnly && (
                  <td className="p-2">
                    <button onClick={() => deleteMutation.mutate(a.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {allergies.length === 0 && !addForm && (
        <p className="text-text-muted text-sm">No structured allergies recorded.</p>
      )}

      {addForm && (
        <form className="space-y-3 border border-border rounded-lg p-3 bg-bg-secondary" onSubmit={(e) => { e.preventDefault(); addMutation.mutate(addForm); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Allergen *</label>
              <input className="input-field !text-sm" required value={addForm.allergen} onChange={e => setAddForm({ ...addForm, allergen: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <select className="input-field !text-sm" value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reaction *</label>
              <input className="input-field !text-sm" required value={addForm.reaction} onChange={e => setAddForm({ ...addForm, reaction: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Severity *</label>
              <select className="input-field !text-sm" value={addForm.severity} onChange={e => setAddForm({ ...addForm, severity: e.target.value })}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Verification Method</label>
              <input className="input-field !text-sm" placeholder="e.g. skin test, challenge" value={addForm.verificationMethod} onChange={e => setAddForm({ ...addForm, verificationMethod: e.target.value })} />
            </div>
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
