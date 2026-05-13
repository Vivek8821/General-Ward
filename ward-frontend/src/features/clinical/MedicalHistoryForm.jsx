import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';

function JsonOrText({ value }) {
  let items = null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) items = parsed;
  } catch {}

  if (items) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '13px',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    );
  }
  return <p className="text-sm mt-1 whitespace-pre-wrap">{value}</p>;
}

export default function MedicalHistoryForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();

  const { data: history = {}, isLoading } = useQuery({
    queryKey: queryKeys.clinical.medicalHistory(patientId),
    queryFn: () => api.get(`/patients/${patientId}/medical-history`),
    enabled: !!patientId,
  });

  const [form, setForm] = useState(null);
  const editing = form !== null;

  const startEdit = () => setForm({
    comorbidities: history.comorbidities || '',
    surgicalHistory: history.surgicalHistory || '',
    familyHistory: history.familyHistory || '',
    socialHistory: history.socialHistory || '',
  });

  const mutation = useMutation({
    mutationFn: (body) => api.put(`/patients/${patientId}/medical-history`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.medicalHistory(patientId) });
      setForm(null);
      toast.success('Medical history saved.');
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  if (!editing) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-text-primary">Medical History</h3>
          {!readOnly && (
            <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>
          )}
        </div>
        {history.comorbidities && (
          <div><span className="text-xs text-text-muted uppercase tracking-wide">Comorbidities</span><JsonOrText value={history.comorbidities} /></div>
        )}
        {history.surgicalHistory && (
          <div><span className="text-xs text-text-muted uppercase tracking-wide">Surgical History</span><JsonOrText value={history.surgicalHistory} /></div>
        )}
        {history.familyHistory && (
          <div><span className="text-xs text-text-muted uppercase tracking-wide">Family History</span><JsonOrText value={history.familyHistory} /></div>
        )}
        {history.socialHistory && (
          <div><span className="text-xs text-text-muted uppercase tracking-wide">Social History</span><JsonOrText value={history.socialHistory} /></div>
        )}
        {!history.comorbidities && !history.surgicalHistory && !history.familyHistory && !history.socialHistory && (
          <p className="text-text-muted text-sm">No medical history recorded.</p>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
      <h3 className="font-semibold text-text-primary">Medical History</h3>
      {[
        ['comorbidities', 'Comorbidities (free text or JSON array)'],
        ['surgicalHistory', 'Surgical History'],
        ['familyHistory', 'Family History'],
        ['socialHistory', 'Social History (JSON or free text)'],
      ].map(([key, label]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
          <textarea className="input-field min-h-[80px]" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>Save</button>
        <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </form>
  );
}
