export default function EditPatientModal({ isOpen, onClose, onSubmit, form, setForm, userRole }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
      <div className="bg-bg-primary w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="p-6 border-b border-border bg-bg-tertiary">
          <h2 id="edit-patient-title" className="text-2xl font-bold">Edit Patient Info</h2>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Name</label>
              <input type="text" className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Bed Number</label>
              <input type="text" className="input-field" value={form.bedNumber} onChange={e => setForm({...form, bedNumber: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Date of Birth</label>
              <input type="date" className="input-field" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Care Intensity (1-4)</label>
              <select className="input-field" value={form.careIntensity} onChange={e => setForm({...form, careIntensity: parseInt(e.target.value)})}>
                <option value={1}>Level 1 (Basic)</option>
                <option value={2}>Level 2 (Moderate)</option>
                <option value={3}>Level 3 (High)</option>
                <option value={4}>Level 4 (Critical)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">Allergies</label>
              <input type="text" className="input-field" value={form.allergies || ''} onChange={e => setForm({...form, allergies: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-1 flex items-center justify-between">
                <span className="text-text-secondary">Diagnosis</span>
                {userRole === 'nurse' && <span className="text-xs text-warning border border-warning/50 px-2 py-0.5 rounded-md">Doctors Only</span>}
              </label>
              <textarea 
                className={`input-field min-h-[80px] ${userRole === 'nurse' ? 'bg-bg-tertiary opacity-70 cursor-not-allowed' : ''}`} 
                value={form.diagnosis} 
                onChange={e => setForm({...form, diagnosis: e.target.value})} 
                disabled={userRole === 'nurse'}
                required 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn btn-secondary !py-2">Cancel</button>
            <button type="submit" className="btn btn-primary !py-2">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
