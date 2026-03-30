import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { queryKeys } from '../utils/queryKeys';
import { Users, Bed, Activity, AlertTriangle, Plus, Search, Archive, X } from 'lucide-react';
import toast from 'react-hot-toast';

const WELCOME_DISMISSED_KEY = 'ward_welcome_dismissed';

export default function Dashboard() {
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem(WELCOME_DISMISSED_KEY); } catch { return true; }
  });
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
  const [escalated, setEscalated] = useState([]);
  const [search, setSearch] = useState('');
  const [isReviewingCases, setIsReviewingCases] = useState(false);
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [addingPatient, setAddingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    mrn: '',
    bedNumber: '',
    dob: '',
    diagnosis: '',
    allergies: '',
    careIntensity: 1
  });
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const endpoint = viewMode === 'active' ? '/patients' : '/patients/archives';

  const {
    data: patients = [],
    isLoading: isPatientsLoading,
    isError: isPatientsError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: queryKeys.patients(viewMode),
    queryFn: async () => api.get(endpoint),
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: viewMode === 'active' ? 15 * 1000 : false,
    // Prevent navigation-driven remounts from triggering duplicate fetches.
    refetchOnMount: false,
  });

  // Polling setup for Doctors to receive real-time-like notifications.
  useEffect(() => {
    let intervalId;
    if (user?.role === 'doctor' && viewMode === 'active') {
      intervalId = setInterval(async () => {
        try {
          const eData = await api.get('/escalations/all');
          setEscalated(prev => {
            if (eData.length > prev.length) {
              const newEscalations = eData.filter(e => !prev.some(p => p.id === e.id));
              newEscalations.forEach(e => {
                toast.error(`Case Escalate: ${e.reason}`, {
                  icon: '🚨',
                  duration: 6000,
                });
              });
            }
            return eData;
          });

        } catch (err) {
          console.error('Polling error', err);
        }
      }, 15000); // 15 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.role, viewMode]);

  useEffect(() => {
    // Escalation review is only meaningful in the active roster.
    if (viewMode === 'archived') setIsReviewingCases(false);
  }, [viewMode]);

  useEffect(() => {
    // Initial escalations load (kept out of the patient query pilot).
    if (user?.role === 'doctor' && viewMode === 'active') {
      api.get('/escalations/all')
        .then((eData) => setEscalated(eData))
        .catch((err) => console.error(err));
    } else {
      setEscalated([]);
    }
  }, [user?.role, viewMode]);

  const handleSavePatient = async (e) => {
    e.preventDefault();
    try {
      setAddingPatient(true);
      await api.post('/patients', newPatient);
      toast.success('Patient added successfully to the ward');
      setIsAddingPatient(false);
      setNewPatient({
        name: '',
        mrn: '',
        bedNumber: '',
        dob: '',
        diagnosis: '',
        allergies: '',
        careIntensity: 1
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.patients(viewMode) });
    } catch (err) {
      toast.error(err.message || 'Failed to add patient');
    } finally {
      setAddingPatient(false);
    }
  };

  const activePatients = patients.filter(p => ['active', 'escalated'].includes(p.status));
  const escalatedPatients = activePatients.filter(p => p.status === 'escalated');
  let filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.mrn.toLowerCase().includes(search.toLowerCase()) ||
    p.bedNumber.toLowerCase().includes(search.toLowerCase())
  );
  
  // Filter further if reviewing cases
  if (isReviewingCases) {
      filteredPatients = filteredPatients.filter(p => p.status === 'escalated');
  }

  const dismissWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem(WELCOME_DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {showWelcome && (
        <div className="relative bg-primary/10 border border-primary/20 rounded-xl p-5 pr-12">
          <button
            type="button"
            onClick={dismissWelcome}
            className="absolute top-3 right-3 p-1 rounded-md hover:bg-primary/20 text-primary transition-colors"
            aria-label="Dismiss welcome message"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-primary">Welcome to General Ward</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            This is your clinical operations dashboard. Use the <strong>Active Ward</strong> view to manage current patients,
            or switch to <strong>Hospital Archives</strong> for discharged records.
            Open any patient card for vitals, medications, notes, and more.
          </p>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-4 border-b border-border pb-4 w-fit">
        <button 
          onClick={() => setViewMode('active')} 
          className={`flex items-center gap-2 font-semibold px-4 py-2 rounded-lg border transition-colors ${viewMode === 'active' ? 'border-zinc-400 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100' : 'border-transparent text-text-muted hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'}`}
        >
          <Activity size={18} /> Active Ward
        </button>
        <button 
          onClick={() => setViewMode('archived')} 
          className={`flex items-center gap-2 font-semibold px-4 py-2 rounded-lg border transition-colors ${viewMode === 'archived' ? 'border-zinc-400 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100' : 'border-transparent text-text-muted hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'}`}
        >
          <Archive size={18} /> Hospital Archives
        </button>
      </div>

      {/* Escalation Alert Bar (Doctor Only) */}
      {viewMode === 'active' && user.role === 'doctor' && escalated.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 border-l-4 border-l-red-500 p-5 rounded-r-xl flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 text-red-700 dark:text-red-400 font-semibold text-lg">
            <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden />
            {escalated.length} Patient{escalated.length > 1 ? 's' : ''} Require Immediate Attention
          </div>
          <button 
            onClick={() => setIsReviewingCases(!isReviewingCases)}
            className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${isReviewingCases ? 'btn bg-bg-tertiary text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40' : 'bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900'}`}
          >
            {isReviewingCases ? 'View All Patients' : 'Review Cases'}
          </button>
        </div>
      )}

      {/* Stats Grid */}
      {viewMode === 'active' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Patients" value={patients.length} icon={<Users size={24} />} />
          <StatCard title="Active Beds" value={activePatients.length} icon={<Bed size={24} />} />
          <StatCard title="Critical Care (Level 4)" value={activePatients.filter(p => p.careIntensity === 4).length} icon={<Activity size={24} />} color="text-danger" />
          <StatCard title="Escalations" value={escalatedPatients.length} icon={<AlertTriangle size={22} strokeWidth={2} />} color="text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Patient List */}
      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary p-6 border-b border-border flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-bold">{viewMode === 'active' ? 'Active Patient Roster' : 'Archived Discharge Records'}</h2>
          
          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" aria-hidden />
              <input 
                type="text" 
                placeholder="Search MRN, Name, Bed..." 
                aria-label="Search patients by MRN, name, or bed number"
                className="input-field !pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => setIsAddingPatient(true)}
              className="btn btn-primary whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> Add Patient
            </button>

            {(user.role === 'doctor' || user.role === 'nurse') && viewMode === 'active' && (
              <button
                onClick={() => window.location.href = '/tasks'}
                className="btn btn-secondary whitespace-nowrap"
              >
                My Tasks
              </button>
            )}

            {/* Nurse-focused shortcut: quickly focus the roster on escalated cases */}
            {viewMode === 'active' && user.role === 'nurse' && escalatedPatients.length > 0 && (
              <button
                onClick={() => setIsReviewingCases(!isReviewingCases)}
                className={`text-sm px-4 py-2.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${isReviewingCases ? 'btn bg-bg-tertiary text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40' : 'bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900'}`}
              >
                {isReviewingCases ? 'View All Patients' : 'Review Escalated Patients'}
              </button>
            )}
          </div>
        </div>

        {isPatientsLoading ? (
          <div className="p-10 text-center text-text-muted">Loading patients...</div>
        ) : isPatientsError ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-danger font-semibold">Failed to load patients.</p>
            <button
              type="button"
              onClick={() => refetchPatients()}
              className="btn btn-secondary text-sm"
            >
              Retry
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <Users size={48} className="opacity-20" />
            <p className="font-semibold">
              {isReviewingCases 
                ? "No pending cases require immediate attention." 
                : "No patients found matching your search."}
            </p>
          </div>
        ) : (
          <div className="p-6 bg-bg-primary grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-slide-up">
            {filteredPatients.map(patient => (
              <a
                key={patient.id} 
                href={`/patient/${patient.id}`}
                className="card p-6 cursor-pointer hover:-translate-y-0.5 flex flex-col justify-between h-full group transition-all duration-300 no-underline text-inherit focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <h3 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors min-w-0 truncate">
                      {patient.name}
                      <span className="font-semibold text-text-secondary whitespace-nowrap"> · Bed {patient.bedNumber}</span>
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-500 font-medium shrink-0">
                      {viewMode === 'active' ? `L${patient.careIntensity}` : 'Out'}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider font-mono mb-4">
                    MRN {patient.mrn}
                  </div>
                  
                  <div className="bg-slate-100 dark:bg-zinc-900 rounded-xl p-4 min-h-[80px] border border-slate-200 dark:border-zinc-700/80">
                     <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Primary Diagnosis</span>
                     <span className="text-sm font-medium text-slate-800 dark:text-white line-clamp-2">{patient.diagnosis}</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-border/60 flex justify-between items-center">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${patient.status === 'escalated' ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>
                    {patient.status}
                  </span>
                  <span className="text-xs font-semibold text-text-secondary group-hover:text-primary group-hover:underline flex items-center gap-1">
                    View Profile &rarr;
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {isAddingPatient && (
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
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Full Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. John Doe"
                    value={newPatient.name} 
                    onChange={e => setNewPatient({...newPatient, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Bed Number *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. A-12"
                    value={newPatient.bedNumber} 
                    onChange={e => setNewPatient({...newPatient, bedNumber: e.target.value})} 
                    required 
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">MRN (Medical Record Number) *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. MRN12345"
                    value={newPatient.mrn} 
                    onChange={e => setNewPatient({...newPatient, mrn: e.target.value})} 
                    required 
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Date of Birth *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={newPatient.dob} 
                    onChange={e => setNewPatient({...newPatient, dob: e.target.value})} 
                    required 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Primary Diagnosis *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Hypertension, Diabetes Type 2"
                    value={newPatient.diagnosis} 
                    onChange={e => setNewPatient({...newPatient, diagnosis: e.target.value})} 
                    required 
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Allergies (if any)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Penicillin, Peanuts"
                    value={newPatient.allergies} 
                    onChange={e => setNewPatient({...newPatient, allergies: e.target.value})} 
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold mb-1 text-text-secondary">Initial Care Intensity</label>
                  <select 
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
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color = 'text-primary' }) {
  return (
    <div className="card p-6 pb-4 border-t-4 border-t-primary relative flex flex-col justify-between min-h-[132px] transition-transform hover:-translate-y-0.5">
      <div className="flex justify-between items-start gap-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
        <span className={`shrink-0 opacity-70 ${color}`} aria-hidden>
          {icon}
        </span>
      </div>
      <div className={`text-4xl font-extrabold tracking-tight ${color} leading-tight mt-2`}>{value}</div>
    </div>
  );
}
