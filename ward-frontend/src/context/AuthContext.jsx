/* eslint react-refresh/only-export-components: 0 */
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ward_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('ward_token')));

  const logout = () => {
    localStorage.removeItem('ward_token');
    localStorage.removeItem('ward_user');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('ward_token');
    if (token) {
      api.get('/auth/me')
        .then(data => {
          setUser(data.user);
          localStorage.setItem('ward_user', JSON.stringify(data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    localStorage.setItem('ward_token', data.token);
    localStorage.setItem('ward_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
