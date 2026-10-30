import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../api/storageService';

// Whether the account's storage is full, so the paid-pull screens (GST, ITR, bank
// statements, bureau) can stop before the user hits an API that would be refused.
// The server enforces the same rule in wallet.service#executePaidApi; this is only
// the friendly early warning, so a failed lookup never blocks anything.

const DSA_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];
const TTL_MS = 30 * 1000;
export const STORAGE_CHANGED_EVENT = 'storage-changed';

// One request shared by every form on screen, refreshed at most every TTL_MS.
let cache = null; // { at, status }
let inflight = null;

async function fetchStatus(force) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.status;
  if (!inflight) {
    inflight = storageService.status()
      .then((status) => { cache = { at: Date.now(), status }; return status; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Call after anything that changes usage or the plan (delete, upgrade) so every banner refreshes. */
export function notifyStorageChanged() {
  cache = null;
  window.dispatchEvent(new Event(STORAGE_CHANGED_EVENT));
}

export default function useStorageGate() {
  const { hasRole } = useAuth();
  const isDsa = hasRole(DSA_ROLES);
  const [status, setStatus] = useState(cache?.status || null);

  const load = useCallback(async (force = false) => {
    if (!isDsa) return;
    try { setStatus(await fetchStatus(force)); } catch { /* unknown = not blocked; the server still enforces */ }
  }, [isDsa]);

  useEffect(() => {
    load();
    const onChange = () => load(true);
    window.addEventListener(STORAGE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(STORAGE_CHANGED_EVENT, onChange);
  }, [load]);

  return {
    status,
    blocked: !!(status && status.applies && status.is_full),
    isAdmin: hasRole('DSA_ADMIN'),
    refresh: () => load(true),
  };
}
