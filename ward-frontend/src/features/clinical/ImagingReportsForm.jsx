import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

const MODALITIES = ['ecg', 'xray', 'usg', 'ct', 'mri', 'pet', 'echo', 'spirometry', 'other'];
const MODALITY_LABELS = { ecg: 'ECG', xray: 'X-Ray', usg: 'USG', ct: 'CT Scan', mri: 'MRI', pet: 'PET Scan', echo: 'Echo', spirometry: 'Spirometry', other: 'Other' };
const BLANK = { modalityType: 'xray', investigationDate: '', equipment: '', findings: '', impression: '' };

export default function ImagingReportsForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: queryKeys.clinical.imagingReports(patientId),
    queryFn: () => api.get(`/patients/${patientId}/imaging`),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post(`/patients/${patientId}/imaging`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.imagingReports(patientId) });
      setAddForm(null);
      toast.success('Imaging report added.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/patients/${patientId}/imaging/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.imagingReports(patientId) });
      toast.success('Imaging report removed.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-text-primary">Diagnostic Imaging</h3>
        {!readOnly && !addForm && (
          <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={() => setAddForm({ ...BLANK })}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {reports.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-3 space-y-1">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">{MODALITY_LABELS[r.modalityType] || r.modalityType}</span>
              <span className="ml-2 text-xs text-text-muted">{r.investigationDate}</span>
              {r.equipment && <span className="ml-2 text-xs text-text-muted">— {r.equipment}</span>}
            </div>
            {!readOnly && (
              <button onClick={() => deleteMutation.mutate(r.id)} className="text-red-500 hover:text-red-700 ml-2">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-sm"><span className="text-text-muted">Findings: </span>{r.findings}</div>
          {r.impression && <div className="text-sm"><span className="text-text-muted">Impression: </span><span className="font-medium">{r.impression}</span></div>}
          {r.reportedBy && <div className="text-xs text-text-muted">Reported by: {r.reportedBy}</div>}
        </div>
      ))}

      {reports.length === 0 && !addForm && <p className="text-text-muted text-sm">No imaging reports recorded.</p>}

      {addForm && (
        <form className="space-y-3 border border-border rounded-lg p-3 bg-bg-secondary" onSubmit={(e) => { e.preventDefault(); addMutation.mutate(addForm); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Modality *</label>
              <select className="input-field !text-sm" value={addForm.modalityType} onChange={e => setAddForm({ ...addForm, modalityType: e.target.value })}>
                {MODALITIES.map(m => <option key={m} value={m}>{MODALITY_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <input type="date" className="input-field !text-sm" required value={addForm.investigationDate} onChange={e => setAddForm({ ...addForm, investigationDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Equipment / Machine</label>
              <input className="input-field !text-sm" placeholder="e.g. GE Discovery CT 750 HD" value={addForm.equipment} onChange={e => setAddForm({ ...addForm, equipment: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Findings *</label>
              <textarea className="input-field min-h-[80px]" required value={addForm.findings} onChange={e => setAddForm({ ...addForm, findings: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Impression</label>
              <textarea className="input-field min-h-[60px]" value={addForm.impression} onChange={e => setAddForm({ ...addForm, impression: e.target.value })} />
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
