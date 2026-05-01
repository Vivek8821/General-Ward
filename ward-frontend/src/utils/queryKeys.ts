export const queryKeys = {
  patients: (viewMode: string) => ['patients', viewMode] as const,
  patientDetail: (id: string | undefined) => ['patient', id] as const,
  patientTasks: (id: string | undefined) => ['patient', id, 'tasks'] as const,
  tasksMy: (role: string | undefined, limit = 50) => ['tasks', 'my', { role: role || 'unknown', limit }] as const,
  escalations: () => ['escalations'] as const,
};
