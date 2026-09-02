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

// Set by AuthContext's session-liveness poll the instant it detects the
// current session was revoked/banned mid-use — once true, every 401 from
// here on is left for that flow's own SessionRevokedModal to handle instead
// of this interceptor silently redirecting out from under it. Reset back to
// false (module reload on a hard refresh, or explicitly by
// AuthContext#acknowledgeSessionRevoked once the user clicks through the
// popup) so a genuine fresh-page-load 401 still gets the plain silent
// redirect below, per "if he refreshes the page directly logout the user".
let suppressAuthRedirect = false;
export const setSuppressAuthRedirect = (value) => {
  suppressAuthRedirect = value;
};

// Response interceptor: handle 401 globally
//
// Deliberately unchanged for a *revoked* session too, not just an
// expired/invalid one: a fresh page load (including the device that just
// got revoked hitting refresh) should just land back on the login page like
// any other 401 would, not pop up a modal on top of a blank booting page.
// The *live*, no-refresh-needed "your session was just revoked" experience
// (see AuthContext's session-liveness poll + SessionRevokedModal) is handled
// separately: that poll's own request opts out via `skipAuthRedirect` so its
// very first 401 never triggers this redirect, and then flips
// `suppressAuthRedirect` above so any *other* call made while the popup is
// still up doesn't race it into a silent redirect either.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.skipAuthRedirect || suppressAuthRedirect) {
        return Promise.reject(error);
      }
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
