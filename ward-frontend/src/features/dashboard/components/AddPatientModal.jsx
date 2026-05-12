import React from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

function isUnder18(dob) {
  if (!dob) return false;
  const age = (new Date() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25);
  return age < 18;
}

export default function AddPatientModal({
  isAddingPatient, 
  setIsAddingPatient, 
  handleSavePatient, 
  newPatient, 
  setNewPatient, 
  addingPatient 
}) {
  const { user } = useAuth();

  if (!isAddingPatient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="add-patient-title">
      <div className="bg-bg-primary w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="p-6 border-b border-border bg-bg-tertiary">
          <h2 id="add-patient-title" className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Plus className="w-6 h-6" aria-hidden /> Add New Patient
          </h2>
          <p className="text-text-muted text-sm mt-1">Register a new patient to the active ward roster.</p>
        </div>
        <form onSubmit={handleSavePatient} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-name" className="block text-sm font-bold mb-1 text-text-secondary">Full Name *</label>
              <input
                id="patient-name"
                type="text"
                className="input-field"
                placeholder="e.g. John Doe"
                value={newPatient.name}
                onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-bed" className="block text-sm font-bold mb-1 text-text-secondary">Bed Number *</label>
              <input
                id="patient-bed"
                type="text"
                className="input-field"
                placeholder="e.g. A-12"
                value={newPatient.bedNumber}
                onChange={e => setNewPatient({...newPatient, bedNumber: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-mrn" className="block text-sm font-bold mb-1 text-text-secondary">MRN (Medical Record Number) *</label>
              <input
                id="patient-mrn"
                type="text"
                className="input-field"
                placeholder="e.g. MRN12345"
                value={newPatient.mrn}
                onChange={e => setNewPatient({...newPatient, mrn: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-dob" className="block text-sm font-bold mb-1 text-text-secondary">Date of Birth *</label>
              <input
                id="patient-dob"
                type="date"
                className="input-field"
                value={newPatient.dob}
                onChange={e => setNewPatient({...newPatient, dob: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="patient-diagnosis" className="block text-sm font-bold mb-1 text-text-secondary">Primary Diagnosis *</label>
              <input
                id="patient-diagnosis"
                type="text"
                className="input-field"
                placeholder="e.g. Hypertension, Diabetes Type 2"
                value={newPatient.diagnosis}
                onChange={e => setNewPatient({...newPatient, diagnosis: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-allergies" className="block text-sm font-bold mb-1 text-text-secondary">Allergies (if any)</label>
              <input
                id="patient-allergies"
                type="text"
                className="input-field"
                placeholder="e.g. Penicillin, Peanuts"
                value={newPatient.allergies}
                onChange={e => setNewPatient({...newPatient, allergies: e.target.value})}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-care-intensity" className="block text-sm font-bold mb-1 text-text-secondary">Initial Care Intensity</label>
              <select
                id="patient-care-intensity"
                className="input-field"
                value={newPatient.careIntensity}
                onChange={e => setNewPatient({...newPatient, careIntensity: parseInt(e.target.value)})}
              >
                <option value={1}>Level 1 (Basic Care)</option>
                <option value={2}>Level 2 (Moderate Observation)</option>
                <option value={3}>Level 3 (High Dependency)</option>
                <option value={4}>Level 4 (Critical/ICU Step-down)</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="patient-admitted-at" className="block text-sm font-bold mb-1 text-text-secondary">Admission Timestamp</label>
              <input
                id="patient-admitted-at"
                type="datetime-local"
                className="input-field"
                value={newPatient.admittedAt || ''}
                onChange={e => setNewPatient({...newPatient, admittedAt: e.target.value})}
              />
              <p className="text-[10px] text-text-muted mt-1 italic">Defaults to current time if left blank.</p>
            </div>
            {/* DPDPA Notice Confirmation */}
            <div className="col-span-2 border-t border-border pt-4">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">DPDPA Notice Confirmation</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!newPatient.notice_given_at}
                  onChange={e => setNewPatient({
                    ...newPatient,
                    notice_given_at: e.target.checked ? new Date().toISOString() : null,
                    notice_given_by: e.target.checked ? (user?.name || '') : null,
                  })}
                />
                <span className="text-sm text-text-secondary leading-snug">
                  I confirm that the patient (or guardian, if minor) has been given the data collection notice as required under Section 5 of the DPDPA 2023, including the purpose of data collection and their right to access, correct, and have their data erased.
                </span>
              </label>
            </div>

            {/* Minor Patient — Guardian Details */}
            {isUnder18(newPatient.dob) && (
              <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Minor Patient — Guardian Details Required (DPDPA Section 9)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="guardian-name" className="block text-sm font-bold mb-1 text-text-secondary">Guardian Name *</label>
                    <input
                      id="guardian-name"
                      type="text"
                      className="input-field"
                      value={newPatient.guardian_name || ''}
                      onChange={e => setNewPatient({ ...newPatient, guardian_name: e.target.value })}
                      required={isUnder18(newPatient.dob)}
                    />
                  </div>
                  <div>
                    <label htmlFor="guardian-contact" className="block text-sm font-bold mb-1 text-text-secondary">Guardian Contact *</label>
                    <input
                      id="guardian-contact"
                      type="text"
                      className="input-field"
                      value={newPatient.guardian_contact || ''}
                      onChange={e => setNewPatient({ ...newPatient, guardian_contact: e.target.value })}
                      required={isUnder18(newPatient.dob)}
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!newPatient.guardian_notice_at}
                    onChange={e => setNewPatient({
                      ...newPatient,
                      guardian_notice_at: e.target.checked ? new Date().toISOString() : null,
                    })}
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Guardian has been given the DPDPA data collection notice.
                  </span>
                </label>
              </div>
            )}

            {/* Data Rights Nominee */}
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-1 text-text-secondary">
                Data Rights Nominee <span className="text-xs font-normal text-text-muted">(DPDPA Section 14 — optional)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nominee full name"
                  value={newPatient.data_nominee || ''}
                  onChange={e => setNewPatient({ ...newPatient, data_nominee: e.target.value })}
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Relationship (e.g. Spouse, Son)"
                  value={newPatient.data_nominee_relationship || ''}
                  onChange={e => setNewPatient({ ...newPatient, data_nominee_relationship: e.target.value })}
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1">Person authorised to exercise data rights on behalf of the patient in case of death or incapacity.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
            <button 
              type="button" 
              onClick={() => setIsAddingPatient(false)} 
              className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2"
              disabled={addingPatient}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary !py-2 min-w-[120px]"
              disabled={addingPatient}
            >
              {addingPatient ? 'Saving...' : 'Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
