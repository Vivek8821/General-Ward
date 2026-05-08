import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../utils/queryKeys';
import { Activity, Archive, Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import DashboardStats from './components/DashboardStats';
import { WelcomeBanner, EscalationAlert } from './components/DashboardAlerts';
import PatientGrid from './components/PatientGrid';
import AddPatientModal from './components/AddPatientModal';
import { isPatientCritical } from '../../utils/clinicalUtils';

const WELCOME_DISMISSED_KEY = 'ward_welcome_dismissed';

export default function DashboardView() {
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem(WELCOME_DISMISSED_KEY); } catch { return true; }
  });
  const [search, setSearch] = useState('');
  const [escalated, setEscalated] = useState([]);
  const location = useLocation();
  const viewMode = location.pathname === '/archives' ? 'archived' : 'active';
  
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
    careIntensity: 1,
    notice_given_at: null,
    notice_given_by: null,
    guardian_name: '',
    guardian_contact: '',
    guardian_notice_at: null,
    data_nominee: '',
    data_nominee_relationship: '',
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
    refetchOnMount: false,
  });

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
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.role, viewMode]);

  useEffect(() => {
    if (viewMode === 'archived') setIsReviewingCases(false);
  }, [viewMode]);

  useEffect(() => {
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
        careIntensity: 1,
        notice_given_at: null,
        notice_given_by: null,
        guardian_name: '',
        guardian_contact: '',
        guardian_notice_at: null,
        data_nominee: '',
        data_nominee_relationship: '',
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
  const criticalPatients = activePatients.filter(isPatientCritical);
  const q = search.toLowerCase();
  let filteredPatients = patients.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.mrn || '').toLowerCase().includes(q) ||
    (p.bedNumber || '').toLowerCase().includes(q)
  );

  if (isReviewingCases) {
    filteredPatients = filteredPatients.filter(p =>
      user.role === 'doctor' ? isPatientCritical(p) : p.status === 'escalated'
    );
  }

  const dismissWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem(WELCOME_DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <WelcomeBanner showWelcome={showWelcome} dismissWelcome={dismissWelcome} />


      <EscalationAlert
        user={user}
        viewMode={viewMode}
        criticalPatients={criticalPatients}
        isReviewingCases={isReviewingCases}
        setIsReviewingCases={setIsReviewingCases}
      />

      {viewMode === 'active' && (
        <DashboardStats 
          patients={patients} 
          activePatients={activePatients} 
          escalatedPatients={escalatedPatients} 
        />
      )}

      {/* Patient List Container */}
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
          <PatientGrid filteredPatients={filteredPatients} viewMode={viewMode} />
        )}
      </div>

      <AddPatientModal 
        isAddingPatient={isAddingPatient} 
        setIsAddingPatient={setIsAddingPatient} 
        handleSavePatient={handleSavePatient} 
        newPatient={newPatient} 
        setNewPatient={setNewPatient} 
        addingPatient={addingPatient} 
      />
    </div>
  );
}
