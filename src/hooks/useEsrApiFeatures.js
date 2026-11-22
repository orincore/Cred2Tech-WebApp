import { useCallback, useEffect, useState } from 'react';
import { esrApiPortal } from '../api/esrApiService';

/**
 * The ESR API dashboard decides what to show from the server's FEATURE FLAGS, never from the billing plan, role or account status itself.
 * `flag('billing.top_up')` is true when the server says that thing is available to this user right now. Unknown flags are false, so a section
 * the server does not know about can never appear. Flag names are a contract with the server: they are added, never renamed.
 */
export default function useEsrApiFeatures({ enabled = true } = {}) {
  const [state, setState] = useState({ features: {}, billingMode: null, loading: enabled, error: null });

  const load = useCallback(async () => {
    if (!enabled) return;                               // e.g. the sidebar, for a user who is not an API client: no request at all
    try {
      const r = await esrApiPortal.features();
      setState({ features: r.features || {}, billingMode: r.billing_mode || null, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.response?.data?.error || 'Could not load your account.' }));
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const flag = useCallback((name) => state.features[name] === true, [state.features]);
  return { ...state, flag, reload: load };
}
