import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Hospital, ShieldCheck, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

function strengthLabel(pw) {
  if (!pw) return null;
  if (pw.length < 8)  return { label: `Too short (${pw.length}/8)`, color: 'text-danger' };
  if (pw.length < 12) return { label: 'Fair — longer is stronger', color: 'text-warning' };
  if (pw.length < 16) return { label: 'Good', color: 'text-success' };
  return               { label: 'Strong', color: 'text-success font-bold' };
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  // Token validation state
  const [tokenState, setTokenState] = useState('checking'); // 'checking' | 'valid' | 'invalid'
  const [tokenError, setTokenError] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = strengthLabel(password);

  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      setTokenError('No reset token found. Please use the link from your email.');
      return;
    }
    api
      .get(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then(() => setTokenState('valid'))
      .catch((err) => {
        setTokenState('invalid');
        setTokenError(err.message || 'Invalid or expired reset link.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password reset successfully. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4"
      aria-label="Reset password"
    >
      <div className="card p-10 text-center max-w-[420px] w-full animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-tertiary text-slate-700 dark:text-slate-400"
            aria-hidden
          >
            <Hospital className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              General Ward
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mt-1">
              Clinical operations
            </p>
          </div>
        </div>

        {tokenState === 'checking' && (
          <p className="text-text-secondary text-sm animate-pulse">Verifying reset link…</p>
        )}

        {tokenState === 'invalid' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Link invalid or expired</h2>
            <p className="text-text-secondary text-sm">{tokenError}</p>
            <Link
              to="/forgot-password"
              className="btn btn-primary w-full justify-center !py-3 inline-flex mt-2"
            >
              Request a new link
            </Link>
          </div>
        )}

        {tokenState === 'valid' && (
          <>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Set a new password</h2>
            <p className="text-text-secondary text-sm mb-6">
              Choose a strong password. All other sessions will be signed out.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {formError && (
                <div role="alert" className="text-danger bg-danger/10 p-3 rounded-lg text-sm font-semibold text-center">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="rp-password">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="rp-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input-field pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    aria-label="Hold to show password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {strength && (
                  <p className={`text-xs mt-1 ${strength.color}`}>{strength.label}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="rp-confirm">
                  Confirm password
                </label>
                <input
                  id="rp-confirm"
                  name="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input-field"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-text-muted bg-bg-tertiary p-3 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                  Your password will be checked against known data breaches. No symbols required — length is what matters.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center !py-4 text-lg mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {tokenState !== 'invalid' && (
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mt-6 font-medium"
          >
            Back to sign in
          </Link>
        )}
      </div>
    </main>
  );
}
