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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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
