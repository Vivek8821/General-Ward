import { Clock, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

const Skeleton = () => (
  <div className="grid grid-cols-2 gap-3 animate-pulse">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-20 bg-bg-tertiary rounded-xl" />
    ))}
  </div>
);

const iconMap = {
  'Avg Length of Stay': { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'Discharge Rate': { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Escalation Rate': { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  'Total Escalations': { icon: Activity, color: 'text-rose-500', bg: 'bg-rose-500/10' },
};

export default function OutcomeCards({ data, loading, compact }) {
  if (loading) return <Skeleton />;
  if (!data) return null;

  const items = [
    { label: 'Avg Length of Stay', value: `${data.avgLengthOfStay} days`, sub: 'per patient' },
    { label: 'Discharge Rate', value: `${data.dischargeRate}%`, sub: `${data.totalDischarges} of ${data.totalPatients}` },
    { label: 'Escalation Rate', value: `${data.escalationRate}%`, sub: `${data.totalEscalations} escalations` },
    { label: 'Total Escalations', value: data.totalEscalations, sub: 'clinical flags raised' },
  ];

  if (compact) {
    return (
      <div className="space-y-3">
        {items.map(item => {
          const { icon: Icon, color, bg } = iconMap[item.label] || { icon: Activity, color: 'text-text-secondary', bg: 'bg-bg-tertiary' };
          return (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className={`text-lg font-bold ${color} tabular-nums`}>{item.value}</div>
                <div className="text-xs text-text-secondary">{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" /> Clinical Outcomes
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {items.map(item => {
          const { icon: Icon, color, bg } = iconMap[item.label] || { icon: Activity, color: 'text-text-secondary', bg: 'bg-bg-tertiary' };
          return (
            <div key={item.label} className="text-center p-4 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors group">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`h-5 w-5 ${color}`} strokeWidth={2} />
              </div>
              <span className={`text-xl font-bold block ${color}`}>{item.value}</span>
              <span className="text-xs text-text-secondary">{item.label}</span>
              <span className="text-[10px] text-text-secondary/70 block mt-0.5">{item.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
