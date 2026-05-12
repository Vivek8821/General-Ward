/* eslint react-refresh/only-export-components: 0 */
import { createContext, useContext, useState, useEffect } from 'react';
import { api, setCsrfToken } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ward_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', initial === 'dark');
      }
      return initial;
    } catch {
      return 'light';
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ward_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    // Await so the server increments tokenVersion + deletes the refresh token
    // before we clear local state. On failure we still clear locally — the
    // access token expires in 15 min and the orphaned refresh token in 30 days.
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore — local state is cleared regardless
    }
    sessionStorage.removeItem('ward_user');
    setCsrfToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    const data = await api.put('/auth/change-password', { currentPassword, newPassword });
    // Server issues fresh tokens and returns updated CSRF — sync local state
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    if (data?.user) {
      setUser(data.user);
      sessionStorage.setItem('ward_user', JSON.stringify(data.user));
    }
    return data;
  };

  // Revokes all active sessions on every other device. The current session receives
  // fresh tokens and stays signed in. Other devices get 401 on next request.
  const logoutAll = async () => {
    const data = await api.post('/auth/logout-all', {});
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    if (data?.user) {
      setUser(data.user);
      sessionStorage.setItem('ward_user', JSON.stringify(data.user));
    }
    return data;
  };

  useEffect(() => {
    // Apply theme globally so both protected routes and login inherit it.
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('ward_theme', theme);
    } catch {
      // ignore storage failures (e.g. private mode)
    }
  }, [theme]);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password, website: '' });
    if (!data?.user) {
      throw new Error('Login failed');
    }
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    sessionStorage.setItem('ward_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.post('/auth/signup', {
      ...payload,
      orgName: payload.hospitalName,
      website: '',
    });
    if (!data?.user) {
      throw new Error('Signup failed');
    }
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    sessionStorage.setItem('ward_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  // Bootstrap user from cookie-auth on initial load.
  useEffect(() => {
    // Avoid noisy auth failures / redirects on public pages.
    if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          sessionStorage.setItem('ward_user', JSON.stringify(data.user));
          if (data?.csrfToken) setCsrfToken(data.csrfToken);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        sessionStorage.removeItem('ward_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, logoutAll, changePassword, loading, theme, setTheme }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
