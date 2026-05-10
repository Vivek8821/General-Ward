import { Outlet, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Moon, Sun, Hospital, Package, Users, ClipboardList, ShieldCheck, Archive, BarChart3 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export const ProtectedLayout = ({ allowedRoles }) => {
  const { user, logout, setTheme, theme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to} className={`nav-link ${isActive ? 'nav-link-active' : ''}`}>
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      {/* Sidebar Navigation */}
      <aside className="sidebar shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Hospital className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">General Ward</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Clinical Ops</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {user.role !== 'pharmacist' && (
            <>
              <NavItem to="/" icon={Users} label="Patients" />
              <NavItem to="/archives" icon={Archive} label="Archives" />
              <NavItem to="/tasks" icon={ClipboardList} label="Tasks" />
            </>
          )}
          {(user.role === 'doctor' || user.role === 'admin') && (
            <NavItem to="/statistics" icon={BarChart3} label="Statistics" />
          )}
          {(user.role === 'pharmacist' || user.role === 'admin') && (
            <NavItem to="/pharmacy" icon={Package} label="Pharmacy" />
          )}
          {user.role === 'admin' && (
            <NavItem to="/admin/audit" icon={ShieldCheck} label="Audit Log" />
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-6 pt-6 border-t border-border">
          <div className="flex flex-col gap-1 px-1">
            <div className="text-sm font-bold truncate text-text-primary">{user.name}</div>
            <div className="text-[10px] uppercase font-black tracking-widest text-text-muted">{user.role}</div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="nav-link w-full border border-transparent"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            
            <button 
              onClick={handleLogout} 
              className="nav-link w-full text-danger hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto p-8 w-full">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
};
