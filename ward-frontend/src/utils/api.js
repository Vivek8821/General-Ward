import toast from 'react-hot-toast';
const API_BASE = 'http://localhost:3001/api';

export const api = {
  getHeaders() {
    const token = localStorage.getItem('ward_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (response.status === 401 || response.status === 403) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error || errBody?.message || 'Access denied';
      if (window.location.pathname !== '/login') {
        toast.error(msg);
        localStorage.removeItem('ward_token');
        localStorage.removeItem('ward_user');
        window.location.href = '/login';
      } else {
        toast.error(msg);
      }
      return;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'API Request Failed');
      err.status = response.status;
      err.details = error;
      throw err;
    }

    return response.json().catch(() => ({}));
  },

  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); },
  put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};
