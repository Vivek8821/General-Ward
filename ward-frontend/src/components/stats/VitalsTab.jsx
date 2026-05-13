import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Activity, Plus, Save } from 'lucide-react';
import { fmtDateTime, fmtChartLabel } from '../../utils/dateFormat';
import toast from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea
} from 'recharts';

export default function VitalsTab({ patientId, readOnly }) {
  const [vitals, setVitals] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [chartRange, setChartRange] = useState('7d');
  const { user } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState({
    bpSystolic: '', bpDiastolic: '', temp: '', pulse: '', spo2: '', pain: ''
  });

  useEffect(() => {
    if (!patientId) return;
    const controller = new AbortController();
    Promise.all([
      api.get(`/patients/${patientId}/stats?type=vital&limit=50`, { signal: controller.signal }),
      api.get(`/patients/${patientId}/stats/trends`, { signal: controller.signal })
    ])
      .then(([data, trendData]) => { setVitals(data); setTrends(trendData?.trends || {}); })
      .catch(err => { if (!controller.signal.aborted) toast.error("Failed to load vitals: " + err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patientId]);

  const fetchVitals = async () => {
    try {
      const [data, trendData] = await Promise.all([
        api.get(`/patients/${patientId}/stats?type=vital&limit=50`),
        api.get(`/patients/${patientId}/stats/trends`)
      ]);
      setVitals(data);
      setTrends(trendData?.trends || {});
    } catch (err) {
      toast.error("Failed to load vitals: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Basic validation
      if (!formData.bpSystolic || !formData.temp || !formData.pulse) {
        toast.error('Please fill out at least BP, Temp, and Pulse.');
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
    const date = fmtDateTime(vital.timestamp);
    
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

  const trendRows = trends || {};
  const formatDelta = (delta, decimals = 0) => {
    const v = Number(delta);
    if (!Number.isFinite(v)) return '--';
    const fixed = v.toFixed(decimals);
    return v > 0 ? `+${fixed}` : fixed;
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
          {trends && Object.keys(trendRows).length > 0 && (
            <div className="bg-bg-tertiary p-5 rounded-xl border border-border">
              <h4 className="font-bold text-text-secondary mb-3">
                Latest Trends
              </h4>
              <div className="flex flex-wrap gap-3">
                {trendRows.pulse && (
                  <TrendPill label="Pulse" unit="bpm" vitalKey="pulse" row={trendRows.pulse} decimals={0} />
                )}
                {trendRows.temp && (
                  <TrendPill label="Temp" unit="°C" vitalKey="temp" row={trendRows.temp} decimals={1} />
                )}
                {trendRows.systolic && (
                  <TrendPill label="Systolic BP" unit="mmHg" vitalKey="systolic" row={trendRows.systolic} decimals={0} />
                )}
                {trendRows.diastolic && (
                  <TrendPill label="Diastolic BP" unit="mmHg" vitalKey="diastolic" row={trendRows.diastolic} decimals={0} />
                )}
                {trendRows.spo2 && (
                  <TrendPill label="SpO₂" unit="%" vitalKey="spo2" row={trendRows.spo2} decimals={0} />
                )}
                {trendRows.respRate && (
                  <TrendPill label="Resp Rate" unit="/min" vitalKey="respRate" row={trendRows.respRate} decimals={0} />
                )}
              </div>
            </div>
          )}

          {/* Graph Timeline View */}
          {(() => {
            const rangeHours = { '24h': 24, '48h': 48, '7d': 168, 'all': Infinity };
            const cutoffMs = chartRange === 'all' ? 0 : Date.now() - rangeHours[chartRange] * 3600 * 1000;
            const chartData = [...vitals]
              .filter(v => new Date(v.timestamp).getTime() >= cutoffMs)
              .reverse()
              .map(v => ({
                time: fmtChartLabel(v.timestamp),
                temp: v.data.temp != null ? parseFloat(v.data.temp) : null,
                bpSystolic: v.data.bpSystolic != null ? parseInt(v.data.bpSystolic) : null,
                bpDiastolic: v.data.bpDiastolic != null ? parseInt(v.data.bpDiastolic) : null,
                spo2: v.data.spo2 != null ? parseFloat(v.data.spo2) : null,
                respRate: v.data.respRate != null ? parseFloat(v.data.respRate) : null,
              }));

            return (
              <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="font-bold text-text-secondary flex items-center gap-2">Recovery Trends</h4>
                  <div className="flex gap-1">
                    {[['24h', '24h'], ['48h', '48h'], ['7d', '7d'], ['All', 'all']].map(([label, val]) => (
                      <button
                        key={val}
                        onClick={() => setChartRange(val)}
                        className={`px-2.5 py-1 text-xs rounded font-semibold border transition-colors ${
                          chartRange === val
                            ? 'bg-primary text-white border-primary'
                            : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-primary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-text-muted text-sm">No vitals in this time window.</div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-text-muted)" opacity={0.2} />
                        <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickMargin={10} />

                        {/* Left axis: BP (mmHg) */}
                        <YAxis yAxisId="bp" orientation="left" stroke="var(--color-text-muted)" fontSize={11} domain={[40, 200]} tickFormatter={v => v} />
                        {/* Right axis: Temp (°C) */}
                        <YAxis yAxisId="temp" orientation="right" stroke="var(--color-text-muted)" fontSize={11} domain={[34, 42]} tickFormatter={v => `${v}°`} />
                        {/* Scale-only axes — invisible but required for correct line positioning */}
                        <YAxis yAxisId="spo2" orientation="right" domain={[85, 102]} axisLine={false} tick={false} width={0} />
                        <YAxis yAxisId="rr"   orientation="right" domain={[0,  40]}  axisLine={false} tick={false} width={0} />

                        {/* Normal range bands */}
                        <ReferenceArea yAxisId="bp" y1={90} y2={140} fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.35} label={{ value: 'Normal', position: 'insideTopLeft', fontSize: 9, fill: '#22c55e', opacity: 0.65 }} />
                        <ReferenceArea yAxisId="bp" y1={60} y2={90} fill="#3b82f6" fillOpacity={0.08} stroke="#3b82f6" strokeDasharray="4 3" strokeOpacity={0.35} label={{ value: 'Normal', position: 'insideTopLeft', fontSize: 9, fill: '#3b82f6', opacity: 0.65 }} />
                        <ReferenceArea yAxisId="temp" y1={36.1} y2={37.2} fill="#eab308" fillOpacity={0.08} stroke="#eab308" strokeDasharray="4 3" strokeOpacity={0.35} label={{ value: 'Normal', position: 'insideTopLeft', fontSize: 9, fill: '#eab308', opacity: 0.65 }} />

                        <Tooltip content={VitalsChartTooltip} />
                        <Legend wrapperStyle={{ paddingTop: '16px' }} />

                        <Line yAxisId="bp" type="monotone" dataKey="bpSystolic" name="BP Systolic" stroke="var(--color-danger)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        <Line yAxisId="bp" type="monotone" dataKey="bpDiastolic" name="BP Diastolic" stroke="var(--color-info)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        <Line yAxisId="spo2" type="monotone" dataKey="spo2" name="SpO₂ (%)" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        <Line yAxisId="rr" type="monotone" dataKey="respRate" name="Resp Rate" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

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

const VITAL_NORMAL = {
  pulse:    { min: 60,   max: 100  },
  temp:     { min: 36.1, max: 37.2 },
  systolic: { min: 90,   max: 140  },
  diastolic:{ min: 60,   max: 90   },
  spo2:     { min: 95,   max: 100  },
  respRate: { min: 12,   max: 20   },
};

function trendImproving(vitalKey, latest, direction) {
  const range = VITAL_NORMAL[vitalKey];
  if (!range || latest == null) return null;
  if (latest > range.max) return direction === 'down';
  if (latest < range.min) return direction === 'up';
  return null; // within normal — neutral
}

function TrendPill({ label, unit = '', vitalKey, row, decimals = 0 }) {
  const { latest, previous, delta, direction } = row;
  const improving = trendImproving(vitalKey, latest, direction);

  const colorClass =
    improving === true  ? 'text-green-500 border-green-500/30 bg-green-500/10'  :
    improving === false ? 'text-red-500   border-red-500/30   bg-red-500/10'    :
                          'text-text-muted border-border bg-bg-primary/30';

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const sign  = delta > 0 ? '+' : '';
  const fmt   = (v) => Number(v).toFixed(decimals);

  return (
    <div className={`text-xs px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 border ${colorClass}`}>
      <span className="uppercase tracking-widest text-[10px] opacity-80">{label}</span>
      <span className="font-black">{fmt(latest)}{unit}</span>
      <span className="font-black">{arrow} {sign}{fmt(delta)}</span>
      <span className="font-normal opacity-60 text-[10px]">from {fmt(previous)}</span>
    </div>
  );
}

function VitalsChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-bg-tertiary border border-border rounded-2xl p-3 shadow-xl">
      <div className="text-xs font-bold text-text-secondary mb-2">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-xs text-text-muted">{p.name}:</span>
            <span className="text-xs font-bold text-text-primary">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
