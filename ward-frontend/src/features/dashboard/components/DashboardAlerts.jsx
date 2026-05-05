import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export function WelcomeBanner({ showWelcome, dismissWelcome }) {
  if (!showWelcome) return null;
  return (
    <div className="relative bg-primary/10 border border-primary/20 rounded-xl p-5 pr-12">
      <button
        type="button"
        onClick={dismissWelcome}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-primary/20 text-primary transition-colors"
        aria-label="Dismiss welcome message"
      >
        <X className="w-4 h-4" />
      </button>
      <h2 className="text-lg font-semibold text-primary">Welcome to General Ward</h2>
      <p className="text-sm text-text-secondary mt-1 max-w-2xl">
        This is your clinical operations dashboard. Use the <strong>Active Ward</strong> view to manage current patients,
        or switch to <strong>Hospital Archives</strong> for discharged records.
        Open any patient card for vitals, medications, notes, and more.
      </p>
    </div>
  );
}

export function EscalationAlert({ user, viewMode, escalated, isReviewingCases, setIsReviewingCases }) {
  if (viewMode !== 'active' || user?.role !== 'doctor' || !escalated || escalated.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 border-l-4 border-l-red-500 p-5 rounded-r-xl flex justify-between items-center gap-4">
      <div className="flex items-center gap-3 text-red-700 dark:text-red-400 font-semibold text-lg">
        <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden />
        {escalated.length} Patient{escalated.length > 1 ? 's' : ''} Require Immediate Attention
      </div>
      <button 
        onClick={() => setIsReviewingCases(!isReviewingCases)}
        className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${
          isReviewingCases 
            ? 'btn bg-bg-tertiary text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40' 
            : 'bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900'
        }`}
      >
        {isReviewingCases ? 'View All Patients' : 'Review Cases'}
      </button>
    </div>
  );
}
