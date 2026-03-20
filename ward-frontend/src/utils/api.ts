import toast from 'react-hot-toast';

const DEFAULT_ORIGIN = 'http://localhost:3001';

function normalizeApiBase(raw: string | undefined): string {
  let base = raw;
  if (base == null || String(base).trim() === '') {
    base = DEFAULT_ORIGIN;
  } else {
    base = String(base).trim();
  }

  base = base.replace(/\/+$/, '');
  if (base === '') base = DEFAULT_ORIGIN;

  const lower = base.toLowerCase();
  if (lower.endsWith('/api')) return base;
  return `${base}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

type JsonHeaders = Record<string, string>;

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

type ApiRequestOptions = Omit<RequestInit, 'headers' | 'body' | 'method'> & {
  method?: string;
  headers?: JsonHeaders;
  body?: string;
};

export const api = {
  getHeaders(): JsonHeaders {
    return {
      'Content-Type': 'application/json',
    };
  },

  async request(endpoint: string, options: ApiRequestOptions = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      const errBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
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
      const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      const err = new Error(error.error || 'API Request Failed') as Error & {
        status?: number;
        details?: ApiErrorResponse;
      };
      err.status = response.status;
      err.details = error;
      throw err;
    }

    return response.json().catch(() => ({}));
  },

  get(endpoint: string) {
    return this.request(endpoint);
  },

  post(endpoint: string, data: unknown) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  },

  put(endpoint: string, data: unknown) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  },

  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

