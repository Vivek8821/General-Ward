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

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('history');

  useEffect(() => {
    fetchPatient();
  }, [id]);

  const fetchPatient = async () => {
    try {
      const data = await api.get(`/patients/${id}`);
      setPatient(data);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  if (!patient) return <div className="p-10 text-center">Loading patient data...</div>;

  const handleEscalate = async () => {
    const reason = prompt("Enter reason for escalation to Doctor:");
    if (!reason) return;
    try {
      await api.post(`/patients/${id}/escalations`, { reason });
      alert("Case escalated successfully. Doctors have been notified.");
    } catch (err) {
      alert("Failed to escalate: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button onClick={() => navigate('/')} className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2">
        &larr; Back to Dashboard
      </button>

      {/* Patient Header Block */}
      <div className="card p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 pb-6 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-4">
              {patient.name}
              <span className={`text-sm font-bold uppercase px-3 py-1 rounded-full text-white ${
                patient.careIntensity === 4 ? 'bg-danger' : 
                patient.careIntensity === 3 ? 'bg-warning' : 
                patient.careIntensity === 2 ? 'bg-info' : 'bg-success'
              }`}>
                Intensity L{patient.careIntensity}
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
            <button className="btn btn-secondary !py-2 w-full md:w-auto">Edit Info</button>
            {user.role === 'nurse' && (
              <button onClick={handleEscalate} className="btn btn-danger !py-2 w-full md:w-auto flex justify-center">
                <AlertTriangle className="w-4 h-4" /> Escalate Case
              </button>
            )}
            {user.role === 'doctor' && patient.status !== 'discharged' && (
              <button className="btn btn-warning !py-2 w-full md:w-auto">Discharge</button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b-2 border-border mb-6">
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<FileText size={18}/>}>Profile & History</TabButton>
          <TabButton active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} icon={<Activity size={18}/>}>Vitals & Symptoms</TabButton>
          <TabButton active={activeTab === 'diet'} onClick={() => setActiveTab('diet')} icon={<Apple size={18}/>}>Diet & Nutrition</TabButton>
          <TabButton active={activeTab === 'sleep'} onClick={() => setActiveTab('sleep')} icon={<Moon size={18}/>}>Sleep Log</TabButton>
          <TabButton active={activeTab === 'meds'} onClick={() => setActiveTab('meds')} icon={<ClipboardList size={18}/>}>Medications</TabButton>
        </div>

        {/* Tab Contents */}
        <div className="min-h-[300px]">
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
