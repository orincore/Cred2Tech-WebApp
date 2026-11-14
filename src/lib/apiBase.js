// Where the API lives. On the main app it is the build-time VITE_API_BASE_URL (a different origin, e.g.
// prod.api.cred2tech.com). On a white-label organisation's own site (acme.<base>) the API is the SAME origin
// under /api, proxied by nginx: that keeps every session on the org's host, needs no per-org CORS, and means a
// token from one org can never be sent to another org's host (docs/Whitelabel.md 8.2, 8.3).
//
// One build serves every org, so this is decided at runtime by branding/brandingStore.js (initBranding), before
// anything makes a request.
const BUILD_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

let orgMode = false;

export function setOrgMode(on) {
  orgMode = !!on;
}

/** REST base, with no trailing slash, e.g. "https://prod.api.cred2tech.com/api" or "/api". */
export function getApiBaseUrl() {
  return (orgMode ? '/api' : BUILD_BASE).replace(/\/+$/, '');
}

/** Origin for Socket.IO (the REST mount minus "/api"). */
export function getSocketOrigin() {
  if (orgMode) return window.location.origin;
  return BUILD_BASE.replace(/\/api\/?$/, '');
}
