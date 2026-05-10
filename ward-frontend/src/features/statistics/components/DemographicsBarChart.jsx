import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AGE_ORDER = ['0-12', '13-18', '19-35', '36-50', '51-65', '66+'];
const AGE_COLORS = ['#a78bfa', '#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];

const Skeleton = () => <div className="h-72 animate-pulse rounded-lg bg-bg-tertiary/50" />;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-primary border border-border rounded-xl shadow-xl p-3 text-sm">
      <p className="font-semibold text-text-primary mb-1">Age {label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary capitalize">{p.dataKey}:</span>
          <span className="font-semibold text-text-primary">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DemographicsBarChart({ data, loading }) {
  if (loading) return <Skeleton />;
  if (!data?.ageGroups?.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-text-secondary">
        <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
          <span className="text-2xl">👥</span>
        </div>
        <p className="text-sm font-medium">No demographic data</p>
        <p className="text-xs mt-1">Try a different time period or remove filters</p>
      </div>
    );
  }

  const chartData = [...data.ageGroups].sort((a, b) => AGE_ORDER.indexOf(a.group) - AGE_ORDER.indexOf(b.group));

  const tickFormatter = (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;

  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={chartData} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis width={35} tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-tertiary, #f3f4f6)', opacity: 0.5 }} />
          <Bar dataKey="male" name="Male" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {chartData.map((_, i) => <Cell key={`m${i}`} fill="#3b82f6" fillOpacity={0.85} />)}
          </Bar>
          <Bar dataKey="female" name="Female" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {chartData.map((_, i) => <Cell key={`f${i}`} fill="#ec4899" fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
