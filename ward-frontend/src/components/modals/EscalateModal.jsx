import { AlertTriangle } from 'lucide-react';

export default function EscalateModal({ isOpen, onClose, onSubmit, reason, setReason }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalate-dialog-title"
    >
      <div className="bg-bg-primary w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="p-6 border-b border-border bg-bg-tertiary">
          <h2 id="escalate-dialog-title" className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden />
            Escalate to doctor
          </h2>
          <p className="text-sm text-text-muted mt-1">Provide a clear reason for escalation. This will be visible to the care team.</p>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="escalate-reason" className="block text-sm font-bold mb-1 text-text-secondary">
              Reason
            </label>
            <textarea
              id="escalate-reason"
              className="input-field min-h-[100px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Clinical concern, required review, etc."
              autoFocus
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn btn-secondary !py-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger !py-2">
              Submit escalation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
