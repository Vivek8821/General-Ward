import { Clock, CalendarDays, CalendarRange, Calendar } from 'lucide-react';

const PERIODS = [
  { value: 'week', label: 'Week', icon: Clock },
  { value: 'month', label: 'Month', icon: CalendarDays },
  { value: 'quarter', label: 'Quarter', icon: CalendarRange },
  { value: 'year', label: 'Year', icon: Calendar },
];

export default function PeriodSelector({ period, onChange }) {
  const getDateRange = () => {
    const now = new Date();
    const from = new Date(now);
    switch (period) {
      case 'week': from.setDate(from.getDate() - 7); break;
      case 'month': from.setMonth(from.getMonth() - 1); break;
      case 'quarter': from.setMonth(from.getMonth() - 3); break;
      case 'year': from.setFullYear(from.getFullYear() - 1); break;
    }
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(from)} – ${fmt(now)}`;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-xl p-1">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              period === p.value
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/60'
            }`}
          >
            <p.icon className="h-3.5 w-3.5" strokeWidth={period === p.value ? 2.5 : 1.75} />
            {p.label}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-text-secondary text-center">{getDateRange()}</span>
    </div>
  );
}
