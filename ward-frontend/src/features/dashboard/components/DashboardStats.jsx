import React from 'react';
import { Users, Bed, Activity } from 'lucide-react';
import { isPatientCritical } from '../../../utils/clinicalUtils';

export function StatCard({ title, value, icon, color = 'text-primary' }) {
  return (
    <div className="card p-6 pb-4 border-t-4 border-t-primary relative flex flex-col justify-between min-h-[132px] transition-transform hover:-translate-y-0.5">
      <div className="flex justify-between items-start gap-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
        <span className={`shrink-0 opacity-70 ${color}`} aria-hidden>
          {icon}
        </span>
      </div>
      <div className={`text-4xl font-extrabold tracking-tight ${color} leading-tight mt-2`}>{value}</div>
    </div>
  );
}

export default function DashboardStats({ patients, activePatients }) {
  const clinicallyCritical = activePatients.filter(isPatientCritical).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Total Patients" value={patients.length} icon={<Users size={24} />} />
      <StatCard title="Active Beds" value={activePatients.length} icon={<Bed size={24} />} />
      <StatCard
        title="Clinically Critical"
        value={clinicallyCritical}
        icon={<Activity size={24} />}
        color="text-danger"
      />
    </div>
  );
}
