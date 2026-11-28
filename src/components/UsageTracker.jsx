import { useEffect } from 'react';
import api from '../api/axiosInstance';
import { getApiBaseUrl } from '../lib/apiBase';
import { startUsageTracking, collectHints } from '../lib/usageTracker';

// Mounted once inside each signed-in layout (AppLayout, MsmeLayout). Renders nothing. Reports device facts and
// active seconds to the backend (see src/lib/usageTracker.js for exactly what "active" means and what is NOT collected).
// Never shows an error, never retries in a loop, never blocks anything: if the report cannot be sent, the next one
// carries the full total anyway because the counter is cumulative.
const UsageTracker = () => {
  useEffect(() => {
    let stopped = false; // a 401/403 means this login can no longer report: stop quietly
    const send = (body, { final } = {}) => {
      if (stopped) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      if (final && typeof fetch === 'function') {
        // The page may be closing: a keepalive request is allowed to outlive it (a normal one would be cancelled).
        fetch(`${getApiBaseUrl()}/usage/heartbeat`, {
          method: 'POST', keepalive: true, credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }).then((r) => { if (r.status === 401 || r.status === 403) stopped = true; }).catch(() => {});
        return;
      }
      api.post('/usage/heartbeat', body, { skipAuthRedirect: true, skipRetry: true, timeout: 10000 })
        .catch((e) => { const s = e && e.response && e.response.status; if (s === 401 || s === 403) stopped = true; });
    };
    const stop = startUsageTracking({ send, getHints: collectHints });
    return stop;
  }, []);
  return null;
};

export default UsageTracker;
