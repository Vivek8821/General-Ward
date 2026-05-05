import React from 'react';

export default function RegisterBarcodeModal({ showRegisterModal, setShowRegisterModal, registrationData, setRegistrationData, inventory, registerBarcodeMutation }) {
  if (!showRegisterModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-bg-primary w-full max-w-md rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-1">Register Barcode</h3>
          <p className="text-sm text-text-secondary mb-6">Link this code to a medication in your inventory.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Barcode String</label>
              <input type="text" readOnly className="input-field bg-bg-tertiary font-mono" value={registrationData.barcode} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Target Medication</label>
              <select 
                className="input-field"
                value={registrationData.targetId}
                onChange={(e) => setRegistrationData({...registrationData, targetId: e.target.value})}
              >
                <option value="">Select Drug...</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.composition})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Notes (Optional)</label>
              <input type="text" className="input-field" placeholder="e.g. Manufacturer package code" value={registrationData.notes} onChange={(e) => setRegistrationData({...registrationData, notes: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setShowRegisterModal(false)} className="btn btn-secondary flex-1">Cancel</button>
            <button onClick={() => registerBarcodeMutation.mutate(registrationData)} disabled={!registrationData.targetId || registerBarcodeMutation.isPending} className="btn btn-primary flex-1">
              {registerBarcodeMutation.isPending ? 'Registering...' : 'Register Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
