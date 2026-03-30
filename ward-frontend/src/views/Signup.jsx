import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hospital } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Signup() {
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCode, setHospitalCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signup({
        hospitalName: hospitalName.trim(),
        hospitalCode: hospitalCode.trim(),
        employeeCode: employeeCode.trim(),
        adminName: adminName.trim(),
        email: email.trim(),
        password,
      });
      toast.success('Hospital account created successfully');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4" aria-label="Sign up">
      <div className="card p-8 sm:p-10 text-center max-w-2xl w-full animate-in fade-in slide-in-from-bottom-5 duration-500">
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
          <p className="text-text-secondary text-base pt-1">Register your hospital</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-left"
          autoComplete="on"
        >
          {error && (
            <div
              role="alert"
              className="sm:col-span-2 text-danger bg-danger/10 p-3 rounded-lg text-sm font-semibold text-center"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-hospital-name">
              Hospital name
            </label>
            <input
              id="signup-hospital-name"
              name="organization"
              type="text"
              required
              autoComplete="organization"
              className="input-field"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="e.g. City General Hospital"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-hospital-code">
              Hospital code
            </label>
            <input
              id="signup-hospital-code"
              name="hospital-code"
              type="text"
              required
              autoComplete="off"
              className="input-field"
              value={hospitalCode}
              onChange={(e) => setHospitalCode(e.target.value)}
              placeholder="e.g. CGH-001"
            />
            <p className="text-xs text-text-secondary mt-1.5">
              Unique code for your hospital — ties your subscription and data to this facility.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-name">
              Your name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="input-field"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="e.g. Dr. Jane Carter"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-employee-code">
              Employee code
            </label>
            <input
              id="signup-employee-code"
              name="employee-code"
              type="text"
              required
              autoComplete="off"
              className="input-field"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. EMP-4521"
            />
            <p className="text-xs text-text-secondary mt-1.5">
              Staff ID from your hospital — used to confirm you are a current employee (doctor, nurse, or other role).
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
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

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              name="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-primary" htmlFor="signup-confirm">
              Confirm password
            </label>
            <input
              id="signup-confirm"
              name="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 btn btn-primary w-full justify-center !py-4 text-lg mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-text-secondary text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
