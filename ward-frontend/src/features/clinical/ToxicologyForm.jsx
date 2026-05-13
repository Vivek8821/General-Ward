import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';

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
    bac: tox?.bac || '',
    drugScreen: tox?.drugScreen || '',
    poisonScreen: tox?.poisonScreen || '',
    heavyMetals: tox?.heavyMetals || '',
  });

  const mutation = useMutation({
    mutationFn: (body) => {
      return api.put(`/patients/${patientId}/toxicology`, {
        screenDate: body.screenDate,
        bac: body.bac,
        drugScreen: body.drugScreen,
        poisonScreen: body.poisonScreen,
        heavyMetals: body.heavyMetals,
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
            {tox.bac && <div><span className="text-text-muted">BAC: </span><pre className="inline text-xs font-sans whitespace-pre-wrap">{tox.bac}</pre></div>}
            {tox.drugScreen && <div><span className="text-text-muted">Drug Screen: </span><pre className="inline text-xs font-sans whitespace-pre-wrap">{tox.drugScreen}</pre></div>}
            {tox.poisonScreen && <div><span className="text-text-muted">Poison Screen: </span><pre className="inline text-xs font-sans whitespace-pre-wrap">{tox.poisonScreen}</pre></div>}
            {tox.heavyMetals && <div><span className="text-text-muted">Heavy Metals: </span><pre className="inline text-xs font-sans whitespace-pre-wrap">{tox.heavyMetals}</pre></div>}
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
        ['bac', 'Blood Alcohol Content (BAC)', 'e.g. Negative, or 0.08%'],
        ['drugScreen', 'Drug Screen', 'e.g. Opioids: Negative, Cocaine: Positive'],
        ['poisonScreen', 'Poison Screen', 'e.g. Organophosphates: Not detected'],
        ['heavyMetals', 'Heavy Metals Panel', 'e.g. Lead: < 2 μg/dL'],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <label className="block text-sm font-medium mb-1">{label} <span className="text-text-muted text-xs">(optional)</span></label>
          <textarea
            className="input-field min-h-[80px]"
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
