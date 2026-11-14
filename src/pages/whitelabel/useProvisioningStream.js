import { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../lib/apiBase';
import { splitSse } from './whitelabelUi';

// Live provisioning progress over Server-Sent Events. The browser's EventSource cannot send the login token, so this reads the
// stream with fetch. It reconnects with backoff, and the page also refreshes the authoritative status on a slow timer, so a
// dropped connection never leaves the screen wrong for long. `onEvent(e)` gets every progress event; `onSnapshot` gets the
// full state the server sends first on every (re)connect.
export function useProvisioningStream(orgId, { enabled = true, onEvent, onSnapshot } = {}) {
  const [state, setState] = useState('connecting');   // connecting | live | reconnecting
  const handlers = useRef({ onEvent, onSnapshot });
  handlers.current = { onEvent, onSnapshot };

  useEffect(() => {
    if (!enabled || !orgId) return undefined;
    let stopped = false; let ctrl = null; let retry = 0; let timer = null;

    async function connect() {
      ctrl = new AbortController();
      try {
        const res = await fetch(`${getApiBaseUrl()}/admin/whitelabel/${orgId}/provisioning/stream`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, Accept: 'text/event-stream' }, signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream answered ${res.status}`);
        setState('live'); retry = 0;
        const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const { events, rest } = splitSse(buf); buf = rest;
          for (const ev of events) {
            if (ev.event === 'snapshot') handlers.current.onSnapshot?.(ev.data.provisioning);
            else if (ev.event === 'progress') handlers.current.onEvent?.(ev.data);
          }
        }
      } catch (e) { if (stopped) return; }
      if (stopped) return;
      setState('reconnecting'); retry += 1;
      timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 15000));
    }
    connect();
    return () => { stopped = true; if (ctrl) ctrl.abort(); if (timer) clearTimeout(timer); };
  }, [orgId, enabled]);

  return state;
}
