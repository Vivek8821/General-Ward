import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ClipboardList, Plus, Save, Syringe, Trash2 } from 'lucide-react';

export default function MedsTab({ patientId }) {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    status: 'active'
  });

  useEffect(() => {
    fetchMeds();
  }, [patientId]);

  const fetchMeds = async () => {
    try {
      const data = await api.get(`/patients/${patientId}/medications`);
      setMedications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.dosage) {
         alert("Medication Name and Dosage are required.");
         return;
      }
      
      await api.post(`/patients/${patientId}/medications`, formData);
      setShowForm(false);
      setFormData({ name: '', dosage: '', frequency: 'Once daily', status: 'active' });
      fetchMeds();
    } catch (err) {
      alert("Failed to prescribe medication: " + err.message);
    }
  };

  const updateMedStatus = async (medId, nextStatus) => {
      try {
          await api.put(`/patients/${patientId}/medications/${medId}`, { status: nextStatus });
          fetchMeds();
      } catch (err) {
          alert("Failed to update status: " + err.message);
      }
  };

  const isDoctor = user.role === 'doctor';

  return (
    <div className="animate-in fade-in pt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="text-info"/> Prescribed Medications</h3>
        
        {isDoctor && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-info !bg-info !text-white !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> Prescribe Meds
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary p-6 rounded-xl border-2 border-info mb-8 animate-in slide-in-from-top-4">
          <h4 className="font-bold mb-4 flex items-center gap-2"><Syringe className="w-5 h-5 text-info"/> New Prescription</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Medication Name</label>
              <input type="text" required className="input-field !py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Amoxicillin" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Dosage / Route</label>
              <input type="text" required className="input-field !py-2" value={formData.dosage} onChange={e => setFormData({...formData, dosage: e.target.value})} placeholder="500mg PO" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Frequency / Instructions</label>
              <input type="text" className="input-field !py-2" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} placeholder="TID for 7 days" />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary !py-2 !px-4">Cancel</button>
            <button type="submit" className="btn btn-info !bg-info !text-white !py-2 !px-4 hover:opacity-90"><Save className="w-4 h-4"/> Confirm Prescription</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center p-8 text-text-muted">Loading medications...</div>
      ) : medications.length === 0 ? (
        <div className="text-center p-8 bg-bg-tertiary rounded-xl border border-dashed border-border text-text-muted">
          No medications currently prescribed.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {medications.map((med) => (
            <div key={med.id} className={`p-5 rounded-xl border flex items-center justify-between gap-4 ${
                med.status === 'discontinued' ? 'bg-bg-secondary border-border opacity-60' : 'bg-bg-tertiary border-border'
            }`}>
              <div className="flex items-start gap-4 flex-1">
                 <div className={`p-3 rounded-full ${med.status === 'discontinued' ? 'bg-bg-secondary text-text-muted' : 'bg-info/10 text-info'}`}>
                    <Syringe className="w-6 h-6"/>
                 </div>
                 <div>
                    <h4 className={`font-bold text-lg ${med.status === 'discontinued' ? 'line-through text-text-muted' : ''}`}>{med.name}</h4>
                    <div className="flex flex-wrap gap-2 text-sm mt-1">
                        <span className="font-semibold text-text-secondary">{med.dosage}</span>
                        <span className="text-text-muted">&bull;</span>
                        <span className="text-text-secondary">{med.frequency}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-2">
                       Prescribed by <strong>{med.prescribedBy}</strong> on {new Date(med.timestamp).toLocaleDateString()}
                    </div>
                 </div>
              </div>
              
              <div className="flex flex-col items-end gap-3 w-full md:w-auto mt-4 md:mt-0">
                 {med.status === 'active' ? (
                     <span className="text-xs bg-success/20 text-success border border-success/30 px-3 py-1 rounded-full uppercase font-bold tracking-wider">
                         Active
                     </span>
                 ) : (
                     <span className="text-xs bg-bg-secondary text-text-muted border border-border px-3 py-1 rounded-full uppercase font-bold tracking-wider">
                         Discontinued
                     </span>
                 )}

                 {isDoctor && med.status === 'active' && (
                     <button onClick={() => updateMedStatus(med.id, 'discontinued')} className="text-xs text-danger hover:underline font-semibold flex items-center gap-1">
                        <Trash2 className="w-3 h-3"/> Stop Med
                     </button>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
