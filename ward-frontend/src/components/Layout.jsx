import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Moon, Sun } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export const ProtectedLayout = ({ allowedRoles }) => {
  const { user, logout } = useAuth();
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
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto p-5">
        
        {/* Header Ribbon */}
        <header className="nav-ribbon p-5 px-8 flex justify-between items-center mb-8 sticky top-5 z-50">
          <h1 className="text-primary text-2xl font-bold flex items-center gap-2">
            🏥 General Ward
          </h1>
          
          <div className="flex items-center gap-5">
            <button onClick={toggleTheme} className="p-2 bg-bg-tertiary border-2 border-border rounded-full hover:border-primary transition-all group">
              <Sun className="w-5 h-5 hidden dark:block text-text-primary group-hover:text-primary" />
              <Moon className="w-5 h-5 dark:hidden text-text-primary group-hover:text-primary" />
            </button>
            
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-text-primary">{user.name}</span>
              <span className="bg-primary text-white px-3 py-1 rounded-full text-xs uppercase tracking-wide">
                {user.role}
              </span>
            </div>
            
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
