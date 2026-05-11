const DISCHARGE_MODES = ['home', 'ama', 'transferred', 'lama', 'expired'];

export default function DischargeModal({ isOpen, onClose, onSubmit, form, setForm, patientName }) {
  if (!isOpen) return null;

  const updateVitals = (key, val) => {
    setForm({ ...form, dischargeVitals: { ...form.dischargeVitals, [key]: val } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="discharge-dialog-title">
      <div className="bg-bg-primary w-full max-w-3xl rounded-2xl shadow-2xl border border-border my-8 flex flex-col max-h-[90vh]">
        <form onSubmit={onSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Core fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">Reason for Admission</label>
              <input type="text" className="input-field" placeholder="e.g. Acute appendicitis" value={form.reasonForAdmission} onChange={e => setForm({...form, reasonForAdmission: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Duration of Stay</label>
              <input type="text" className="input-field" placeholder="e.g. 5 days" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Discharge Mode</label>
              <select className="input-field" value={form.dischargeMode || ''} onChange={e => setForm({...form, dischargeMode: e.target.value})}>
                <option value="">— Select —</option>
                {DISCHARGE_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">Medication History during Admission</label>
              <textarea className="input-field min-h-[80px]" placeholder="Summary of administered meds..." value={form.medicationsDuringAdmission} onChange={e => setForm({...form, medicationsDuringAdmission: e.target.value})} required />
            </div>
          </div>

          {/* Extended clinical diagnosis fields */}
          <div className="bg-bg-tertiary p-5 rounded-xl border border-border space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-text-muted">Clinical Diagnosis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">Admission Diagnosis</label>
                <input type="text" className="input-field !text-sm" value={form.admissionDiagnosis || ''} onChange={e => setForm({...form, admissionDiagnosis: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">Discharge Diagnosis</label>
                <input type="text" className="input-field !text-sm" value={form.dischargeDiagnosis || ''} onChange={e => setForm({...form, dischargeDiagnosis: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-text-secondary">Condition at Discharge</label>
                <input type="text" className="input-field !text-sm" placeholder="e.g. Stable, Improved" value={form.conditionAtDischarge || ''} onChange={e => setForm({...form, conditionAtDischarge: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className="bg-bg-tertiary p-5 rounded-xl border border-border">
            <h4 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-4">Vitals at Time of Discharge</h4>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">Heart Rate</label>
                <input type="text" className="input-field !text-sm" placeholder="72 bpm" value={form.dischargeVitals.hr} onChange={e => updateVitals('hr', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">BP</label>
                <input type="text" className="input-field !text-sm" placeholder="120/80" value={form.dischargeVitals.bp} onChange={e => updateVitals('bp', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">SpO2</label>
                <input type="text" className="input-field !text-sm" placeholder="98%" value={form.dischargeVitals.o2} onChange={e => updateVitals('o2', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-text-secondary">Temp</label>
                <input type="text" className="input-field !text-sm" placeholder="98.6 °F" value={form.dischargeVitals.temp} onChange={e => updateVitals('temp', e.target.value)} required />
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold mb-1 text-text-secondary">Lipid Panel / Labs</label>
                <input type="text" className="input-field !text-sm" placeholder="e.g. LDL 90" value={form.dischargeVitals.lipids} onChange={e => updateVitals('lipids', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Prescription & follow-up */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Medications & Health Recommendations</label>
              <textarea className="input-field min-h-[100px]" placeholder="Post-discharge care, prescriptions, follow-up dates..." value={form.dischargeRecommendations} onChange={e => setForm({...form, dischargeRecommendations: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">
                Discharge Prescription <span className="text-text-muted font-normal text-xs">(JSON array or free text)</span>
              </label>
              <textarea
                className="input-field min-h-[80px] font-mono !text-xs"
                placeholder='[{"name":"Metformin","dose":"500mg","route":"oral","frequency":"BD","duration":"30 days"}]'
                value={form.dischargePrescription || ''}
                onChange={e => setForm({...form, dischargePrescription: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">
                Follow-Up Schedule <span className="text-text-muted font-normal text-xs">(JSON array or free text)</span>
              </label>
              <textarea
                className="input-field min-h-[60px] font-mono !text-xs"
                placeholder='[{"date":"2026-06-01","department":"Cardiology","notes":"Review ECG"}]'
                value={form.followUpSchedule || ''}
                onChange={e => setForm({...form, followUpSchedule: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Patient Discharge Instructions</label>
              <textarea className="input-field min-h-[80px]" placeholder="Instructions for patient on discharge…" value={form.dischargeInstructions || ''} onChange={e => setForm({...form, dischargeInstructions: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Dietary Restrictions</label>
              <textarea className="input-field min-h-[60px]" placeholder="e.g. Low sodium diet, avoid grapefruit…" value={form.dietaryRestrictions || ''} onChange={e => setForm({...form, dietaryRestrictions: e.target.value})} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary !py-3 !px-6">Cancel</button>
            <button type="submit" className="btn btn-primary !py-3 !px-6">Submit Discharge</button>
          </div>
        </form>
      </div>
    </div>
  );
}
