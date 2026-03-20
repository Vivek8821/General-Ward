import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hospital } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4">
      <div className="card p-12 text-center max-w-[420px] w-full animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-tertiary text-slate-600 dark:text-slate-400"
            aria-hidden
          >
            <Hospital className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              General Ward
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 mt-1">
              Clinical operations
            </p>
          </div>
          <p className="text-text-secondary text-base pt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {error && <div className="text-danger bg-danger/10 p-3 rounded-lg text-sm font-semibold text-center">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary">Username</label>
            <input 
              type="text" 
              required
              className="input-field"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. nurse_jane"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary">Password / PIN</label>
            <input 
              type="password" 
              required
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
             <button type="button" onClick={() => { setUsername('Dr. Smith'); setPassword('1234'); }} className="btn bg-warning/20 text-warning hover:bg-warning/30 !py-2 !px-4 text-xs font-bold border border-warning/30">
               Autofill Doctor
             </button>
             <button type="button" onClick={() => { setUsername('Nurse Johnson'); setPassword('5678'); }} className="btn bg-info/20 text-info hover:bg-info/30 !py-2 !px-4 text-xs font-bold border border-info/30">
               Autofill Nurse
             </button>
             <button type="button" onClick={() => { setUsername('Ward Admin'); setPassword('9999'); }} className="btn bg-bg-tertiary text-text-secondary hover:bg-hover !py-2 !px-4 text-xs font-bold border border-border">
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
    </div>
  );
}
