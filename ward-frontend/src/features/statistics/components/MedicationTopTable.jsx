import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pill } from 'lucide-react';

const Skeleton = () => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-10 bg-bg-tertiary rounded" />
    ))}
  </div>
);

export default function MedicationTopTable({ data, loading }) {
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  if (loading) return <Skeleton />;
  if (!data?.medications?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-text-secondary">
        <Pill className="h-10 w-10 mb-2 opacity-30" />
        <p className="text-sm font-medium">No medication data</p>
        <p className="text-xs mt-1">No administrations recorded for this period</p>
      </div>
    );
  }

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...data.medications].sort((a, b) => {
    const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortDir === 'asc' ? diff : -diff;
  });

  const maxTotal = sorted[0]?.total || 1;

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-text-secondary opacity-50 group-hover:opacity-100" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const thClass = "py-2.5 text-xs font-semibold text-text-secondary group cursor-pointer select-none transition-colors hover:text-text-primary";
  const colConfigs = [
    { key: 'name', label: 'Medication', align: 'left' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'given', label: 'Given', align: 'right' },
    { key: 'refused', label: 'Refused', align: 'right' },
    { key: 'missed', label: 'Missed', align: 'right' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border">
            {colConfigs.map(c => (
              <th key={c.key} className={`${thClass} ${c.align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => toggle(c.key)}>
                <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                  {c.label}
                  <SortIcon column={c.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => (
            <tr key={m.name} className="border-b border-border/50 hover:bg-bg-tertiary/30 transition-colors">
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-medium text-text-primary truncate max-w-[180px]">{m.name}</span>
                </div>
              </td>
              <td className="py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-16 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.round((m.total / maxTotal) * 100)}%` }} />
                  </div>
                  <span className="font-semibold text-text-primary tabular-nums w-8 text-right">{m.total}</span>
                </div>
              </td>
              <td className="py-2.5 text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 tabular-nums">{m.given}</span>
              </td>
              <td className="py-2.5 text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 tabular-nums">{m.refused}</span>
              </td>
              <td className="py-2.5 text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 tabular-nums">{m.missed}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
