import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';

export default function ToxicologyForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: tox, isLoading } = useQuery({
    queryKey: queryKeys.clinical.toxicology(patientId),
    queryFn: () => api.get(`/patients/${patientId}/toxicology`),
    enabled: !!patientId,
  });

  const startEdit = () => setForm({
    screenDate: tox?.screenDate || '',
    bac: tox?.bac ? (typeof tox.bac === 'string' ? tox.bac : JSON.stringify(tox.bac, null, 2)) : '',
    drugScreen: tox?.drugScreen ? (typeof tox.drugScreen === 'string' ? tox.drugScreen : JSON.stringify(tox.drugScreen, null, 2)) : '',
    poisonScreen: tox?.poisonScreen ? (typeof tox.poisonScreen === 'string' ? tox.poisonScreen : JSON.stringify(tox.poisonScreen, null, 2)) : '',
    heavyMetals: tox?.heavyMetals ? (typeof tox.heavyMetals === 'string' ? tox.heavyMetals : JSON.stringify(tox.heavyMetals, null, 2)) : '',
  });

  const mutation = useMutation({
    mutationFn: (body) => {
      const parse = (v) => { if (!v) return undefined; try { return JSON.parse(v); } catch { return v; } };
      return api.put(`/patients/${patientId}/toxicology`, {
        screenDate: body.screenDate,
        bac: parse(body.bac),
        drugScreen: parse(body.drugScreen),
        poisonScreen: parse(body.poisonScreen),
        heavyMetals: parse(body.heavyMetals),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.toxicology(patientId) });
      setForm(null);
      toast.success('Toxicology screen saved.');
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  if (!form) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-text-primary">Toxicology Screen</h3>
          {!readOnly && <button className="btn btn-secondary btn-sm" onClick={startEdit}>{tox ? 'Edit' : 'Add Screen'}</button>}
        </div>
        {tox ? (
          <div className="space-y-2 text-sm">
            <div><span className="text-text-muted">Date: </span>{tox.screenDate}</div>
            {tox.bac && <div><span className="text-text-muted">BAC: </span><pre className="inline text-xs">{typeof tox.bac === 'string' ? tox.bac : JSON.stringify(tox.bac)}</pre></div>}
            {tox.drugScreen && <div><span className="text-text-muted">Drug Screen recorded.</span></div>}
            {tox.poisonScreen && <div><span className="text-text-muted">Poison Screen recorded.</span></div>}
            {tox.heavyMetals && <div><span className="text-text-muted">Heavy Metals panel recorded.</span></div>}
          </div>
        ) : (
          <p className="text-text-muted text-sm">No toxicology screen recorded (optional).</p>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
      <h3 className="font-semibold text-text-primary">Toxicology Screen</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Screen Date *</label>
        <input type="date" className="input-field" required value={form.screenDate} onChange={e => setForm({ ...form, screenDate: e.target.value })} />
      </div>
      {[
        ['bac', 'Blood Alcohol Content (BAC)', '{"venousBlood":{"result":"<LOD","method":"GC-HS"},"interpretation":"Negative"}'],
        ['drugScreen', 'Drug Screen (JSON array)', '[{"substance":"Opioids","result":"Negative","method":"ELISA"}]'],
        ['poisonScreen', 'Poison Screen (JSON array)', '[{"substance":"Organophosphate","result":"Not detected","status":"Normal"}]'],
        ['heavyMetals', 'Heavy Metals Panel (JSON array)', '[{"element":"Lead","symbol":"Pb","result":"< 2","unit":"μg/dL","status":"Normal"}]'],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <label className="block text-sm font-medium mb-1">{label} <span className="text-text-muted text-xs">(optional)</span></label>
          <textarea
            className="input-field min-h-[80px] font-mono !text-xs"
            placeholder={placeholder}
            value={form[key]}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>Save</button>
        <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </form>
  );
}
