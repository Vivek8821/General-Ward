import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ClipboardList, Plus, Save, Syringe, Trash2, CheckCircle, Clock, History, Ban, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MedsTab({ patientId, readOnly }) {
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active', 'mar', 'history'
  const [medications, setMedications] = useState([]);
  const [administrations, setAdministrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [marInputs, setMarInputs] = useState({}); // { medId: { time: 'HH:mm', notes: '' } }
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    status: 'active'
  });

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [meds, admins] = await Promise.all([
        api.get(`/patients/${patientId}/medications`),
        api.get(`/patients/${patientId}/medications/administrations`)
      ]);
      setMedications(meds);
      setAdministrations(admins);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load medication data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.dosage) {
         toast.error("Medication Name and Dosage are required.");
         return;
      }
      
      await api.post(`/patients/${patientId}/medications`, formData);
      setShowForm(false);
      setFormData({ name: '', dosage: '', frequency: 'Once daily', status: 'active' });
      await fetchData();
      toast.success("Prescription confirmed!");
    } catch (err) {
      toast.error("Failed to prescribe: " + err.message);
    }
  };

  const administerMed = async (medId, status = 'given') => {
    try {
      const inputs = marInputs[medId] || {};
      const payload = { status, notes: inputs.notes };
      
      if (inputs.time) {
        const [hours, minutes] = inputs.time.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        payload.timestamp = date.toISOString();
      }

      await api.post(`/patients/${patientId}/medications/${medId}/administer`, payload);
      
      // Clear inputs for this med
      setMarInputs(prev => ({ ...prev, [medId]: { time: '', notes: '' } }));
      
      await fetchData();
      toast.success(status === 'given' ? "Medication marked as Given" : "Medication recorded as Refused");
    } catch (err) {
      toast.error("Failed to record: " + err.message);
    }
  };

  const updateAdminStatus = async (adminId, status, notes = '') => {
    try {
      await api.put(`/patients/${patientId}/medications/administrations/${adminId}`, { status, notes });
      setEditingAdmin(null);
      fetchData();
      toast.success("Administration record updated");
    } catch (err) {
      toast.error("Failed to update record: " + err.message);
    }
  };

  const deleteAdminRecord = async (adminId) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await api.delete(`/patients/${patientId}/medications/administrations/${adminId}`);
      fetchData();
      toast.success("Record deleted");
    } catch (err) {
      toast.error("Failed to delete: " + err.message);
    }
  };

  const updateMedStatus = async (medId, nextStatus) => {
    try {
      await api.put(`/patients/${patientId}/medications/${medId}`, { status: nextStatus });
      fetchData();
      toast.success(`Medication ${nextStatus}`);
    } catch (err) {
      toast.error("Failed to update: " + err.message);
    }
  };

  const isDoctor = user.role === 'doctor';
  const isNurse = user.role === 'nurse' || user.role === 'doctor';

  const activeMeds = medications.filter(m => m.status === 'active');
  const discMeds = medications.filter(m => m.status === 'discontinued');

  const getDoseCount = (frequency = '') => {
    const f = frequency.toLowerCase();
    if (f.includes('prn') || f.includes('as needed')) return 0; // 0 means unlimited/PRN
    if (f.includes('qds') || f.includes('four times')) return 4;
    if (f.includes('tds') || f.includes('tid') || f.includes('three times')) return 3;
    if (f.includes('bd') || f.includes('bid') || f.includes('twice')) return 2;
    if (f.includes('od') || f.includes('once') || f.includes('daily')) return 1;
    return 1;
  };

  const getTodayStats = (medId, frequency) => {
    const today = new Date().toDateString();
    const todayAdmins = administrations.filter(a => 
      a.medicationId === medId && 
      new Date(a.timestamp).toDateString() === today
    );
    
    const givenCount = todayAdmins.filter(a => a.status === 'given').length;
    const refusedCount = todayAdmins.filter(a => a.status === 'refused').length;
    const totalDosesDone = givenCount + refusedCount;
    const requiredDoses = getDoseCount(frequency);

    return {
      givenCount,
      refusedCount,
      totalDosesDone,
      requiredDoses,
      isCompleted: requiredDoses > 0 && totalDosesDone >= requiredDoses,
      isPRN: requiredDoses === 0
    };
  };

  return (
    <div className="animate-in fade-in pt-4">
      {/* Sub-navigation */}
      <div className="flex gap-4 mb-6 border-b border-border">
         <button onClick={() => setActiveSubTab('active')} className={`pb-2 px-1 text-sm font-bold transition-all ${activeSubTab === 'active' ? 'border-b-2 border-info text-info' : 'text-text-muted hover:text-text-primary'}`}>
            Active Prescriptions
         </button>
         <button onClick={() => setActiveSubTab('mar')} className={`pb-2 px-1 text-sm font-bold transition-all ${activeSubTab === 'mar' ? 'border-b-2 border-success text-success' : 'text-text-muted hover:text-text-primary'}`}>
            Today&apos;s Schedule (MAR)
         </button>
         <button onClick={() => setActiveSubTab('history')} className={`pb-2 px-1 text-sm font-bold transition-all ${activeSubTab === 'history' ? 'border-b-2 border-warning text-warning' : 'text-text-muted hover:text-text-primary'}`}>
            Admin History
         </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
            {activeSubTab === 'active' && <><ClipboardList className="text-info"/> Active Medications</>}
            {activeSubTab === 'mar' && <><Clock className="text-success"/> Current Schedule</>}
            {activeSubTab === 'history' && <><History className="text-warning"/> Administration Log</>}
        </h3>
        
        {isDoctor && activeSubTab === 'active' && !showForm && !readOnly && (
          <button onClick={() => setShowForm(true)} className="btn btn-info !bg-info !text-white !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> New Prescription
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
            <button type="submit" className="btn btn-info !bg-info !text-white !py-2 !px-4 hover:opacity-90"><Save className="w-4 h-4"/> Save Prescription</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center p-8 text-text-muted">Loading...</div>
      ) : (
        <div className="space-y-4">
          {activeSubTab === 'active' && (
            <>
              {activeMeds.length === 0 && <div className="text-center p-8 bg-bg-tertiary rounded-xl border border-dashed border-border text-text-muted">No active prescriptions.</div>}
              {activeMeds.map(med => <MedCard key={med.id} med={med} isDoctor={isDoctor} onStop={() => updateMedStatus(med.id, 'discontinued')} />)}
              
              {discMeds.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Discontinued</h4>
                  <div className="space-y-4 opacity-60">
                    {discMeds.map(med => <MedCard key={med.id} med={med} isDoctor={isDoctor} />)}
                  </div>
                </div>
              )}
            </>
          )}

          {activeSubTab === 'mar' && (
             <div className="space-y-4">
               <p className="text-xs text-text-muted italic mb-4">The schedule displays all currently active prescriptions that require administration today.</p>
               {activeMeds.length === 0 && <div className="text-center p-8 bg-bg-tertiary rounded-xl border border-dashed border-border text-text-muted">No active prescriptions to schedule.</div>}
               {activeMeds.map(med => {
                 const stats = getTodayStats(med.id, med.frequency);
                 const { isCompleted, isPRN, givenCount, requiredDoses } = stats;
                 const inputs = marInputs[med.id] || { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), notes: '' };

                 return (
                   <div key={med.id} className={`p-5 rounded-xl border flex flex-col gap-4 transition-all ${isCompleted ? 'bg-success/5 border-success/20 opacity-80' : 'bg-bg-tertiary border-border shadow-sm'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                           <div className={`p-3 rounded-full ${isCompleted ? 'bg-success/20 text-success' : 'bg-success/10 text-success animate-pulse'}`}>
                              {isCompleted ? <CheckCircle className="w-5 h-5"/> : <Clock className="w-5 h-5"/>}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <h4 className="font-bold text-lg">{med.name}</h4>
                                 {isCompleted && <span className="text-[10px] font-black bg-success text-white px-2 py-0.5 rounded uppercase">Completed Today</span>}
                                 {isPRN && <span className="text-[10px] font-black bg-info text-white px-2 py-0.5 rounded uppercase">PRN - As Needed</span>}
                              </div>
                              <p className="text-sm text-text-secondary">
                                {med.dosage} &bull; {med.frequency}
                                {!isPRN && (
                                  <span className={`ml-2 font-bold ${isCompleted ? 'text-success' : 'text-warning'}`}>
                                    ({givenCount} of {requiredDoses} doses given)
                                  </span>
                                )}
                              </p>
                           </div>
                        </div>

                        {isNurse && !isCompleted && !readOnly && (
                           <div className="flex gap-2">
                              <button onClick={() => administerMed(med.id, 'refused')} className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1 text-danger border-danger/20 hover:bg-danger/10">
                                 <Ban className="w-3 h-3"/> Refused
                              </button>
                              <button onClick={() => administerMed(med.id, 'given')} className="btn btn-success !bg-success !text-white !py-1.5 !px-3 text-xs flex items-center gap-1 shadow-sm hover:shadow-md">
                                 <CheckCircle className="w-3 h-3"/> Mark Given
                              </button>
                           </div>
                        )}
                        {isNurse && isPRN && !readOnly && (
                           <button onClick={() => administerMed(med.id, 'given')} className="btn btn-info !bg-info !text-white !py-1.5 !px-3 text-xs flex items-center gap-1 shadow-sm hover:shadow-md">
                              <Plus className="w-3 h-3"/> Log PRN Dose
                           </button>
                        )}
                      </div>

                      {isNurse && !isCompleted && !readOnly && (
                        <div className="flex flex-wrap gap-3 pt-3 border-t border-border/50 animate-in slide-in-from-top-2">
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted uppercase">Admin Time:</span>
                              <input 
                                type="time" 
                                className="input-field !py-1.5 !px-2 !text-xs w-28 bg-white"
                                value={inputs.time}
                                onChange={(e) => setMarInputs(prev => ({ ...prev, [med.id]: { ...inputs, time: e.target.value } }))}
                              />
                           </div>
                           <div className="flex-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted uppercase whitespace-nowrap">Notes/Relief:</span>
                              <input 
                                type="text"
                                className="input-field !py-1.5 !text-xs bg-white"
                                placeholder="e.g., Given with food..."
                                value={inputs.notes}
                                onChange={(e) => setMarInputs(prev => ({ ...prev, [med.id]: { ...inputs, notes: e.target.value } }))}
                              />
                           </div>
                        </div>
                      )}
                   </div>
                 );
               })}
             </div>
          )}

          {activeSubTab === 'history' && (
             <>
               {administrations.length === 0 && <div className="text-center p-8 bg-bg-tertiary rounded-xl border border-dashed border-border text-text-muted">No administration history found.</div>}
               {administrations.map(admin => (
                 <div key={admin.id} className="bg-bg-tertiary p-4 rounded-xl border border-border flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${admin.status === 'given' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                          {admin.status === 'given' ? <CheckCircle className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                       </div>
                       {editingAdmin === admin.id ? (
                          <div className="flex items-center gap-2">
                             <select 
                               className="input-field !py-1 !text-xs w-24"
                               value={admin.status}
                               onChange={(e) => updateAdminStatus(admin.id, e.target.value)}
                             >
                               <option value="given">Given</option>
                               <option value="refused">Refused</option>
                               <option value="missed">Missed</option>
                             </select>
                             <button onClick={() => setEditingAdmin(null)} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4"/></button>
                          </div>
                       ) : (
                          <div>
                             <p className="font-bold text-sm">{admin.medName} <span className="text-text-muted font-normal">({admin.dosage})</span></p>
                             <p className="text-xs text-text-muted">{new Date(admin.timestamp).toLocaleString()} &bull; By {admin.administeredBy}</p>
                          </div>
                       )}
                    </div>
                    <div className="flex items-center gap-3">
                       <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${admin.status === 'given' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                          {admin.status}
                       </div>
                       {isNurse && editingAdmin !== admin.id && !readOnly && (
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingAdmin(admin.id)} className="text-info hover:bg-info/10 p-1 rounded transition-colors"><Edit2 className="w-3 h-3"/></button>
                              {isDoctor && <button onClick={() => deleteAdminRecord(admin.id)} className="text-danger hover:bg-danger/10 p-1 rounded transition-colors"><Trash2 className="w-3 h-3"/></button>}
                           </div>
                        )}
                    </div>
                 </div>
               ))}
             </>
          )}
        </div>
      )}
    </div>
  );
}

function MedCard({ med, isDoctor, onStop }) {
  return (
    <div className={`p-5 rounded-xl border flex items-center justify-between gap-4 bg-bg-tertiary border-border shadow-sm`}>
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
               Prescribed by <strong>{med.prescribedBy}</strong> {med.timestamp && `on ${new Date(med.timestamp).toLocaleDateString()}`}
            </div>
         </div>
      </div>
      
      <div className="flex flex-col items-end gap-3">
         <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${med.status === 'active' ? 'bg-success/20 text-success border border-success/30' : 'bg-bg-secondary text-text-muted border border-border'}`}>
            {med.status}
         </span>

         {isDoctor && med.status === 'active' && onStop && !readOnly && (
             <button onClick={onStop} className="text-xs text-danger hover:underline font-semibold flex items-center gap-1">
                <Trash2 className="w-3 h-3"/> Discontinue
             </button>
         )}
      </div>
    </div>
  );
}
