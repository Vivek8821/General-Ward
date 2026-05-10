import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { useState } from 'react';

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

const Skeleton = () => <div className="h-80 animate-pulse rounded-lg bg-bg-tertiary/50" />;

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-bg-primary border border-border rounded-xl shadow-xl p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
        <span className="font-semibold text-text-primary">{d.category}</span>
      </div>
      <div className="text-text-secondary">
        <span className="font-bold text-text-primary">{d.count}</span> patients
        <span className="mx-1">·</span>
        <span>{d.percentage}%</span>
      </div>
    </div>
  );
};

export default function DiseasePieChart({ data, loading }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (loading) return <Skeleton />;
  if (!data?.categories?.length) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-text-secondary">
        <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-sm font-medium">No disease data</p>
        <p className="text-xs mt-1">Try a different time period or remove filters</p>
      </div>
    );
  }

  const top10 = data.categories.slice(0, 10);
  const other = data.categories.slice(10).reduce((s, c) => s + c.count, 0);
  const chartData = (other > 0 ? [...top10, { category: 'Other', count: other, percentage: Math.round((other / data.total) * 100) }] : top10)
    .map((c, idx) => ({ ...c, fill: COLORS[idx % COLORS.length] || '#94a3b8' }));

  return (
    <div className="h-80">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={110}
            paddingAngle={2}
            activeIndex={activeIndex}
            onMouseEnter={(_, i) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            activeShape={(props) => <Sector {...props} outerRadius={props.outerRadius + 6} />}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} opacity={activeIndex === null || activeIndex === i ? 1 : 0.5} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-2">
        {chartData.slice(0, 8).map(c => (
          <div key={c.category} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
            <span className="text-text-secondary">{c.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
