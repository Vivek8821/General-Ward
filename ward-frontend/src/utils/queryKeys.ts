export const queryKeys = {
  patients: (viewMode: string) => ['patients', viewMode] as const,
  tasksMy: (role: string | undefined, limit = 50) => ['tasks', 'my', { role: role || 'unknown', limit }] as const,
};
