import { Outlet, Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Moon, Sun, Hospital } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export const ProtectedLayout = ({ allowedRoles }) => {
  const { user, logout, setTheme } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-8 text-center text-danger font-bold text-xl">Access Denied: Insufficient Permissions</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto p-5">
        
        {/* Header Ribbon */}
        <header className="nav-ribbon p-5 px-8 flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-tertiary text-slate-600 dark:text-slate-400"
              aria-hidden
            >
              <Hospital className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                General Ward
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">
                Clinical operations
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border bg-bg-tertiary text-slate-600 hover:bg-bg-primary hover:border-slate-400/40 dark:text-slate-400 dark:hover:border-slate-500 transition-colors"
              aria-label="Toggle color theme"
            >
              <Sun className="w-5 h-5 hidden dark:block" />
              <Moon className="w-5 h-5 dark:hidden" />
            </button>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 max-w-[120px] sm:max-w-[200px] truncate">
                {user.name}
              </span>
              <span className="rounded-md border border-border bg-bg-tertiary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {user.role}
              </span>
            </div>
            
            {user.role === 'admin' && (
              <Link
                to="/admin/audit"
                className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-400 whitespace-nowrap"
              >
                Audit log
              </Link>
            )}

            <button onClick={handleLogout} className="btn btn-secondary !py-2 !px-4 text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main>
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};
