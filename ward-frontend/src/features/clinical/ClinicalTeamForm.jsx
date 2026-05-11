import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

const BLANK = { role: '', name: '', registrationNo: '', qualification: '', clinicalRemarks: '', remarksDate: '' };

export default function ClinicalTeamForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState(null);

  const { data: team = [], isLoading } = useQuery({
    queryKey: queryKeys.clinical.clinicalTeam(patientId),
    queryFn: () => api.get(`/patients/${patientId}/team`),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post(`/patients/${patientId}/team`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.clinicalTeam(patientId) });
      setAddForm(null);
      toast.success('Team member added.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/patients/${patientId}/team/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.clinicalTeam(patientId) });
      toast.success('Team member removed.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-text-primary">Clinical Team</h3>
        {!readOnly && !addForm && (
          <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={() => setAddForm({ ...BLANK })}>
            <Plus className="w-3 h-3" /> Add Member
          </button>
        )}
      </div>

      {team.map((m) => (
        <div key={m.id} className="border border-border rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-sm">{m.name}</div>
              <div className="text-xs text-text-muted">{m.role}{m.qualification ? ` — ${m.qualification}` : ''}</div>
              {m.registrationNo && <div className="text-xs text-text-muted">Reg: {m.registrationNo}</div>}
            </div>
            {!readOnly && (
              <button onClick={() => deleteMutation.mutate(m.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          {m.clinicalRemarks && (
            <div className="mt-2 text-xs text-text-secondary whitespace-pre-wrap border-l-2 border-blue-400 pl-2">
              {m.clinicalRemarks}
              {m.remarksDate && <span className="text-text-muted ml-1">— {m.remarksDate}</span>}
            </div>
          )}
        </div>
      ))}

      {team.length === 0 && !addForm && <p className="text-text-muted text-sm">No clinical team members added.</p>}

      {addForm && (
        <form className="space-y-3 border border-border rounded-lg p-3 bg-bg-secondary" onSubmit={(e) => { e.preventDefault(); addMutation.mutate(addForm); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Role *</label>
              <input className="input-field !text-sm" required placeholder="e.g. Treating Physician" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input className="input-field !text-sm" required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Registration No.</label>
              <input className="input-field !text-sm" placeholder="e.g. MCI-234567" value={addForm.registrationNo} onChange={e => setAddForm({ ...addForm, registrationNo: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Qualification</label>
              <input className="input-field !text-sm" placeholder="e.g. MD (Medicine), DNB" value={addForm.qualification} onChange={e => setAddForm({ ...addForm, qualification: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Clinical Remarks</label>
              <textarea className="input-field min-h-[60px]" value={addForm.clinicalRemarks} onChange={e => setAddForm({ ...addForm, clinicalRemarks: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Remarks Date</label>
              <input type="date" className="input-field !text-sm" value={addForm.remarksDate} onChange={e => setAddForm({ ...addForm, remarksDate: e.target.value })} />
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
