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
  const [sortBy, setSortBy] = useState('ews');
  const [ewsFilter, setEwsFilter] = useState('all');
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

  if (viewMode === 'active') {
    if (ewsFilter !== 'all') {
      filteredPatients = filteredPatients.filter(p => {
        const s = p.ews?.score ?? -1;
        if (ewsFilter === 'critical') return s >= 7;
        if (ewsFilter === 'elevated') return s >= 3 && s <= 6;
        if (ewsFilter === 'normal') return s >= 0 && s <= 2;
        return true;
      });
    }
    filteredPatients = [...filteredPatients].sort((a, b) => {
      if (sortBy === 'ews') return (b.ews?.score ?? -1) - (a.ews?.score ?? -1);
      if (sortBy === 'admission') return new Date(a.admittedAt || 0) - new Date(b.admittedAt || 0);
      if (sortBy === 'bed') return (a.bedNumber || '').localeCompare(b.bedNumber || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'alpha') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });
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

        {viewMode === 'active' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-text-muted font-bold uppercase tracking-wide">Sort:</span>
              {[
                { key: 'ews', label: 'Risk (EWS ↓)' },
                { key: 'admission', label: 'Admission Date' },
                { key: 'bed', label: 'Bed Number' },
                { key: 'alpha', label: 'Alphabetical' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors border ${
                    sortBy === key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-bg-tertiary text-text-secondary border-border hover:bg-bg-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="hidden sm:block h-4 w-px bg-border" />

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-text-muted font-bold uppercase tracking-wide">Filter:</span>
              {[
                { key: 'all', label: 'All', active: 'bg-primary border-primary text-white' },
                { key: 'critical', label: 'Critical (EWS ≥ 7)', active: 'bg-red-500 border-red-500 text-white' },
                { key: 'elevated', label: 'Elevated (EWS 3–6)', active: 'bg-orange-500 border-orange-500 text-white' },
                { key: 'normal', label: 'Normal (EWS 0–2)', active: 'bg-green-500 border-green-500 text-white' },
              ].map(({ key, label, active }) => (
                <button
                  key={key}
                  onClick={() => setEwsFilter(key)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors border ${
                    ewsFilter === key
                      ? active
                      : 'bg-bg-tertiary text-text-secondary border-border hover:bg-bg-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'active' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-[11px] text-text-muted">
            <span className="font-bold uppercase tracking-wide mr-1">EWS</span>
            {[
              { dot: 'bg-green-500',   label: '0–2', desc: 'Low Risk' },
              { dot: 'bg-yellow-500', label: '3–4', desc: 'Low-Medium' },
              { dot: 'bg-orange-500', label: '5–6', desc: 'Medium Risk' },
              { dot: 'bg-red-500',    label: '7–8', desc: 'High Risk' },
              { dot: 'bg-red-700',    label: '≥9',  desc: 'Urgent Review' },
            ].map(({ dot, label, desc }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <span className="font-semibold">{label}</span>
                <span className="opacity-70">{desc}</span>
              </span>
            ))}
          </div>
        )}

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
          <PatientGrid filteredPatients={filteredPatients} viewMode={viewMode} highlightCritical={ewsFilter === 'critical'} />
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
