import { Users, BedDouble, LogOut, Clock, Stethoscope, Pill } from 'lucide-react';

const Skeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="card p-4 animate-pulse">
        <div className="h-8 w-12 bg-bg-tertiary rounded mb-2" />
        <div className="h-3 w-20 bg-bg-tertiary rounded" />
      </div>
    ))}
  </div>
);

const cards = [
  { key: 'totalPatients', label: 'Total Patients', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'currentlyActive', label: 'Active', icon: BedDouble, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'totalDischarged', label: 'Discharged', icon: LogOut, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { key: 'avgLengthOfStay', label: 'Avg Stay', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', suffix: 'd' },
  { key: 'totalMedicationAdministrations', label: 'Med Admins', icon: Pill, color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

export default function SummaryCards({ summary, loading }) {
  if (loading) return <Skeleton />;
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(card => (
        <div
          key={card.key}
          className="card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default group"
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`h-4.5 w-4.5 ${card.color}`} strokeWidth={2} />
            </div>
            {card.key === 'totalPatients' && summary.topDisease && (
              <span className="text-xs text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded">
                #{1}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className={`text-2xl font-bold ${card.color} tabular-nums`}>
                {summary[card.key]}
              </span>
              {card.suffix && <span className="text-sm text-text-secondary">{card.suffix}</span>}
            </div>
            <span className="text-xs text-text-secondary block mt-0.5">{card.label}</span>
          </div>
        </div>
      ))}
      <div className="card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default group">
        <div className="flex items-start justify-between mb-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Stethoscope className="h-4.5 w-4.5 text-cyan-500" strokeWidth={2} />
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary truncate" title={summary.topDisease?.category}>
            {summary.topDisease?.category || '—'}
          </div>
          <span className="text-xs text-text-secondary">Top Disease ({summary.topDisease?.count || 0})</span>
        </div>
      </div>
    </div>
  );
}
