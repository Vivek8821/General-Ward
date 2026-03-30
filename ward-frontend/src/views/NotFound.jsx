import { Link } from 'react-router-dom';
import { Hospital, Home, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-tertiary p-4">
      <main
        className="card p-10 sm:p-12 text-center max-w-[420px] w-full animate-in fade-in slide-in-from-bottom-5 duration-500"
        role="main"
        aria-labelledby="not-found-title"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-tertiary text-slate-700 dark:text-slate-400"
            aria-hidden
          >
            <Hospital className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h1 id="not-found-title" className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Page not found
          </h1>
          <p className="text-text-secondary text-sm max-w-[320px]">
            This URL does not match any page in General Ward. Check the address or go back using the links below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user ? (
            <Link
              to="/"
              className="btn btn-primary justify-center !py-3 inline-flex items-center gap-2"
            >
              <Home className="w-4 h-4" aria-hidden />
              Back to dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary justify-center !py-3 inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" aria-hidden />
              Sign in
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
