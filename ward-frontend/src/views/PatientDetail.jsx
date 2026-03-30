import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity, Apple, Moon, ClipboardList, AlertTriangle, FileText, Clock, CheckCircle } from 'lucide-react';
import HistoryTab from '../components/stats/HistoryTab';
import HandoverNotesPanel from '../components/stats/HandoverNotesPanel';
import VitalsTab from '../components/stats/VitalsTab';
import DietTab from '../components/stats/DietTab';
import SleepTab from '../components/stats/SleepTab';
import MedsTab from '../components/stats/MedsTab';
import DischargeSummaryTab from '../components/stats/DischargeSummaryTab';
import { Archive } from 'lucide-react';
import { allergiesHasRisk, formatAllergiesMutedLabel } from '../utils/patientDisplay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import toast from 'react-hot-toast';

function errMsg(err) {
  return err?.message || 'Unknown error';
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [patientError, setPatientError] = useState(null);
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
  const [patientTasks, setPatientTasks] = useState([]);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const canManageTasks = ['doctor', 'nurse', 'admin'].includes(user?.role);

  async function fetchPatientTasks() {
    try {
      const tasks = await api.get(`/patients/${id}/tasks?status=open&limit=50`);
      setPatientTasks(Array.isArray(tasks) ? tasks : []);
    } catch (err) {
      console.error(err);
      // Keep tasks panel resilient; patient detail can render even if tasks fail.
      setPatientTasks([]);
    }
  }

  async function fetchPatient() {
    try {
      setPatientError(null);
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
      if (err?.status === 404) {
        setPatientError('Patient not found.');
      } else {
        setPatientError('Unable to load patient data. The server may be unreachable.');
      }
    }
  }

  async function fetchEscalations() {
    try {
      const eData = await api.get('/escalations/all');
      // Filter escalations for this specific patient
      setEscalations(eData.filter(e => e.patientId === id));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchPatientTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.role]);

  useEffect(() => {
    if (!patient) return;
    if (patient.status !== 'discharged' && activeTab === 'discharge') {
      setActiveTab('history');
    }
  }, [patient, patient?.status, patient?.id, activeTab]);

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}/complete`, {});
      await fetchPatientTasks();
    } catch (err) {
      toast.error('Failed to complete task: ' + errMsg(err));
    }
  };

  if (patientError) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => navigate('/')} className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2">
          &larr; Back to Dashboard
        </button>
        <div className="card p-10 text-center space-y-4">
          <p className="text-danger font-semibold text-lg">{patientError}</p>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={() => fetchPatient()} className="btn btn-primary text-sm">
              Retry
            </button>
            <button type="button" onClick={() => navigate('/')} className="btn btn-secondary text-sm">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) return <div className="p-10 text-center">Loading patient data...</div>;

  const openEscalateModal = () => {
    setEscalateReason('');
    setEscalateModalOpen(true);
  };

  const submitEscalation = async (e) => {
    e.preventDefault();
    const reason = escalateReason.trim();
    if (!reason) {
      toast.error('Please enter a reason for escalation.');
      return;
    }
    try {
      await api.post(`/patients/${id}/escalations`, { reason });
      toast.success('Case escalated. Doctors have been notified.');
      setEscalateModalOpen(false);
      setEscalateReason('');
      fetchPatient();
    } catch (err) {
      toast.error('Failed to escalate: ' + errMsg(err));
    }
  };

  const handleReviewCase = async (escalationId) => {
      try {
          await api.post(`/escalations/${escalationId}/review`);
          toast.success('Case marked as reviewed.');
          fetchPatient(); // Refresh status
      } catch (err) {
          toast.error('Failed to review case: ' + errMsg(err));
      }
  };

  const handleSaveEdit = async (e) => {
      e.preventDefault();
      try {
          await api.put(`/patients/${id}`, editForm);
          setIsEditing(false);
          fetchPatient();
          toast.success('Patient updated.');
      } catch (err) {
          toast.error('Failed to update patient: ' + errMsg(err));
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
          toast.success('Patient successfully discharged.');
          navigate('/');
      } catch (err) {
          toast.error('Failed to discharge patient: ' + errMsg(err));
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <button onClick={() => navigate('/')} className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2">
        &larr; Back to Dashboard
      </button>

      {/* Escalation Banner for Doctors */}
      {user.role === 'doctor' && patient.status === 'escalated' && escalations.length > 0 && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 border-l-4 border-l-red-500 p-5 rounded-r-xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h3 className="text-red-700 dark:text-red-400 font-semibold text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden /> Action Required: Case Escalated
                  </h3>
                  <p className="text-text-primary mt-1 font-semibold">Reason: {escalations[0].reason}</p>
                  <p className="text-xs text-text-muted mt-1">Escalated by: {escalations[0].escalatedBy}</p>
              </div>
              <button onClick={() => handleReviewCase(escalations[0].id)} className="bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900 px-5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-colors">
                  Mark as Reviewed
              </button>
          </div>
      )}

      {/* Patient Header Block */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-border stagger-slide-up">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-black dark:text-white">
                {patient.name}
              </h1>
              {patient.status === 'discharged' && (
                <span className="text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600">
                  Archived
                </span>
              )}
              {patient.status !== 'discharged' && patient.careIntensity >= 3 && (
                <span
                  className={`text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 border ${
                    patient.careIntensity === 4
                      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800'
                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50'
                  }`}
                >
                  Level {patient.careIntensity}
                </span>
              )}
            </div>
            <div
              className="mt-3 text-sm text-slate-700 dark:text-slate-400 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 px-3 py-2 font-medium"
              aria-label="Patient identifiers"
            >
              <span className="whitespace-normal break-words">
                <span className="text-slate-500 dark:text-slate-500">MRN:</span> {patient.mrn}
                <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden>
                  |
                </span>
                <span className="text-slate-500 dark:text-slate-500">Bed</span> {patient.bedNumber}
                <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden>
                  |
                </span>
                <span className="text-slate-500 dark:text-slate-500">Level</span> {patient.careIntensity}
              </span>
            </div>
            <div className="mt-2 text-sm">
              {allergiesHasRisk(patient.allergies) ? (
                <span className="inline-flex items-center rounded-md border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/45 px-2.5 py-1 font-semibold text-red-800 dark:text-red-200">
                  Allergies: {String(patient.allergies).trim()}
                </span>
              ) : (
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-500">Allergies:</span>{' '}
                  {formatAllergiesMutedLabel(patient.allergies)}
                </p>
              )}
            </div>
            <p className="mt-4 text-text-secondary">
              <strong>Diagnosis:</strong> {patient.diagnosis}
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-3 shrink-0">
            {patient.status !== 'discharged' && (
               <>
                 <button onClick={() => setIsEditing(true)} className="btn btn-secondary !py-2 w-full md:w-auto">Edit Info</button>
                 {user.role === 'nurse' && patient.status !== 'escalated' && (
                   <button onClick={openEscalateModal} className="btn btn-danger !py-2 w-full md:w-auto flex justify-center">
                     <AlertTriangle className="w-4 h-4" /> Escalate Case
                   </button>
                 )}
                 {user.role === 'doctor' && (
                   <button onClick={prepareDischarge} className="btn btn-primary !py-2 w-full md:w-auto">Discharge</button>
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

        {/* Tasks Due Panel */}
        {patientTasks.length > 0 && (
          <div className="mt-6 bg-bg-tertiary border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" /> Tasks Due
              </h3>
              <div className="text-xs uppercase tracking-widest font-bold text-text-muted">
                Open: {patientTasks.length}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {patientTasks.map((t) => {
                const dueDate = t.dueAt ? new Date(t.dueAt) : null;
                const dueLabel =
                  dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toLocaleString() : '--';

                return (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary truncate">
                        {t.type} task
                      </div>
                      <div className="text-sm text-text-muted truncate">
                        Due: {dueLabel}
                      </div>
                      {t.notes && (
                        <div className="mt-2 text-sm text-text-primary/90 whitespace-pre-wrap">
                          {t.notes}
                        </div>
                      )}
                    </div>

                    {canManageTasks && patient.status !== 'discharged' && (
                      <button
                        onClick={() => handleCompleteTask(t.id)}
                        className="btn btn-success !py-2 !px-4 flex items-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit Modal / Form Overlay */}
        {isEditing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
               <div className="bg-bg-primary w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border">
                  <div className="p-6 border-b border-border bg-bg-tertiary">
                     <h2 id="edit-patient-title" className="text-2xl font-bold">Edit Patient Info</h2>
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
                                 {user.role === 'nurse' && <span className="text-xs text-warning border border-warning/50 px-2 py-0.5 rounded-md">Doctors Only</span>}
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

        {/* Escalate case — nurse */}
        {escalateModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
              role="dialog"
              aria-modal="true"
              aria-labelledby="escalate-dialog-title"
            >
              <div className="bg-bg-primary w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border">
                <div className="p-6 border-b border-border bg-bg-tertiary">
                  <h2 id="escalate-dialog-title" className="text-xl font-bold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden />
                    Escalate to doctor
                  </h2>
                  <p className="text-sm text-text-muted mt-1">Provide a clear reason for escalation. This will be visible to the care team.</p>
                </div>
                <form onSubmit={submitEscalation} className="p-6 space-y-4">
                  <div>
                    <label htmlFor="escalate-reason" className="block text-sm font-bold mb-1 text-text-secondary">
                      Reason
                    </label>
                    <textarea
                      id="escalate-reason"
                      className="input-field min-h-[100px]"
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="Clinical concern, required review, etc."
                      autoFocus
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      className="btn btn-secondary !py-2"
                      onClick={() => {
                        setEscalateModalOpen(false);
                        setEscalateReason('');
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-danger !py-2">
                      Submit escalation
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* Discharge Modal / Form Overlay */}
        {isDischarging && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="discharge-dialog-title">
               <div className="bg-bg-primary w-full max-w-3xl rounded-2xl shadow-2xl border border-border my-8">
                  <div className="p-6 border-b border-border bg-bg-tertiary rounded-t-2xl">
                     <h2 id="discharge-dialog-title" className="text-2xl font-bold text-text-primary flex items-center gap-3">
                         <FileText className="w-6 h-6 text-slate-600 dark:text-slate-400" aria-hidden /> Official Patient Discharge
                     </h2>
                     <p className="text-text-muted text-sm mt-1">Please completely fill out the clinical discharge summary for {patient.name}.</p>
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
                        <button type="submit" className="btn btn-primary !py-3 !px-6">Submit Discharge</button>
                     </div>
                  </form>
               </div>
            </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList aria-label="Patient chart sections">
            {patient.status === 'discharged' && (
              <TabsTrigger value="discharge">
                <Archive size={18} aria-hidden /> Discharge Summary
              </TabsTrigger>
            )}
            <TabsTrigger value="history">
              <FileText size={18} aria-hidden /> Profile &amp; History
            </TabsTrigger>
            <TabsTrigger value="vitals">
              <Activity size={18} aria-hidden /> Vitals &amp; Symptoms
            </TabsTrigger>
            <TabsTrigger value="diet">
              <Apple size={18} aria-hidden /> Diet &amp; Nutrition
            </TabsTrigger>
            <TabsTrigger value="sleep">
              <Moon size={18} aria-hidden /> Sleep Log
            </TabsTrigger>
            <TabsTrigger value="meds">
              <ClipboardList size={18} aria-hidden /> Medications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discharge">
            {patient.status === 'discharged' && <DischargeSummaryTab patientId={id} />}
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab patientId={id} readOnly={patient.status === 'discharged'} />
            <HandoverNotesPanel patientId={id} readOnly={patient.status === 'discharged'} />
          </TabsContent>
          <TabsContent value="vitals">
            <VitalsTab patientId={id} readOnly={patient.status === 'discharged'} />
          </TabsContent>
          <TabsContent value="diet">
            <DietTab patientId={id} readOnly={patient.status === 'discharged'} />
          </TabsContent>
          <TabsContent value="sleep">
            <SleepTab patientId={id} readOnly={patient.status === 'discharged'} />
          </TabsContent>
          <TabsContent value="meds">
            <MedsTab patientId={id} readOnly={patient.status === 'discharged'} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
