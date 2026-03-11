import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Activity, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function VitalsTab({ patientId }) {
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState({
    bpSystolic: '', bpDiastolic: '', temp: '', pulse: '', spo2: '', pain: ''
  });

  useEffect(() => {
    fetchVitals();
  }, [patientId]);

  const fetchVitals = async () => {
    try {
      const data = await api.get(`/patients/${patientId}/stats?type=vital`);
      setVitals(data);
    } catch (err) {
      toast.error("Failed to load vitals: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Basic validation
      if (!formData.bpSystolic || !formData.temp || !formData.pulse) {
         alert("Please fill out at least BP, Temp, and Pulse.");
         return;
      }

      await api.post(`/patients/${patientId}/stats`, {
        type: 'vital',
        data: formData
      });
      
      setShowForm(false);
      setFormData({ bpSystolic: '', bpDiastolic: '', temp: '', pulse: '', spo2: '', pain: '' });
      await fetchVitals();
      toast.success("Vitals recorded successfully");
    } catch (err) {
      toast.error("Failed to save vitals: " + err.message);
    }
  };

  const renderVitalCard = (vital) => {
    const d = vital.data;
    const date = new Date(vital.timestamp).toLocaleString();
    
    // Simple logic for warning colors
    const isHighTemp = parseFloat(d.temp) > 100.4;
    const isLowSpo2 = parseFloat(d.spo2) < 92;
    const isHighPain = parseInt(d.pain) > 7;

    return (
      <div key={vital.id} className="bg-bg-tertiary p-5 rounded-xl border border-border mb-4">
        <div className="flex justify-between items-start mb-3 border-b border-border pb-2">
          <div className="text-sm font-semibold text-text-secondary">{date}</div>
          <div className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">Recorded by: {vital.recordedBy}</div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          <div>
            <span className="block text-xs text-text-muted uppercase font-bold">Blood Pressure</span>
            <span className="text-lg font-semibold">{d.bpSystolic}/{d.bpDiastolic} <span className="text-xs text-text-muted">mmHg</span></span>
          </div>
          <div>
            <span className="block text-xs text-text-muted uppercase font-bold">Temperature</span>
            <span className={`text-lg font-semibold ${isHighTemp ? 'text-danger' : ''}`}>{d.temp}° <span className="text-xs text-text-muted">F</span></span>
          </div>
          <div>
            <span className="block text-xs text-text-muted uppercase font-bold">Heart Rate</span>
            <span className="text-lg font-semibold">{d.pulse} <span className="text-xs text-text-muted">bpm</span></span>
          </div>
          <div>
            <span className="block text-xs text-text-muted uppercase font-bold">Blood Oxygen</span>
            <span className={`text-lg font-semibold ${isLowSpo2 ? 'text-warning' : ''}`}>{d.spo2}%</span>
          </div>
          <div className="col-span-2 md:col-span-4 mt-2">
            <span className="block text-xs text-text-muted uppercase font-bold">Pain Level (0-10)</span>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black ${isHighPain ? 'text-danger' : 'text-primary'}`}>{d.pain || '0'}</span>
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div 
                  className={`h-full ${isHighPain ? 'bg-danger' : 'bg-primary'}`} 
                  style={{ width: `${(parseInt(d.pain || 0) / 10) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in pt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2"><Activity className="text-primary"/> Vitals History</h3>
        
        {(user.role === 'nurse' || user.role === 'doctor') && !showForm && !readOnly && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> Log Vitals
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary p-6 rounded-xl border-2 border-primary mb-8 animate-in slide-in-from-top-4">
          <h4 className="font-bold mb-4">New Vitals Entry</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">BP Systolic</label>
              <input type="number" required className="input-field !py-2" value={formData.bpSystolic} onChange={e => setFormData({...formData, bpSystolic: e.target.value})} placeholder="120" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">BP Diastolic</label>
              <input type="number" required className="input-field !py-2" value={formData.bpDiastolic} onChange={e => setFormData({...formData, bpDiastolic: e.target.value})} placeholder="80" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Temp (°F)</label>
              <input type="number" step="0.1" required className="input-field !py-2" value={formData.temp} onChange={e => setFormData({...formData, temp: e.target.value})} placeholder="98.6" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Heart Rate (bpm)</label>
              <input type="number" required className="input-field !py-2" value={formData.pulse} onChange={e => setFormData({...formData, pulse: e.target.value})} placeholder="75" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">SpO2 (%)</label>
              <input type="number" className="input-field !py-2" value={formData.spo2} onChange={e => setFormData({...formData, spo2: e.target.value})} placeholder="98" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Pain Level (0-10)</label>
              <input type="number" min="0" max="10" className="input-field !py-2" value={formData.pain} onChange={e => setFormData({...formData, pain: e.target.value})} placeholder="0" />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary !py-2 !px-4">Cancel</button>
            <button type="submit" className="btn btn-success !py-2 !px-4 hover:bg-green-600"><Save className="w-4 h-4"/> Save Entry</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-text-muted animate-pulse">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-medium">Loading vitals history...</p>
        </div>
      ) : vitals.length === 0 ? (
        <div className="text-center p-10 bg-bg-tertiary rounded-2xl border-2 border-dashed border-border text-text-muted flex flex-col items-center justify-center gap-3">
          <Activity size={48} className="opacity-20" />
          <p className="font-semibold">No vitals recorded for this patient yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Graph Timeline View */}
          <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
            <h4 className="font-bold text-text-secondary mb-6 flex items-center gap-2">
               Recovery Trends
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...vitals].reverse().map(v => ({
                      time: new Date(v.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }),
                      temp: parseFloat(v.data.temp),
                      bpSystolic: parseInt(v.data.bpSystolic),
                      bpDiastolic: parseInt(v.data.bpDiastolic)
                  }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} domain={['dataMin - 10', 'dataMax + 10']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="bpSystolic" name="BP Systolic" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="bpDiastolic" name="BP Diastolic" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="temp" name="Temp (°F)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* List View */}
          <div className="space-y-4 pt-4 border-t border-border">
             <h4 className="font-bold text-text-secondary mb-2 flex items-center gap-2">
               Detailed Logs
            </h4>
            {vitals.map(renderVitalCard)}
          </div>
        </div>
      )}
    </div>
  );
}
