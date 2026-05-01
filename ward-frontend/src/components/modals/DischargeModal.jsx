import { FileText } from 'lucide-react';

export default function DischargeModal({ isOpen, onClose, onSubmit, form, setForm, patientName }) {
  if (!isOpen) return null;

  const updateVitals = (key, val) => {
    setForm({
      ...form,
      dischargeVitals: { ...form.dischargeVitals, [key]: val }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="discharge-dialog-title">
      <div className="bg-bg-primary w-full max-w-3xl rounded-2xl shadow-2xl border border-border my-8">
        <div className="p-6 border-b border-border bg-bg-tertiary rounded-t-2xl">
          <h2 id="discharge-dialog-title" className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <FileText className="w-6 h-6 text-slate-600 dark:text-slate-400" aria-hidden /> Official Patient Discharge
          </h2>
          <p className="text-text-muted text-sm mt-1">Please completely fill out the clinical discharge summary for {patientName}.</p>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">Reason for Admission</label>
              <input type="text" className="input-field" placeholder="e.g. Acute appendicitis" value={form.reasonForAdmission} onChange={e => setForm({...form, reasonForAdmission: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Duration of Stay</label>
              <input type="text" className="input-field" placeholder="e.g. 5 days" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} required />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">Medication History during Admission</label>
              <textarea className="input-field min-h-[80px]" placeholder="Summary of administered meds..." value={form.medicationsDuringAdmission} onChange={e => setForm({...form, medicationsDuringAdmission: e.target.value})} required />
            </div>
          </div>

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

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-bold mb-1 text-text-secondary">Medications & Health Recommendations</label>
            <textarea className="input-field min-h-[100px]" placeholder="Post-discharge care, prescriptions, follow-up dates..." value={form.dischargeRecommendations} onChange={e => setForm({...form, dischargeRecommendations: e.target.value})} required />
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
