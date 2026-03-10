import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Users, Bed, Activity, AlertCircle, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [escalated, setEscalated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isReviewingCases, setIsReviewingCases] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();

    // Polling setup for Doctors to receive real-time-like notifications
    let intervalId;
    if (user.role === 'doctor') {
      intervalId = setInterval(async () => {
        try {
          const eData = await api.get('/escalations/all');
          setEscalated(prev => {
            // Check if there are new escalations not in our current state
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
          
          // Refresh patient list to get any new 'escalated' status changes
          const pData = await api.get('/patients');
          setPatients(pData);
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 15000); // 15 seconds
    }

    return () => {
       if (intervalId) clearInterval(intervalId);
    };
  }, [user.role]);

  const fetchData = async () => {
    try {
      const pData = await api.get('/patients');
      setPatients(pData);
      
      if (user.role === 'doctor') {
        const eData = await api.get('/escalations/all');
        setEscalated(eData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activePatients = patients.filter(p => ['active', 'escalated'].includes(p.status));
  let filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.mrn.toLowerCase().includes(search.toLowerCase()) ||
    p.bedNumber.toLowerCase().includes(search.toLowerCase())
  );
  
  // Filter further if reviewing cases
  if (isReviewingCases) {
      filteredPatients = filteredPatients.filter(p => p.status === 'escalated');
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Escalation Alert Bar (Doctor Only) */}
      {user.role === 'doctor' && escalated.length > 0 && (
        <div className="bg-danger/10 border-l-4 border-danger p-5 rounded-r-xl flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3 text-danger font-bold text-lg">
            <AlertCircle className="w-6 h-6 animate-pulse" />
            {escalated.length} Patient{escalated.length > 1 ? 's' : ''} Require Immediate Attention
          </div>
          <button 
            onClick={() => setIsReviewingCases(!isReviewingCases)}
            className={`btn ${isReviewingCases ? 'bg-bg-tertiary text-danger border border-danger' : 'btn-danger'} text-sm !px-4 !py-2`}
          >
            {isReviewingCases ? 'View All Patients' : 'Review Cases'}
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Patients" value={patients.length} icon={<Users size={24} />} />
        <StatCard title="Active Beds" value={activePatients.length} icon={<Bed size={24} />} />
        <StatCard title="Critical Care (L4)" value={activePatients.filter(p => p.careIntensity === 4).length} icon={<Activity size={24} />} color="text-danger" />
        <StatCard title="Escalations" value={escalated.length} icon={<AlertCircle size={24} />} color="text-warning" />
      </div>

      {/* Patient List */}
      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary p-6 border-b border-border flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-bold">Patient Roster</h2>
          
          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search MRN, Name, Bed..." 
                className="input-field !pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <button className="btn btn-primary whitespace-nowrap">
              <Plus className="w-5 h-5" /> Add Patient
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-text-muted">Loading patients...</div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <Users size={48} className="opacity-20" />
            <p className="font-semibold">No patients found matching your search.</p>
          </div>
        ) : (
          <div className="p-6 bg-bg-primary grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPatients.map(patient => (
              <div 
                key={patient.id} 
                onClick={() => window.location.href = `/patient/${patient.id}`}
                className={`card p-6 cursor-pointer hover:border-primary/30 flex flex-col justify-between h-full group transition-all ${patient.status === 'escalated' ? 'border-danger/60 shadow-[0_0_15px_rgba(251,113,133,0.3)]' : ''}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-bg-tertiary px-3 py-1 rounded-lg shadow-inner border border-transparent font-black text-sm text-text-secondary">
                      Bed {patient.bedNumber}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-lg ${
                      patient.careIntensity === 4 ? 'bg-danger shadow-[inset_2px_2px_6px_rgba(255,255,255,0.4),0_4px_10px_rgba(251,113,133,0.5)]' : 
                      patient.careIntensity === 3 ? 'bg-warning shadow-[inset_2px_2px_6px_rgba(255,255,255,0.4),0_4px_10px_rgba(251,191,36,0.5)]' : 
                      patient.careIntensity === 2 ? 'bg-info shadow-[inset_2px_2px_6px_rgba(255,255,255,0.4),0_4px_10px_rgba(96,165,250,0.5)]' : 
                      'bg-success shadow-[inset_2px_2px_6px_rgba(255,255,255,0.4),0_4px_10px_rgba(74,222,128,0.5)]'
                    }`}>
                      L{patient.careIntensity}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-primary group-hover:text-primary-dark transition-colors mb-1 truncate">
                    {patient.name}
                  </h3>
                  <div className="text-sm text-text-muted font-mono mb-4">
                    MRN: {patient.mrn}
                  </div>
                  
                  <div className="bg-input rounded-xl p-4 shadow-inner min-h-[80px]">
                     <span className="text-xs uppercase font-bold text-text-muted block mb-1 tracking-wider">Primary Diagnosis</span>
                     <span className="text-sm font-semibold text-text-primary line-clamp-2">{patient.diagnosis}</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t-2 border-border/50 flex justify-between items-center">
                  <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${patient.status === 'active' ? 'bg-success/20 text-success' : patient.status === 'escalated' ? 'bg-danger text-white animate-pulse' : 'bg-text-muted/20 text-text-muted'}`}>
                    {patient.status}
                  </span>
                  <span className="text-xs font-bold text-primary group-hover:underline flex items-center gap-1">
                    View Profile &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color = 'text-primary' }) {
  return (
    <div className="card p-6 border-t-4 border-t-primary relative overflow-hidden group">
      <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity ${color} transform scale-[3]`}>
        {icon}
      </div>
      <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-3">{title}</h3>
      <div className={`text-5xl font-extrabold tracking-tighter ${color} drop-shadow-sm`}>{value}</div>
    </div>
  );
}
