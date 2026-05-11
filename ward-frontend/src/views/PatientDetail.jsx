import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { queryKeys } from '../utils/queryKeys';
import { useAuth } from '../context/AuthContext';
import { Activity, Apple, Moon, ClipboardList, AlertTriangle, FileText, Clock, CheckCircle } from 'lucide-react';
import HistoryTab from '../components/stats/HistoryTab';
import HandoverNotesPanel from '../components/stats/HandoverNotesPanel';
import VitalsTab from '../components/stats/VitalsTab';
import DietTab from '../components/stats/DietTab';
import SleepTab from '../components/stats/SleepTab';
import MedsTab from '../components/stats/MedsTab';
import DischargeSummaryTab from '../components/stats/DischargeSummaryTab';
import EscalateModal from '../components/modals/EscalateModal';
import DischargeModal from '../components/modals/DischargeModal';
import EditPatientModal from '../components/modals/EditPatientModal';
import { Archive } from 'lucide-react';
import { allergiesHasRisk, formatAllergiesMutedLabel } from '../utils/patientDisplay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import MedicalHistoryForm from '../features/clinical/MedicalHistoryForm';
import StructuredAllergiesForm from '../features/clinical/StructuredAllergiesForm';
import ClinicalPresentationForm from '../features/clinical/ClinicalPresentationForm';
import LabInvestigationsForm from '../features/clinical/LabInvestigationsForm';
import ImagingReportsForm from '../features/clinical/ImagingReportsForm';
import ProceduresLog from '../features/clinical/ProceduresLog';
import ToxicologyForm from '../features/clinical/ToxicologyForm';
import ClinicalTeamForm from '../features/clinical/ClinicalTeamForm';
import DischargeReportButton from '../features/clinical/DischargeReportButton';

