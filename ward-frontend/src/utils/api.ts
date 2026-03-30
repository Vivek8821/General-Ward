import toast from 'react-hot-toast';

const CSRF_STORAGE_KEY = 'ward_csrf_token';

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

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

type JsonHeaders = Record<string, string>;

export function getCsrfHeaders(): JsonHeaders {
  try {
    const csrf = sessionStorage.getItem(CSRF_STORAGE_KEY);
    if (csrf) return { 'X-CSRF-Token': csrf };
  } catch {
    // ignore
  }
  return {};
}

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

type ApiRequestOptions = Omit<RequestInit, 'headers' | 'body' | 'method'> & {
  method?: string;
  headers?: JsonHeaders;
  body?: string;
};

export function setCsrfToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    else sessionStorage.removeItem(CSRF_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const api = {
  getHeaders(): JsonHeaders {
    return {
      'Content-Type': 'application/json',
    };
  },

  async request(endpoint: string, options: ApiRequestOptions = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const csrfHeaders: JsonHeaders = {};
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      try {
        const csrf = sessionStorage.getItem(CSRF_STORAGE_KEY);
        if (csrf) csrfHeaders['X-CSRF-Token'] = csrf;
      } catch {
        // ignore
      }
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...csrfHeaders,
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
        setCsrfToken(null);
        window.location.href = '/login';
        return;
      }

      // On /login, failed POST /auth/login returns 401 — must throw so callers get an Error, not `undefined`.
      // (We do not toast here; Login.jsx shows the message from the caught error.)
      const err = new Error(msg) as Error & { status?: number };
      err.status = response.status;
      throw err;
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

