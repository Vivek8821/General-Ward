export const queryKeys = {
  patients: (viewMode: string) => ['patients', viewMode] as const,
  patientDetail: (id: string | undefined) => ['patient', id] as const,
  patientTasks: (id: string | undefined) => ['patient', id, 'tasks'] as const,
  tasksMy: (role: string | undefined, limit = 50) => ['tasks', 'my', { role: role || 'unknown', limit }] as const,
  escalations: () => ['escalations'] as const,
  statistics: {
    summary: (period: string, filters: Record<string, string>) => ['statistics', 'summary', period, filters] as const,
    diseases: (period: string, filters: Record<string, string>) => ['statistics', 'diseases', period, filters] as const,
    demographics: (period: string, filters: Record<string, string>) => ['statistics', 'demographics', period, filters] as const,
    medications: (period: string, filters: Record<string, string>) => ['statistics', 'medications', period, filters] as const,
    admissions: (period: string, filters: Record<string, string>) => ['statistics', 'admissions', period, filters] as const,
    outcomes: (period: string, filters: Record<string, string>) => ['statistics', 'outcomes', period, filters] as const,
  },
};
