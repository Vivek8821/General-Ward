import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Skeleton = () => <div className="h-72 animate-pulse rounded-lg bg-bg-tertiary/50" />;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-primary border border-border rounded-xl shadow-xl p-3 text-sm">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary capitalize">{p.dataKey}:</span>
          <span className="font-semibold text-text-primary">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AdmissionTrendLine({ data, loading, fullHeight }) {
  if (loading) return <Skeleton />;
  if (!data?.timeline?.length) {
    return (
      <div className={`${fullHeight ? 'h-96' : 'h-64'} flex flex-col items-center justify-center text-text-secondary`}>
        <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
          <span className="text-2xl">📈</span>
        </div>
        <p className="text-sm font-medium">No trend data</p>
        <p className="text-xs mt-1">Try a different time period</p>
      </div>
    );
  }

  return (
    <div className={fullHeight ? 'h-96' : 'h-64'}>
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500/80" />
          <div>
            <div className="text-base font-bold text-text-primary tabular-nums">{data.totalAdmissions}</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Admissions</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <div>
            <div className="text-base font-bold text-text-primary tabular-nums">{data.totalDischarges}</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Discharges</div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={fullHeight ? '80%' : '75%'}>
        <AreaChart data={data.timeline}>
          <defs>
            <linearGradient id="admitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="dischGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => {
            const d = new Date(v + (v.length <= 7 ? '-01' : ''));
            return d.toLocaleDateString('en-US', v.length <= 7 ? { month: 'short' } : { month: 'short', day: 'numeric' });
          }} axisLine={false} tickLine={false} />
          <YAxis width={30} allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="admitted" name="Admissions" stroke="#3b82f6" strokeWidth={2.5} fill="url(#admitGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
          <Area type="monotone" dataKey="discharged" name="Discharges" stroke="#22c55e" strokeWidth={2.5} fill="url(#dischGrad)" dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