function errMsg(err) {
  return err?.message || 'Unknown error';
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('history');
  const [isEditing, setIsEditing] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [dischargeForm, setDischargeForm] = useState({
      reasonForAdmission: '',
      duration: '',
      medicationsDuringAdmission: '',
      dischargeVitals: { hr: '', bp: '', o2: '', temp: '', lipids: '' },
      dischargeRecommendations: '',
      admissionDiagnosis: '',
      dischargeDiagnosis: '',
      conditionAtDischarge: '',
      dischargeMode: '',
      dischargePrescription: '',
      followUpSchedule: '',
      dischargeInstructions: '',
      dietaryRestrictions: '',
  });
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  // 1. Data Fetching via React Query
  const { data: patient, isLoading: patientLoading, error: patientErr } = useQuery({
    queryKey: queryKeys.patientDetail(id),
    queryFn: () => api.get(`/patients/${id}`),
    enabled: !!id,
  });

  const { data: patientTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: queryKeys.patientTasks(id),
    queryFn: () => api.get(`/patients/${id}/tasks?status=open&limit=50`),
    enabled: !!id,
  });

  const { data: allEscalations = [] } = useQuery({
    queryKey: queryKeys.escalations(),
    queryFn: () => api.get('/escalations/all'),
    enabled: !!id && patient?.status === 'escalated' && user?.role === 'doctor',
  });

  const escalations = allEscalations.filter(e => e.patientId === id);
  const canManageTasks = ['doctor', 'nurse', 'admin'].includes(user?.role);

  // 2. State Syncing
  useEffect(() => {
    if (patient) {
      setEditForm(patient);
      if (patient.status === 'discharged') {
        setActiveTab('discharge');
      }
    }
  }, [patient]);

  useEffect(() => {
    if (!patient) return;
    if (patient.status !== 'discharged' && activeTab === 'discharge') {
      setActiveTab('history');
    }
  }, [patient?.status, activeTab]);

  // 3. Mutations
  const completeTaskMutation = useMutation({
    mutationFn: (taskId) => api.put(`/tasks/${taskId}/complete`, {}),
    onSuccess: () => {
      refetchTasks();
      toast.success('Task completed.');
    },
    onError: (err) => toast.error('Failed to complete task: ' + errMsg(err)),
  });

  const updatePatientMutation = useMutation({
    mutationFn: (data) => api.put(`/patients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(id) });
      setIsEditing(false);
      toast.success('Patient updated.');
    },
    onError: (err) => toast.error('Failed to update patient: ' + errMsg(err)),
  });

  const escalateMutation = useMutation({
    mutationFn: (reason) => api.post(`/patients/${id}/escalations`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients('active') });
      setEscalateModalOpen(false);
      setEscalateReason('');
      toast.success('Case escalated.');
    },
    onError: (err) => toast.error('Failed to escalate: ' + errMsg(err)),
  });

  const reviewEscalationMutation = useMutation({
    mutationFn: (escalationId) => api.post(`/escalations/${escalationId}/review`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.escalations() });
      toast.success('Case marked as reviewed.');
    },
    onError: (err) => toast.error('Failed to review case: ' + errMsg(err)),
  });

  const dischargeMutation = useMutation({
    mutationFn: (data) => api.post(`/patients/${id}/discharge`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients('archived') });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients('active') });
      toast.success('Patient discharged.');
      if (res?.archiveId) navigate(`/archive/${res.archiveId}`);
      else navigate('/');
    },
    onError: (err) => toast.error('Failed to discharge patient: ' + errMsg(err)),
  });

  const handleCompleteTask = (taskId) => completeTaskMutation.mutate(taskId);

  if (patientErr) {
    const patientError = patientErr.status === 404 ? 'Patient not found.' : 'Unable to load patient data.';
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => navigate('/')} className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2">
          &larr; Back to Dashboard
        </button>
        <div className="card p-10 text-center space-y-4">
          <p className="text-danger font-semibold text-lg">{patientError}</p>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(id) })} className="btn btn-primary text-sm">
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

  if (patientLoading) return <div className="p-10 text-center">Loading patient data...</div>;

  const submitEscalation = (e) => {
    e.preventDefault();
    const reason = escalateReason.trim();
    if (!reason) return toast.error('Please enter a reason.');
    escalateMutation.mutate(reason);
  };

  const handleReviewCase = (escalationId) => reviewEscalationMutation.mutate(escalationId);
  const handleSaveEdit = (e) => {
    e.preventDefault();
    updatePatientMutation.mutate(editForm);
  };

  const prepareDischarge = async () => {
      try {
          const meds = await api.get(`/patients/${id}/medications`);
          const formattedMeds = meds.length > 0 
              ? meds.map(m => `• ${m.name} — ${m.dosage} (${m.frequency}) [${m.status.toUpperCase()}]`).join('\n')
              : 'No medications administered during this admission.';
              
          setDischargeForm(prev => ({ ...prev, medicationsDuringAdmission: formattedMeds }));
      } catch (err) {
          console.error("Failed to auto-fetch medications", err);
      }
      setIsDischarging(true);
  };

  const handleDischargeCase = (e) => {
    e.preventDefault();
    dischargeMutation.mutate(dischargeForm);
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
                {patient.admittedAt && (
                  <>
                    <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden>
                      |
                    </span>
                    <span className="text-slate-500 dark:text-slate-500">Admitted:</span> {new Date(patient.admittedAt).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </>
                )}
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
                   <button onClick={() => setEscalateModalOpen(true)} className="btn btn-danger !py-2 w-full md:w-auto flex justify-center">
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

        <EditPatientModal 
          isOpen={isEditing} 
          onClose={() => setIsEditing(false)} 
          onSubmit={handleSaveEdit} 
          form={editForm} 
          setForm={setEditForm} 
          userRole={user.role} 
        />

        <EscalateModal 
          isOpen={escalateModalOpen} 
          onClose={() => setEscalateModalOpen(false)} 
          onSubmit={submitEscalation} 
          reason={escalateReason} 
          setReason={setEscalateReason} 
        />

        <DischargeModal 
          isOpen={isDischarging} 
          onClose={() => setIsDischarging(false)} 
          onSubmit={handleDischargeCase} 
          form={dischargeForm} 
          setForm={setDischargeForm} 
          patientName={patient.name} 
        />

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
            <TabsTrigger value="clinical">
              <ClipboardList size={18} aria-hidden /> Clinical Records
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discharge">
            {patient.status === 'discharged' && (
              <div className="space-y-4">
                <DischargeSummaryTab patientId={id} />
                <div className="px-4 pb-4">
                  <DischargeReportButton patientId={id} mrn={patient.mrn} />
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab patientId={id} readOnly={patient.status === 'discharged'} admittedAt={patient.admittedAt} />
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
          <TabsContent value="clinical">
            <div className="divide-y divide-border">
              <MedicalHistoryForm patientId={id} readOnly={patient.status === 'discharged'} />
              <StructuredAllergiesForm patientId={id} readOnly={patient.status === 'discharged'} />
              <ClinicalPresentationForm patientId={id} readOnly={patient.status === 'discharged'} />
              <LabInvestigationsForm patientId={id} readOnly={patient.status === 'discharged'} />
              <ImagingReportsForm patientId={id} readOnly={patient.status === 'discharged'} />
              <ProceduresLog patientId={id} readOnly={patient.status === 'discharged'} />
              <ToxicologyForm patientId={id} readOnly={patient.status === 'discharged'} />
              {(user?.role === 'doctor' || patient.status === 'discharged') && (
                <ClinicalTeamForm patientId={id} readOnly={patient.status === 'discharged'} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
