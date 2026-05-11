import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const BLANK = { procedureDate: '', procedureName: '', performedBy: '', outcome: '' };

export default function ProceduresLog({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState(null);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: queryKeys.clinical.clinicalProcedures(patientId),
    queryFn: () => api.get(`/patients/${patientId}/procedures`),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post(`/patients/${patientId}/procedures`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.clinicalProcedures(patientId) });
      setAddForm(null);
      toast.success('Procedure logged.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/patients/${patientId}/procedures/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.clinicalProcedures(patientId) });
      toast.success('Procedure removed.');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-text-primary">Clinical Procedures</h3>
        {!readOnly && !addForm && (
          <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={() => setAddForm({ ...BLANK })}>
            <Plus className="w-3 h-3" /> Log Procedure
          </button>
        )}
      </div>

      {procedures.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-bg-tertiary">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Procedure</th>
              <th className="text-left p-2">Performed By</th>
              <th className="text-left p-2">Outcome</th>
              {!readOnly && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {procedures.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2">{p.procedureDate}</td>
                <td className="p-2 font-medium">{p.procedureName}</td>
                <td className="p-2">{p.performedBy}</td>
                <td className="p-2">{p.outcome || '—'}</td>
                {!readOnly && (
                  <td className="p-2">
                    <button onClick={() => deleteMutation.mutate(p.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {procedures.length === 0 && !addForm && <p className="text-text-muted text-sm">No procedures recorded.</p>}

      {addForm && (
        <form className="space-y-3 border border-border rounded-lg p-3 bg-bg-secondary" onSubmit={(e) => { e.preventDefault(); addMutation.mutate(addForm); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <input type="date" className="input-field !text-sm" required value={addForm.procedureDate} onChange={e => setAddForm({ ...addForm, procedureDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Procedure Name *</label>
              <input className="input-field !text-sm" required value={addForm.procedureName} onChange={e => setAddForm({ ...addForm, procedureName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Performed By</label>
              <input className="input-field !text-sm" value={addForm.performedBy} onChange={e => setAddForm({ ...addForm, performedBy: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Outcome</label>
              <input className="input-field !text-sm" value={addForm.outcome} onChange={e => setAddForm({ ...addForm, outcome: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={addMutation.isPending}>Log</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddForm(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
