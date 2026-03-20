import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedLayout } from './components/Layout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import PatientDetail from './views/PatientDetail';
import Tasks from './views/Tasks';
import AdminAudit from './views/AdminAudit';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid duplicate fetches on navigation; pilot is concerned with stability.
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patient/:id" element={<PatientDetail />} />
              <Route path="/tasks" element={<Tasks />} />
            </Route>

            <Route element={<ProtectedLayout allowedRoles={['admin']} />}>
              <Route path="/admin/audit" element={<AdminAudit />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
