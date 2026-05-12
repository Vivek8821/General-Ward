import React, { useState, useEffect, useRef } from 'react';
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
  const prevEscalatedRef = useRef([]);
  const isInitialLoad = useRef(true);
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
    queryFn: async () => { const res = await api.get(endpoint); return res?.data ?? []; },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: viewMode === 'active' ? 15 * 1000 : false,
    refetchOnMount: false,
  });

  const { data: escalated = [] } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => api.get('/escalations/all'),
    enabled: user?.role === 'doctor' && viewMode === 'active',
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  useEffect(() => {
    const prev = prevEscalatedRef.current;
    
    // Only show toasts if we have already done the initial data load
    // and there are actually more escalations than before
    if (!isInitialLoad.current && escalated.length > prev.length) {
      escalated
        .filter(e => !prev.some(p => p.id === e.id))
        .forEach(e => toast.error(`Case Escalated: ${e.reason}`, { icon: '🚨', duration: 6000 }));
    }
    
    if (escalated.length > 0) {
      isInitialLoad.current = false;
    }
    
    prevEscalatedRef.current = escalated;
  }, [escalated]);

  useEffect(() => {
    if (viewMode === 'archived') setIsReviewingCases(false);
  }, [viewMode]);

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
    <div className="space-y-6 animate-in fade-in duration-500">

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

      {/* Patient List */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-secondary">
              {isReviewingCases
                ? 'Critical Patients'
                : viewMode === 'active' ? 'Active Patient Roster' : 'Archived Discharge Records'}
            </h2>
            {isReviewingCases && (
              <button
                onClick={() => setIsReviewingCases(false)}
                className="btn !py-1.5 !px-3 text-xs"
              >
                ← Show All Patients
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" aria-hidden />
              <input
                type="text"
                placeholder="Search MRN, Name, Bed…"
                aria-label="Search patients by MRN, name, or bed number"
                className="input-field !pl-9 !py-2 text-sm w-56"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setIsAddingPatient(true)}
              className="btn btn-primary !py-2 text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Patient
            </button>

            {viewMode === 'active' && user.role === 'nurse' && escalatedPatients.length > 0 && (
              <button
                onClick={() => setIsReviewingCases(!isReviewingCases)}
                className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors whitespace-nowrap ${isReviewingCases ? 'btn bg-bg-tertiary text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40' : 'bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900'}`}
              >
                {isReviewingCases ? 'View All' : 'Review Escalated'}
              </button>
            )}
          </div>
        </div>

        {isPatientsLoading ? (
          <div className="py-20 text-center text-text-muted text-sm">Loading patients…</div>
        ) : isPatientsError ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-danger font-semibold">Failed to load patients.</p>
            <button type="button" onClick={() => refetchPatients()} className="btn btn-secondary text-sm">Retry</button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-20 text-center text-text-muted flex flex-col items-center gap-3">
            <Users size={40} className="opacity-20" />
            <p className="text-sm font-semibold">
              {isReviewingCases ? 'No pending cases require immediate attention.' : 'No patients found matching your search.'}
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
