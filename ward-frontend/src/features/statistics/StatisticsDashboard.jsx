import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, API_BASE, getCsrfHeaders } from '../../utils/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Calendar, Download, TrendingUp, Users,
  Activity, FileSpreadsheet, PieChart, BarChart3, LineChart, Table2, FileText
} from 'lucide-react';
import PeriodSelector from './components/PeriodSelector';
import SummaryCards from './components/SummaryCards';
import DiseasePieChart from './components/DiseasePieChart';
import DemographicsBarChart from './components/DemographicsBarChart';
import MedicationTopTable from './components/MedicationTopTable';
import AdmissionTrendLine from './components/AdmissionTrendLine';
import OutcomeCards from './components/OutcomeCards';
import FilterBar from './components/FilterBar';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'diseases', label: 'Diseases', icon: PieChart },
  { key: 'demographics', label: 'Demographics', icon: Users },
  { key: 'medications', label: 'Medications', icon: Table2 },
  { key: 'trends', label: 'Trends', icon: LineChart },
];

export default function StatisticsDashboard() {
  const [period, setPeriod] = useState('month');
  const [filters, setFilters] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  const buildParams = () => {
    const params = new URLSearchParams({ period });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    return params.toString();
  };

  const { data: summary, isLoading: sLoad } = useQuery({
    queryKey: ['statistics', 'summary', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/summary?${buildParams()}`),
    staleTime: 120_000,
  });

  const { data: diseases, isLoading: dLoad } = useQuery({
    queryKey: ['statistics', 'diseases', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/diseases?${buildParams()}`),
    staleTime: 120_000,
  });

  const { data: demographics, isLoading: dmLoad } = useQuery({
    queryKey: ['statistics', 'demographics', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/demographics?${buildParams()}`),
    staleTime: 120_000,
  });

  const { data: medications, isLoading: mLoad } = useQuery({
    queryKey: ['statistics', 'medications', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/medications?${buildParams()}`),
    staleTime: 120_000,
  });

  const { data: admissions, isLoading: aLoad } = useQuery({
    queryKey: ['statistics', 'admissions', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/admissions?${buildParams()}`),
    staleTime: 120_000,
  });

  const { data: outcomes, isLoading: oLoad } = useQuery({
    queryKey: ['statistics', 'outcomes', period, JSON.stringify(filters)],
    queryFn: () => api.get(`/statistics/outcomes?${buildParams()}`),
    staleTime: 120_000,
  });

  const exportCSV = () => {
    if (!summary) return;
    const rows = [['Metric', 'Value']];
    if (summary) {
      rows.push(['Total Patients', summary.totalPatients]);
      rows.push(['Currently Active', summary.currentlyActive]);
      rows.push(['Total Discharged', summary.totalDischarged]);
      rows.push(['Avg Length of Stay (days)', summary.avgLengthOfStay]);
      rows.push(['Total Medication Administrations', summary.totalMedicationAdministrations]);
      if (summary.topDisease) {
        rows.push(['Top Disease', summary.topDisease.category]);
        rows.push(['Top Disease Count', summary.topDisease.count]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statistics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const downloadPDF = async () => {
    try {
      const csrfHeaders = getCsrfHeaders();
      const headers = { 'Content-Type': 'application/json', ...csrfHeaders };

      const res = await fetch(`${API_BASE}/statistics/report`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ period, ...filters }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const periodLabel = period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Yearly';
      a.download = `Hospital-${periodLabel}-Statistics-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate PDF report. Please try again.');
    }
  };

  const hasActiveFilters = filters.residence || filters.gender || filters.ageMin || filters.ageMax;

  return (
    <main className="min-h-screen bg-bg-secondary/30" aria-label="Hospital Statistics">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors" aria-label="Back">
                <ArrowLeft className="h-5 w-5 text-text-secondary" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" strokeWidth={2.5} />
                  <h1 className="text-xl font-bold text-text-primary tracking-tight">Hospital Statistics</h1>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">Disease prevalence, demographics, clinical outcomes & medication analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector period={period} onChange={setPeriod} />
              <div className="h-8 w-px bg-border hidden sm:block" />
              <button onClick={downloadPDF} disabled={!summary} className="btn btn-primary text-sm flex items-center gap-2 h-9" title="Download formal PDF report">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">PDF Report</span>
              </button>
              <button onClick={exportCSV} disabled={!summary} className="btn btn-secondary text-sm flex items-center gap-2 h-9">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-3 -mb-px overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                <tab.icon className="h-4 w-4" strokeWidth={activeTab === tab.key ? 2.5 : 1.75} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <FilterBar filters={filters} onChange={setFilters} active={hasActiveFilters} />

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SummaryCards summary={summary} loading={sLoad} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-5">
                <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Admission & Discharge Trend
                </h2>
                <AdmissionTrendLine data={admissions} loading={aLoad} />
              </div>
              <div className="card p-5">
                <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Clinical Outcomes
                </h2>
                <OutcomeCards data={outcomes} loading={oLoad} compact />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diseases' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 card p-5">
                <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" /> Disease Category Distribution
                </h2>
                <DiseasePieChart data={diseases} loading={dLoad} />
              </div>
              <div className="lg:col-span-2 card p-5">
                <h2 className="text-base font-semibold text-text-primary mb-3">Top Diagnoses</h2>
                {diseases?.topDiagnoses?.length ? (
                  <div className="space-y-2">
                    {diseases.topDiagnoses.slice(0, 12).map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-sm text-text-primary truncate flex-1">{d.name}</span>
                        <span className="text-sm font-semibold text-text-primary tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm text-center py-4">No diagnosis data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'demographics' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Age & Gender Distribution
                </h2>
                <DemographicsBarChart data={demographics} loading={dmLoad} />
              </div>
              <div className="card p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Gender Split</h3>
                  {demographics?.gender?.length ? (
                    <div className="space-y-3">
                      {demographics.gender.map(g => {
                        const total = demographics.total || 1;
                        const pct = Math.round((g.count / total) * 100);
                        return (
                          <div key={g.label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-text-primary font-medium">{g.label}</span>
                              <span className="text-text-secondary">{g.count} ({pct}%)</span>
                            </div>
                            <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-text-secondary text-sm text-center py-4">No gender data</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Residence Distribution</h3>
                  {demographics?.residence?.length ? (
                    <div className="space-y-3">
                      {demographics.residence.map(r => {
                        const total = demographics.total || 1;
                        const pct = Math.round((r.count / total) * 100);
                        return (
                          <div key={r.label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-text-primary font-medium capitalize">{r.label}</span>
                              <span className="text-text-secondary">{r.count} ({pct}%)</span>
                            </div>
                            <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-text-secondary text-sm text-center py-4">No residence data</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                <Table2 className="h-4 w-4 text-primary" /> Top Medications by Administration
              </h2>
              {medications?.totalPatients > 0 && (
                <p className="text-xs text-text-secondary mb-4">
                  {medications.totalAdministrations} administrations across {medications.totalPatients} patients
                </p>
              )}
              <MedicationTopTable data={medications} loading={mLoad} />
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" /> Admissions & Discharges Over Time
              </h2>
              <AdmissionTrendLine data={admissions} loading={aLoad} fullHeight />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SummaryCards summary={summary} loading={sLoad} />
              <OutcomeCards data={outcomes} loading={oLoad} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
