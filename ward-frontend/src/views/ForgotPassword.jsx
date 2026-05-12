import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hospital, Mail, ArrowLeft } from 'lucide-react';
import { api } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim(), website: '' });
      setSubmitted(true);
    } catch (err) {
      // Rate-limit (429) is the only expected error; surface it.
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4"
      aria-label="Forgot password"
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

        {submitted ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Check your email</h2>
            <p className="text-text-secondary text-sm">
              If an account with that email exists, we sent a password reset link. It expires in 20 minutes.
            </p>
            <p className="text-text-muted text-xs">
              Didn't receive it? Check your spam folder, or{' '}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setSubmitted(false)}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Forgot your password?</h2>
            <p className="text-text-secondary text-sm mb-6">
              Enter your email and we'll send a reset link if an account exists.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {error && (
                <div role="alert" className="text-danger bg-danger/10 p-3 rounded-lg text-sm font-semibold text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="fp-email">
                  Email
                </label>
                <input
                  id="fp-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@hospital.org"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center !py-4 text-lg mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mt-6 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
