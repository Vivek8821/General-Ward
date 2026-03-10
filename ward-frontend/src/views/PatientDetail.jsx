import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity, Apple, Moon, ClipboardList, AlertTriangle, FileText } from 'lucide-react';
import HistoryTab from '../components/stats/HistoryTab';
import VitalsTab from '../components/stats/VitalsTab';
import DietTab from '../components/stats/DietTab';
import SleepTab from '../components/stats/SleepTab';
import MedsTab from '../components/stats/MedsTab';
import DischargeSummaryTab from '../components/stats/DischargeSummaryTab';
import { Archive } from 'lucide-react';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [isEditing, setIsEditing] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [dischargeForm, setDischargeForm] = useState({
      reasonForAdmission: '',
      duration: '',
      medicationsDuringAdmission: '',
      dischargeVitals: { hr: '', bp: '', o2: '', temp: '', lipids: '' },
      dischargeRecommendations: ''
  });
  const [escalations, setEscalations] = useState([]);

  useEffect(() => {
    fetchPatient();
  }, [id]);

  const fetchPatient = async () => {
    try {
      const data = await api.get(`/patients/${id}`);
      setPatient(data);
      setEditForm(data);
      
      if (data.status === 'discharged') {
          setActiveTab('discharge');
      }
      
      if (data.status === 'escalated' && user.role === 'doctor') {
         fetchEscalations();
      }
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const fetchEscalations = async () => {
      try {
          const eData = await api.get('/escalations/all');
          // Filter escalations for this specific patient
          setEscalations(eData.filter(e => e.patientId === id));
      } catch (err) {
          console.error(err);
      }
  };

  if (!patient) return <div className="p-10 text-center">Loading patient data...</div>;

  const handleEscalate = async () => {
    const reason = prompt("Enter reason for escalation to Doctor:");
    if (!reason) return;
    try {
      await api.post(`/patients/${id}/escalations`, { reason });
      alert("Case escalated successfully. Doctors have been notified.");
      fetchPatient(); // Refresh status
    } catch (err) {
      alert("Failed to escalate: " + err.message);
    }
  };

  const handleReviewCase = async (escalationId) => {
      try {
          await api.post(`/escalations/${escalationId}/review`);
          alert("Case marked as reviewed.");
          fetchPatient(); // Refresh status
      } catch (err) {
          alert("Failed to review case: " + err.message);
      }
  };

  const handleSaveEdit = async (e) => {
      e.preventDefault();
      try {
          await api.put(`/patients/${id}`, editForm);
          setIsEditing(false);
          fetchPatient();
      } catch (err) {
          alert("Failed to update patient: " + err.message);
      }
  };

  const prepareDischarge = async () => {
      try {
          // Auto-fetch medication history for the discharge summary
          const meds = await api.get(`/patients/${id}/medications`);
          const formattedMeds = meds.length > 0 
              ? meds.map(m => `• ${m.name} — ${m.dosage} (${m.frequency}) [${m.status.toUpperCase()}]`).join('\n')
              : 'No medications administered during this admission.';
              
          setDischargeForm(prev => ({
              ...prev,
              medicationsDuringAdmission: formattedMeds
          }));
      } catch (err) {
          console.error("Failed to auto-fetch medications for discharge context", err);
      }
      setIsDischarging(true);
  };

  const handleDischargeCase = async (e) => {
      e.preventDefault();
      try {
          await api.post(`/patients/${id}/discharge`, dischargeForm);
          setIsDischarging(false);
          fetchPatient();
          // After successfully updating, send the user back to the dashboard or let them view the discharged state.
          alert("Patient successfully discharged.");
          navigate('/');
      } catch (err) {
          alert("Failed to discharge patient: " + err.message);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <button onClick={() => navigate('/')} className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2">
        &larr; Back to Dashboard
      </button>

      {/* Escalation Banner for Doctors */}
      {user.role === 'doctor' && patient.status === 'escalated' && escalations.length > 0 && (
          <div className="bg-danger/10 border-l-4 border-danger p-5 rounded-r-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h3 className="text-danger font-bold text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 animate-pulse" /> Action Required: Case Escalated
                  </h3>
                  <p className="text-text-primary mt-1 font-semibold">Reason: {escalations[0].reason}</p>
                  <p className="text-xs text-text-muted mt-1">Escalated by: {escalations[0].escalatedBy}</p>
              </div>
              <button onClick={() => handleReviewCase(escalations[0].id)} className="btn btn-danger whitespace-nowrap">
                  Mark as Reviewed
              </button>
          </div>
      )}

      {/* Patient Header Block */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-border stagger-slide-up">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary mb-1 flex items-center gap-3">
              {patient.name}
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white ${
                patient.status === 'discharged' ? 'bg-secondary' :
                patient.careIntensity === 4 ? 'bg-danger' : 
                patient.careIntensity === 3 ? 'bg-warning' : 
                patient.careIntensity === 2 ? 'bg-info' : 'bg-success'
              }`}>
                {patient.status === 'discharged' ? 'ARCHIVED' : `Intensity L${patient.careIntensity}`}
              </span>
            </h1>
            <div className="flex flex-wrap gap-3 text-sm mt-3">
              <span className="bg-bg-tertiary px-3 py-1 rounded-full border border-border"><strong>MRN:</strong> {patient.mrn}</span>
              <span className="bg-primary text-white px-3 py-1 rounded-full font-semibold">Bed {patient.bedNumber}</span>
              <span className="bg-danger/10 text-danger px-3 py-1 rounded-full font-semibold">Allergies: {patient.allergies}</span>
            </div>
            <p className="mt-4 text-text-secondary"><strong>Diagnosis:</strong> {patient.diagnosis}</p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-3">
            {patient.status !== 'discharged' && (
               <>
                 <button onClick={() => setIsEditing(true)} className="btn btn-secondary !py-2 w-full md:w-auto">Edit Info</button>
                 {user.role === 'nurse' && patient.status !== 'escalated' && (
                   <button onClick={handleEscalate} className="btn btn-danger !py-2 w-full md:w-auto flex justify-center">
                     <AlertTriangle className="w-4 h-4" /> Escalate Case
                   </button>
                 )}
                 {user.role === 'doctor' && (
                   <button onClick={prepareDischarge} className="btn btn-warning !py-2 w-full md:w-auto">Discharge</button>
                 )}
               </>
            )}
            {patient.status === 'discharged' && (
               <div className="bg-bg-tertiary border border-border px-4 py-2 rounded-lg text-sm font-bold text-text-muted flex items-center gap-2">
                   <Archive className="w-4 h-4" /> Read-Only Archive
               </div>
            )}
          </div>
        </div>

        {/* Edit Modal / Form Overlay */}
        {isEditing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-primary w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border">
                  <div className="p-6 border-b border-border bg-bg-tertiary">
                     <h2 className="text-2xl font-bold">Edit Patient Info</h2>
                  </div>
                  <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Name</label>
                             <input type="text" className="input-field" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                         </div>
                         <div>
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Bed Number</label>
                             <input type="text" className="input-field" value={editForm.bedNumber} onChange={e => setEditForm({...editForm, bedNumber: e.target.value})} required />
                         </div>
                         <div>
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Date of Birth</label>
                             <input type="date" className="input-field" value={editForm.dob} onChange={e => setEditForm({...editForm, dob: e.target.value})} required />
                         </div>
                         <div>
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Care Intensity (1-4)</label>
                             <select className="input-field" value={editForm.careIntensity} onChange={e => setEditForm({...editForm, careIntensity: parseInt(e.target.value)})}>
                                 <option value={1}>Level 1 (Basic)</option>
                                 <option value={2}>Level 2 (Moderate)</option>
                                 <option value={3}>Level 3 (High)</option>
                                 <option value={4}>Level 4 (Critical)</option>
                             </select>
                         </div>
                         <div className="col-span-2">
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Allergies</label>
                             <input type="text" className="input-field" value={editForm.allergies || ''} onChange={e => setEditForm({...editForm, allergies: e.target.value})} />
                         </div>
                         <div className="col-span-2">
                             <label className="block text-sm font-bold mb-1 flex items-center justify-between">
                                 <span className="text-text-secondary">Diagnosis</span>
                                 {user.role === 'nurse' && <span className="text-xs text-warning border border-warning/50 px-2 py-0.5 rounded-full">Doctors Only</span>}
                             </label>
                             <textarea 
                                className={`input-field min-h-[80px] ${user.role === 'nurse' ? 'bg-bg-tertiary opacity-70 cursor-not-allowed' : ''}`} 
                                value={editForm.diagnosis} 
                                onChange={e => setEditForm({...editForm, diagnosis: e.target.value})} 
                                disabled={user.role === 'nurse'}
                                required 
                             />
                         </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
                         <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary !py-2">Cancel</button>
                         <button type="submit" className="btn btn-primary !py-2">Save Changes</button>
                     </div>
                  </form>
               </div>
            </div>
        )}

        {/* Discharge Modal / Form Overlay */}
        {isDischarging && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto">
               <div className="bg-bg-primary w-full max-w-3xl rounded-2xl shadow-2xl border border-warning/50 my-8">
                  <div className="p-6 border-b border-warning/30 bg-warning/10 rounded-t-2xl">
                     <h2 className="text-2xl font-black text-warning flex items-center gap-3">
                         <AlertTriangle className="w-6 h-6" /> Official Patient Discharge
                     </h2>
                     <p className="text-warning/80 text-sm mt-1">Please completely fill out the clinical discharge summary for {patient.name}.</p>
                  </div>
                  <form onSubmit={handleDischargeCase} className="p-6 space-y-6">
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="col-span-1 md:col-span-2">
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Reason for Admission</label>
                             <input type="text" className="input-field" placeholder="e.g. Acute appendicitis" value={dischargeForm.reasonForAdmission} onChange={e => setDischargeForm({...dischargeForm, reasonForAdmission: e.target.value})} required />
                         </div>
                         <div>
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Duration of Stay</label>
                             <input type="text" className="input-field" placeholder="e.g. 5 days" value={dischargeForm.duration} onChange={e => setDischargeForm({...dischargeForm, duration: e.target.value})} required />
                         </div>
                         <div className="col-span-1 md:col-span-2">
                             <label className="block text-sm font-bold mb-1 text-text-secondary">Medication History during Admission</label>
                             <textarea className="input-field min-h-[80px]" placeholder="Summary of administered meds..." value={dischargeForm.medicationsDuringAdmission} onChange={e => setDischargeForm({...dischargeForm, medicationsDuringAdmission: e.target.value})} required />
                         </div>
                     </div>

                     <div className="bg-bg-tertiary p-5 rounded-xl border border-border">
                         <h4 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-4">Vitals at Time of Discharge</h4>
                         <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-text-secondary">Heart Rate</label>
                                 <input type="text" className="input-field !text-sm" placeholder="72 bpm" value={dischargeForm.dischargeVitals.hr} onChange={e => setDischargeForm({...dischargeForm, dischargeVitals: {...dischargeForm.dischargeVitals, hr: e.target.value}})} required />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-text-secondary">BP</label>
                                 <input type="text" className="input-field !text-sm" placeholder="120/80" value={dischargeForm.dischargeVitals.bp} onChange={e => setDischargeForm({...dischargeForm, dischargeVitals: {...dischargeForm.dischargeVitals, bp: e.target.value}})} required />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-text-secondary">SpO2</label>
                                 <input type="text" className="input-field !text-sm" placeholder="98%" value={dischargeForm.dischargeVitals.o2} onChange={e => setDischargeForm({...dischargeForm, dischargeVitals: {...dischargeForm.dischargeVitals, o2: e.target.value}})} required />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-text-secondary">Temp</label>
                                 <input type="text" className="input-field !text-sm" placeholder="98.6 °F" value={dischargeForm.dischargeVitals.temp} onChange={e => setDischargeForm({...dischargeForm, dischargeVitals: {...dischargeForm.dischargeVitals, temp: e.target.value}})} required />
                             </div>
                             <div className="col-span-2 lg:col-span-1">
                                 <label className="block text-xs font-bold mb-1 text-text-secondary">Lipid Panel / Labs</label>
                                 <input type="text" className="input-field !text-sm" placeholder="e.g. LDL 90" value={dischargeForm.dischargeVitals.lipids} onChange={e => setDischargeForm({...dischargeForm, dischargeVitals: {...dischargeForm.dischargeVitals, lipids: e.target.value}})} />
                             </div>
                         </div>
                     </div>

                     <div className="col-span-1 md:col-span-2">
                         <label className="block text-sm font-bold mb-1 text-text-secondary">Medications & Health Recommendations</label>
                         <textarea className="input-field min-h-[100px]" placeholder="Post-discharge care, prescriptions, follow-up dates..." value={dischargeForm.dischargeRecommendations} onChange={e => setDischargeForm({...dischargeForm, dischargeRecommendations: e.target.value})} required />
                     </div>

                     <div className="flex justify-end gap-3 pt-4">
                         <button type="button" onClick={() => setIsDischarging(false)} className="btn btn-secondary !py-3 !px-6">Cancel</button>
                         <button type="submit" className="btn btn-warning !py-3 !px-6 shadow-[0_4px_15px_rgba(251,191,36,0.4)]">Submit Discharge</button>
                     </div>
                  </form>
               </div>
            </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b-2 border-border mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {patient.status === 'discharged' && (
             <TabButton active={activeTab === 'discharge'} onClick={() => setActiveTab('discharge')} icon={<Archive size={18}/>}>Discharge Summary</TabButton>
          )}
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<FileText size={18}/>}>Profile & History</TabButton>
          <TabButton active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} icon={<Activity size={18}/>}>Vitals & Symptoms</TabButton>
          <TabButton active={activeTab === 'diet'} onClick={() => setActiveTab('diet')} icon={<Apple size={18}/>}>Diet & Nutrition</TabButton>
          <TabButton active={activeTab === 'sleep'} onClick={() => setActiveTab('sleep')} icon={<Moon size={18}/>}>Sleep Log</TabButton>
          <TabButton active={activeTab === 'meds'} onClick={() => setActiveTab('meds')} icon={<ClipboardList size={18}/>}>Medications</TabButton>
        </div>

        {/* Tab Contents */}
        <div className="min-h-[150px] relative transition-all duration-300">
          {activeTab === 'discharge' && patient.status === 'discharged' && <DischargeSummaryTab patientId={id} />}
          {activeTab === 'history' && <HistoryTab patientId={id} />}
          {activeTab === 'vitals' && <VitalsTab patientId={id} />}
          {activeTab === 'diet' && <DietTab patientId={id} />}
          {activeTab === 'sleep' && <SleepTab patientId={id} />}
          {activeTab === 'meds' && <MedsTab patientId={id} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 border-b-2 -mb-[22px] ${
        active 
        ? 'text-primary border-primary bg-primary/5 rounded-t-lg' 
        : 'text-text-secondary border-transparent hover:text-primary hover:bg-hover rounded-t-lg'
      }`}
    >
      {icon} {children}
    </button>
  );
}
