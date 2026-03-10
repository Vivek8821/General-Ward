import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Moon, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SleepTab({ patientId }) {
  const [sleepLogs, setSleepLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState({
    hoursSlept: '',
    quality: 'Good',
    interrupted: false,
    nap: false,
    notes: ''
  });

  useEffect(() => {
    fetchSleepLogs();
  }, [patientId]);

  const fetchSleepLogs = async () => {
    try {
      const data = await api.get(`/patients/${patientId}/stats?type=sleep`);
      setSleepLogs(data);
    } catch (err) {
      toast.error("Failed to load sleep records: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/patients/${patientId}/stats`, {
        type: 'sleep',
        data: formData
      });
      
      setShowForm(false);
      setFormData({ hoursSlept: '', quality: 'Good', interrupted: false, nap: false, notes: '' });
      await fetchSleepLogs();
      toast.success("Sleep log saved");
    } catch (err) {
      toast.error("Failed to save sleep log: " + err.message);
    }
  };

  const renderSleepCard = (log) => {
    const d = log.data;
    const date = new Date(log.timestamp).toLocaleString();
    const poorSleep = parseFloat(d.hoursSlept) < 5 || d.quality === 'Poor';

    return (
      <div key={log.id} className="bg-bg-tertiary p-5 rounded-xl border border-border mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-secondary mb-2">{date}</div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
             <span className="text-3xl font-black text-primary">{d.hoursSlept} <span className="text-sm font-bold text-text-secondary">hrs</span></span>
             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                d.quality === 'Excellent' ? 'bg-success/20 text-success' :
                d.quality === 'Good' ? 'bg-primary/20 text-primary' :
                d.quality === 'Fair' ? 'bg-warning/20 text-warning' : 'bg-danger/20 text-danger'
             }`}>
                {d.quality} Quality
             </span>
             {d.interrupted && <span className="bg-text-muted/20 text-text-muted px-2 py-1 rounded text-xs font-bold uppercase">Interrupted</span>}
             {d.nap && <span className="bg-info/20 text-info px-2 py-1 rounded text-xs font-bold uppercase">Daytime Nap</span>}
          </div>
          {d.notes && <p className="text-sm italic text-text-muted mt-2">&quot;{d.notes}&quot;</p>}
        </div>
        
        <div className="text-right flex flex-col items-end gap-2 w-full md:w-auto">
           <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{log.recordedBy}</div>
           {poorSleep && (
              <span className="text-xs bg-danger text-white px-2 py-0.5 rounded shadow-sm flex items-center gap-1 font-bold">
                 ⚠️ Sleep Deprivation Risk
              </span>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in pt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-500"><Moon className="text-indigo-500"/> Sleep & Rest Log</h3>
        
        {(user.role === 'nurse' || user.role === 'doctor') && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary !bg-indigo-500 hover:!bg-indigo-600 !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> Log Sleep
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary p-6 rounded-xl border-2 border-indigo-400 mb-8 animate-in slide-in-from-top-4">
          <h4 className="font-bold mb-4">New Rest Entry</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Hours Slept</label>
              <input type="number" step="0.5" required min="0" max="24" className="input-field !py-2" value={formData.hoursSlept} onChange={e => setFormData({...formData, hoursSlept: e.target.value})} placeholder="7.5" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Rest Quality</label>
              <select className="input-field !py-2" value={formData.quality} onChange={e => setFormData({...formData, quality: e.target.value})}>
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
               <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={formData.interrupted} onChange={e => setFormData({...formData, interrupted: e.target.checked})} />
                  <span className="text-sm font-semibold">Sleep was interrupted</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={formData.nap} onChange={e => setFormData({...formData, nap: e.target.checked})} />
                  <span className="text-sm font-semibold">This was a daytime nap</span>
               </label>
            </div>
            
            <div className="md:col-span-2">
               <label className="block text-xs font-bold mb-1 text-text-secondary">Observations / Complaints</label>
               <input type="text" className="input-field !py-2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Woke up 3 times due to noise..." />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary !py-2 !px-4">Cancel</button>
            <button type="submit" className="btn btn-primary !bg-indigo-500 hover:!bg-indigo-600 !py-2 !px-4"><Save className="w-4 h-4"/> Save Log</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-text-muted animate-pulse">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-medium">Loading sleep history...</p>
        </div>
      ) : sleepLogs.length === 0 ? (
        <div className="text-center p-10 bg-bg-tertiary rounded-2xl border-2 border-dashed border-border text-text-muted flex flex-col items-center justify-center gap-3 mt-4">
          <Moon size={48} className="opacity-20" />
          <p className="font-semibold">No sleep records for this patient yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sleepLogs.map(renderSleepCard)}
        </div>
      )}
    </div>
  );
}
