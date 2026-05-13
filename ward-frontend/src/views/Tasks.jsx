import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { fmtDateTime } from '../utils/dateFormat';
import { useAuth } from '../context/AuthContext';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, ListTodo } from 'lucide-react';

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: tasks = [],
    isLoading,
    isError,
    error,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: queryKeys.tasksMy(user?.role, 50),
    queryFn: async () => {
      const data = await api.get('/tasks/my?limit=50');
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 15 * 1000,
    // Keep list stable across navigation; use explicit refetch after writes.
    refetchOnMount: false,
  });

  // Keep the previous UX of surfacing fetch failures via toast, but render
  // an inline fallback as well.
  useEffect(() => {
    if (isError && error?.message) {
      toast.error('Failed to load tasks: ' + error.message);
    }
  }, [isError, error]);

  const handleComplete = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}/complete`, {});
      toast.success('Task marked completed.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasksMy(user?.role, 50) });
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete task: ' + (err.message || 'unknown error'));
    }
  };

  const canManageTasks = ['doctor', 'nurse', 'admin'].includes(user?.role);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary flex items-center gap-3">
            <ListTodo className="w-6 h-6" /> My Tasks
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Open tasks assigned to <span className="font-bold">{user?.name}</span>.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-text-muted">Loading tasks...</div>
      ) : isError ? (
        <div className="p-10 text-center space-y-3">
          <p className="text-danger font-semibold">Failed to load tasks.</p>
          <button
            type="button"
            onClick={() => refetchTasks()}
            className="btn btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Clock className="w-10 h-10 opacity-20" />
          <p className="font-semibold">No open tasks right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => {
            const dueDate = t.dueAt ? new Date(t.dueAt) : null;
            const dueLabel = dueDate && !Number.isNaN(dueDate.getTime())
              ? fmtDateTime(dueDate)
              : '—';

            return (
              <div
                key={t.id}
                className="card p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-bg-tertiary border border-border">
                      <Clock className="w-5 h-5 text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-lg truncate">
                        {t.type} task
                      </div>
                      <div className="text-sm text-text-muted truncate">
                        Patient: {t.patientName} (Bed {t.bedNumber})
                      </div>
                    </div>
                  </div>

                  {t.notes && (
                    <div className="mt-3 text-sm text-text-primary/90 whitespace-pre-wrap">
                      {t.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between sm:flex-col sm:items-end gap-3">
                  <div className="text-xs uppercase tracking-widest font-bold text-text-muted">
                    Due: {dueLabel}
                  </div>
                  {canManageTasks && (
                    <button
                      onClick={() => handleComplete(t.id)}
                      className="btn btn-success !py-2 !px-4 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

