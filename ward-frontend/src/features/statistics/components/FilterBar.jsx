import { Filter, X, MapPin, User, Hash } from 'lucide-react';

export default function FilterBar({ filters, onChange, active }) {
  const update = (key, value) => {
    const next = { ...filters };
    if (value === '' || value == null) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const baseSelectClass = "appearance-none bg-bg-secondary border border-border rounded-lg pl-8 pr-7 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer";
  const baseInputClass = "bg-bg-secondary border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary w-24 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

  const chips = [];
  if (filters.residence) chips.push({ key: 'residence', label: filters.residence, icon: MapPin });
  if (filters.gender) chips.push({ key: 'gender', label: filters.gender, icon: User });
  if (filters.ageMin) chips.push({ key: 'ageMin', label: `≥${filters.ageMin}y`, icon: Hash });
  if (filters.ageMax) chips.push({ key: 'ageMax', label: `≤${filters.ageMax}y`, icon: Hash });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Filter className="h-4 w-4" strokeWidth={1.75} />
        <span className="font-medium hidden sm:inline">Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
          <select value={filters.residence || ''} onChange={e => update('residence', e.target.value)} className={baseSelectClass}>
            <option value="">All Residences</option>
            <option value="rural">Rural</option>
            <option value="suburban">Suburban</option>
            <option value="urban">Urban</option>
          </select>
        </div>

        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
          <select value={filters.gender || ''} onChange={e => update('gender', e.target.value)} className={baseSelectClass}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div className="relative">
          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
          <input type="number" placeholder="Min age" className={baseInputClass} value={filters.ageMin || ''} onChange={e => update('ageMin', e.target.value)} min="0" max="120" />
        </div>

        <span className="text-text-secondary text-sm hidden sm:inline">–</span>

        <input type="number" placeholder="Max age" className={baseInputClass} value={filters.ageMax || ''} onChange={e => update('ageMax', e.target.value)} min="0" max="120" />

        {active && (
          <button onClick={() => onChange({})} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {chips.map(c => (
            <span key={c.key} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
              <c.icon className="h-3 w-3" />
              <span className="capitalize">{c.label}</span>
              <button onClick={() => update(c.key, '')} className="ml-0.5 hover:text-primary/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="text-xs text-text-secondary self-center ml-1">
            {active ? 'filtered' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
