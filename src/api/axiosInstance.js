import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required for the cross-app SSO cookie (c2t_sso): the frontend origin
  // (app.cred2tech.com) and API origin (prod.api.cred2tech.com) are
  // different subdomains, so without credentials the browser silently
  // discards any Set-Cookie the backend sends back — including the one on
  // a normal MSME OTP verify, which is what's supposed to bootstrap SSO on
  // scheme.cred2tech.com in the first place. The backend's CORS already
  // allows credentials from every allow-listed origin, so this is safe
  // globally, not just on the sso-check/sso-logout calls.
  withCredentials: true,
});

// Request interceptor: attach Bearer token automatically
api.interceptors.request.use(
  (config) => {
    // Don't clobber an Authorization header a caller already set explicitly —
    // the MFA setup/challenge flow (src/api/mfaService.js) authenticates with
    // its own short-lived, non-session token instead of the stored one, since
    // the user isn't fully logged in yet at that point.
    if (config.headers.Authorization) return config;
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Transient-failure retry for GET requests only (safe to repeat — never
// mutates anything): a network error or 5xx during a brief backend blip
// (a DR failover window, a deploy, momentary infra hiccup) gets retried a
// couple of times with short backoff before the caller ever sees an error,
// so a short interruption doesn't surface as a visible failure in the UI.
// Never retries 4xx (a real client error, retrying won't help) or non-GET
// requests (retrying a POST/PUT/DELETE blind risks a duplicate side
// effect). Opt out per-request with { skipRetry: true } in the request
// config, for callers that need to fail fast instead (e.g. a request
// already wrapped in its own retry/polling loop).
const RETRY_DELAYS_MS = [500, 1500];
const isRetryableFailure = (error) => {
  if (error.config?.skipRetry) return false;
  if ((error.config?.method || 'get').toLowerCase() !== 'get') return false;
  if (!error.response) return true; // network error / timeout, no response at all
  return error.response.status >= 500;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isRetryableFailure(error)) {
      const attempt = error.config.__retryCount || 0;
      if (attempt < RETRY_DELAYS_MS.length) {
        error.config.__retryCount = attempt + 1;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        return api(error.config);
      }
    }
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear session and redirect to the login
      // page for whichever portal (DSA vs MSME direct) the session belongs to
      const isMsmeSession =
        localStorage.getItem('roleName') === 'MSME_CUSTOMER' ||
        window.location.pathname.startsWith('/msme');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('roleName');
      const loginPath = isMsmeSession ? '/msme/login' : '/login';
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
