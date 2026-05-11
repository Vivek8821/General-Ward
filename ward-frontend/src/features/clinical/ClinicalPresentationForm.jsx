import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'react-hot-toast';

const EXAM_FIELDS = [
  ['generalCondition', 'General Condition'],
  ['temperature', 'Temperature'],
  ['pulse', 'Pulse'],
  ['bp', 'Blood Pressure'],
  ['rr', 'Respiratory Rate'],
  ['spo2', 'SpO2'],
  ['icterus', 'Icterus'],
  ['lymphadenopathy', 'Lymphadenopathy'],
  ['skin', 'Skin'],
  ['abdomen', 'Abdomen'],
  ['respiratory', 'Respiratory'],
  ['cardiovascular', 'Cardiovascular'],
  ['neurological', 'Neurological'],
];

function parseExam(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
}

export default function ClinicalPresentationForm({ patientId, readOnly = false }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: cp = {}, isLoading } = useQuery({
    queryKey: queryKeys.clinical.clinicalPresentation(patientId),
    queryFn: () => api.get(`/patients/${patientId}/presentation`),
    enabled: !!patientId,
  });

  const startEdit = () => {
    const exam = parseExam(cp.physicalExamFindings);
    setForm({
      historyOfPresentingIllness: cp.historyOfPresentingIllness || '',
      examinedBy: cp.examinedBy || '',
      ...EXAM_FIELDS.reduce((acc, [k]) => ({ ...acc, [k]: exam[k] || '' }), {}),
    });
  };

  const mutation = useMutation({
    mutationFn: (body) => {
      const exam = EXAM_FIELDS.reduce((acc, [k]) => { if (body[k]) acc[k] = body[k]; return acc; }, {});
      return api.put(`/patients/${patientId}/presentation`, {
        historyOfPresentingIllness: body.historyOfPresentingIllness,
        examinedBy: body.examinedBy,
        physicalExamFindings: JSON.stringify(exam),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clinical.clinicalPresentation(patientId) });
      setForm(null);
      toast.success('Clinical presentation saved.');
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  if (isLoading) return <div className="text-text-muted text-sm p-4">Loading…</div>;

  if (!form) {
    const exam = parseExam(cp.physicalExamFindings);
    return (
      <div className="space-y-3 p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-text-primary">Clinical Presentation</h3>
          {!readOnly && <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>}
        </div>
        {cp.historyOfPresentingIllness && (
          <div>
            <span className="text-xs text-text-muted uppercase tracking-wide">History of Presenting Illness</span>
            <p className="text-sm mt-1 whitespace-pre-wrap">{cp.historyOfPresentingIllness}</p>
          </div>
        )}
        {Object.keys(exam).length > 0 && (
          <div>
            <span className="text-xs text-text-muted uppercase tracking-wide">Physical Examination</span>
            <dl className="mt-1 grid grid-cols-2 gap-1">
              {EXAM_FIELDS.filter(([k]) => exam[k]).map(([k, label]) => (
                <div key={k} className="text-xs"><dt className="text-text-muted inline">{label}: </dt><dd className="inline font-medium">{exam[k]}</dd></div>
              ))}
            </dl>
          </div>
        )}
        {cp.examinedBy && <p className="text-xs text-text-muted">Examined by: {cp.examinedBy}</p>}
        {!cp.historyOfPresentingIllness && !cp.physicalExamFindings && (
          <p className="text-text-muted text-sm">No clinical presentation recorded.</p>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
      <h3 className="font-semibold text-text-primary">Clinical Presentation</h3>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">History of Presenting Illness</label>
        <textarea className="input-field min-h-[100px]" value={form.historyOfPresentingIllness} onChange={e => setForm({ ...form, historyOfPresentingIllness: e.target.value })} />
      </div>
      <div>
        <span className="block text-sm font-medium text-text-secondary mb-2">Physical Examination Findings</span>
        <div className="grid grid-cols-2 gap-3">
          {EXAM_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs text-text-muted mb-1">{label}</label>
              <input className="input-field !text-sm" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Examined By</label>
        <input className="input-field" value={form.examinedBy} onChange={e => setForm({ ...form, examinedBy: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>Save</button>
        <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </form>
  );
}
