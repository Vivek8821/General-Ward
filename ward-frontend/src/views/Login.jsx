import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hospital, Eye, EyeOff } from 'lucide-react';

/** Default username hint for dev — password must always be typed manually. */
const DEFAULT_LOGIN = import.meta.env.DEV
  ? { username: 'Dr. Smith', password: '' }
  : { username: '', password: '' };

export default function Login() {
  const [username, setUsername] = useState(DEFAULT_LOGIN.username);
  const [password, setPassword] = useState(DEFAULT_LOGIN.password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(username, password);
      navigate(data?.user?.role === 'pharmacist' ? '/pharmacy' : '/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4" aria-label="Sign in">
      <div className="card p-12 text-center max-w-[420px] w-full animate-in fade-in slide-in-from-bottom-5 duration-500">
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
          <p className="text-text-secondary text-base pt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-left" autoComplete="on">
          {error && (
            <div role="alert" className="text-danger bg-danger/10 p-3 rounded-lg text-sm font-semibold text-center">{error}</div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Dr. Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="login-password">
              Password / PIN
            </label>
            <div className="relative group">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="input-field pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors cursor-pointer select-none"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                onTouchStart={() => setShowPassword(true)}
                onTouchEnd={() => setShowPassword(false)}
                aria-label="Hold to show password"
                title="Hold to peek"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs text-text-secondary hover:text-primary font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center !py-4 text-lg mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="text-text-secondary text-sm mt-6">
          New hospital?{' '}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
