import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hospital } from 'lucide-react';

const DEMO_USER_KEY = 'ward_login_demo_username';
const DEMO_PASS_KEY = 'ward_login_demo_password';

function readStoredDemo() {
  try {
    const u = sessionStorage.getItem(DEMO_USER_KEY);
    const p = sessionStorage.getItem(DEMO_PASS_KEY);
    if (u != null && p != null) return { username: u, password: p };
  } catch {
    // ignore
  }
  return null;
}

function writeStoredDemo(username, password) {
  try {
    sessionStorage.setItem(DEMO_USER_KEY, username);
    sessionStorage.setItem(DEMO_PASS_KEY, password);
  } catch {
    // ignore
  }
}

function clearStoredDemo() {
  try {
    sessionStorage.removeItem(DEMO_USER_KEY);
    sessionStorage.removeItem(DEMO_PASS_KEY);
  } catch {
    // ignore
  }
}

/** Matches ward-backend/seed.js Users.name values */
const DEMO = {
  doctor: { username: 'Dr. Smith', password: '1234' },
  nurse: { username: 'Nurse Johnson', password: '5678' },
  admin: { username: 'Ward Admin', password: '9999' },
};

export default function Login() {
  const stored = readStoredDemo();
  const [username, setUsername] = useState(() => stored?.username ?? '');
  const [password, setPassword] = useState(() => stored?.password ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const applyDemo = (u, p) => {
    writeStoredDemo(u, p);
    setUsername(u);
    setPassword(p);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      clearStoredDemo();
      navigate('/');
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
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <button
              type="button"
              onClick={() => applyDemo(DEMO.doctor.username, DEMO.doctor.password)}
              className="btn bg-warning/20 text-warning hover:bg-warning/30 !py-2 !px-4 text-xs font-bold border border-warning/30"
            >
              Autofill Doctor
            </button>
            <button
              type="button"
              onClick={() => applyDemo(DEMO.nurse.username, DEMO.nurse.password)}
              className="btn bg-info/20 text-info hover:bg-info/30 !py-2 !px-4 text-xs font-bold border border-info/30"
            >
              Autofill Nurse
            </button>
            <button
              type="button"
              onClick={() => applyDemo(DEMO.admin.username, DEMO.admin.password)}
              className="btn bg-bg-tertiary text-text-secondary hover:bg-hover !py-2 !px-4 text-xs font-bold border border-border"
            >
              Autofill Admin
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center !py-4 text-lg mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
