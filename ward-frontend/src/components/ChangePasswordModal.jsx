import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Simple length-based strength label — no arbitrary complexity rules.
  function strengthLabel(pw) {
    if (!pw) return null;
    if (pw.length < 8)  return { label: 'Too short', color: 'text-danger' };
    if (pw.length < 12) return { label: 'Fair',      color: 'text-warning' };
    if (pw.length < 16) return { label: 'Good',      color: 'text-success' };
    return               { label: 'Strong',           color: 'text-success font-bold' };
  }

  const strength = strengthLabel(next);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (next === current) {
      setError('New password must differ from your current password.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(current, next);
      toast.success('Password changed. All other sessions have been signed out.');
      onClose();
    } catch (err) {
      setError(err.message || 'Password change failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pw-title"
    >
      <div className="card w-full max-w-md p-8 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h2 id="change-pw-title" className="text-lg font-bold text-text-primary">Change Password</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="text-danger bg-danger/10 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {/* Current password */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-text-primary" htmlFor="cp-current">
              Current password
            </label>
            <div className="relative">
              <input
                id="cp-current"
                type={showCurrent ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="input-field pr-10"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors"
                onMouseDown={() => setShowCurrent(true)}
                onMouseUp={() => setShowCurrent(false)}
                onMouseLeave={() => setShowCurrent(false)}
                aria-label="Hold to peek"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-text-primary" htmlFor="cp-new">
              New password
            </label>
            <div className="relative">
              <input
                id="cp-new"
                type={showNext ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="input-field pr-10"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors"
                onMouseDown={() => setShowNext(true)}
                onMouseUp={() => setShowNext(false)}
                onMouseLeave={() => setShowNext(false)}
                aria-label="Hold to peek"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {strength && (
              <p className={`text-xs mt-1 ${strength.color}`}>
                Strength: {strength.label} ({next.length} chars)
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-text-primary" htmlFor="cp-confirm">
              Confirm new password
            </label>
            <input
              id="cp-confirm"
              type="password"
              required
              autoComplete="new-password"
              className="input-field"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>

          {/* Breach-check notice */}
          <div className="flex items-start gap-2 text-xs text-text-muted bg-bg-tertiary p-3 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              Your new password will be checked against known data breaches.
              Longer passwords are stronger — no symbols required.
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Checking…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
