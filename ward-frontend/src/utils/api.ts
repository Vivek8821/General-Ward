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

// Guards against multiple simultaneous requests all trying to refresh at once,
// and prevents a refresh from triggering another refresh if the retry also 401s.
let _refreshInFlight = false;
let _lastRefreshAt = 0;

async function attemptSilentRefresh(): Promise<boolean> {
  if (_refreshInFlight) return false;
  // Don't hammer the refresh endpoint — if we just refreshed within 10 s, don't try again.
  if (Date.now() - _lastRefreshAt < 10_000) return false;

  _refreshInFlight = true;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    _lastRefreshAt = Date.now();
    return true;
  } catch {
    return false;
  } finally {
    _refreshInFlight = false;
  }
}

function redirectToLogin(msg: string) {
  setCsrfToken(null);
  if (window.location.pathname !== '/login') {
    toast.error(msg);
    window.location.href = '/login';
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

    if (response.status === 401) {
      // For auth endpoints themselves, never try a silent refresh — it would recurse.
      const isAuthEndpoint = endpoint.startsWith('/auth/');

      if (!isAuthEndpoint) {
        // Try to silently refresh the access token using the long-lived refresh cookie.
        // If it succeeds, replay the original request with the new CSRF token in place.
        const refreshed = await attemptSilentRefresh();
        if (refreshed) {
          return this.request(endpoint, options);
        }
        // Refresh token is also expired — the session is truly over.
        const errBody = await response.json().catch(() => ({})) as ApiErrorResponse;
        redirectToLogin(errBody?.error || errBody?.message || 'Session expired. Please log in again.');
        return;
      }

      // On /login: a 401 means bad credentials — throw so the login form shows the error.
      const errBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      const msg = errBody?.error || errBody?.message || 'Session expired';
      if (window.location.pathname !== '/login') {
        redirectToLogin(msg);
        return;
      }
      const err = new Error(msg) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    if (response.status === 403) {
      const errBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      const msg = errBody?.error || errBody?.message || 'Access denied';
      const err = new Error(msg) as Error & { status?: number };
      err.status = 403;
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
