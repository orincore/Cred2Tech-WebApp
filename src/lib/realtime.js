import { io } from 'socket.io-client';
import api from '../api/axiosInstance';

/**
 * One shared Socket.IO connection for the whole app.
 *
 * Deliberately a module singleton rather than a per-component connection: the
 * step-2 wizard renders up to a dozen pull components at once (primary + every
 * co-applicant × GST/ITR/bank), and each one subscribing to the same case must
 * not mean a dozen sockets. They all multiplex over this one, and the server
 * keeps one room per case.
 *
 * The connection is lazy — nothing opens until a component actually asks to
 * watch a case — and reference-counted per case, so the room is left only when
 * the last interested component unmounts.
 */

// VITE_API_BASE_URL points at the REST mount ("https://host/api"). Socket.IO
// connects to the origin but keeps its path *under* /api, because that prefix
// is the only thing the production nginx proxies to Node — anything outside it
// is swallowed by the static SPA's try_files fallback and comes back as
// index.html instead of an engine.io handshake.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');
const SOCKET_PATH = '/api/socket.io';

let socket = null;
/** caseId -> { count, listeners:Set<fn>, joined:boolean, lastSnapshot:object|null } */
const rooms = new Map();
const statusListeners = new Set();

function emitConnectionStatus(status) {
  statusListeners.forEach((fn) => {
    try { fn(status); } catch (err) { console.error('[realtime] status listener failed', err); }
  });
}

function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    // Read lazily on every (re)connect rather than captured once, so a token
    // refreshed mid-session is picked up without a page reload.
    auth: (cb) => cb({ token: localStorage.getItem('token') }),
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    emitConnectionStatus('connected');
    // Re-join every watched case. A reconnect means the server-side rooms are
    // gone, and the join ack carries a fresh snapshot — which is exactly what
    // repairs any state change we missed while disconnected.
    rooms.forEach((room, caseId) => {
      room.joined = false;
      joinRoom(caseId);
    });
  });

  socket.on('disconnect', () => emitConnectionStatus('disconnected'));
  socket.on('connect_error', () => emitConnectionStatus('error'));

  socket.on('case_pull_snapshot', (snapshot) => {
    const room = rooms.get(Number(snapshot?.caseId));
    if (!room) return;
    room.lastSnapshot = snapshot;
    room.listeners.forEach((fn) => {
      try { fn(snapshot); } catch (err) { console.error('[realtime] snapshot listener failed', err); }
    });
  });

  return socket;
}

function joinRoom(caseId) {
  const room = rooms.get(caseId);
  if (!room || room.joined) return;

  getSocket().emit('join_case', { caseId }, (res) => {
    if (!res?.ok) {
      console.error('[realtime] join_case rejected:', res?.error);
      return;
    }
    room.joined = true;
    if (res.snapshot) {
      // The ack snapshot is why remounting a step is never stale: the first
      // paint after re-entering already reflects true current server state.
      room.lastSnapshot = res.snapshot;
      room.listeners.forEach((fn) => {
        try { fn(res.snapshot); } catch (err) { console.error('[realtime] snapshot listener failed', err); }
      });
    }
  });
}

/**
 * Watch a case's data-pull status.
 *
 * @param {number|string} caseId
 * @param {(snapshot: object) => void} onSnapshot
 * @returns {() => void} unsubscribe
 */
export function subscribeToCasePulls(caseId, onSnapshot) {
  const id = Number(caseId);
  if (!id) return () => {};

  let room = rooms.get(id);
  if (!room) {
    room = { count: 0, listeners: new Set(), joined: false, lastSnapshot: null };
    rooms.set(id, room);
  }
  room.count += 1;
  room.listeners.add(onSnapshot);

  // A component mounting into an already-watched case gets the cached snapshot
  // straight away instead of waiting for the next server push.
  if (room.lastSnapshot) {
    try { onSnapshot(room.lastSnapshot); } catch (err) { console.error('[realtime] snapshot replay failed', err); }
  }

  const s = getSocket();
  if (s.connected) joinRoom(id);

  return () => {
    room.listeners.delete(onSnapshot);
    room.count -= 1;
    if (room.count > 0) return;

    rooms.delete(id);
    if (socket?.connected) socket.emit('leave_case', { caseId: id });
    disconnectIfIdle();
  };
}

// --- Consent status: short-interval polling, not a socket room -------------
//
// A consent approval is a single one-off event per request, not a stream of
// frequent updates like the case-pull supervisor above — so unlike
// subscribeToCasePulls, this deliberately does NOT hold a socket connection
// open. It polls GET /consent/status/:id (DSA-authenticated, same as
// consentService.getStatus) every POLL_INTERVAL_MS instead, which is near-
// enough to instant for a human waiting on a customer to click a link, at a
// fraction of the memory a kept-alive connection costs per waiting DSA tab.
// Reference-counted the same way subscribeToCasePulls is, so N components
// watching the same request id share one poll loop instead of running N.
const POLL_INTERVAL_MS = 3000;
// PENDING is the only status that can still change — GRANTED/EXPIRED/
// REVOKED are all terminal, so there's nothing left to poll for once one of
// them is seen.
const TERMINAL_CONSENT_STATUSES = ['GRANTED', 'EXPIRED', 'REVOKED'];
/** requestId -> { count, listeners:Set<fn>, timer:number|null, lastStatus:string|null } */
const consentPolls = new Map();

async function pollConsentStatusOnce(id, poll) {
  try {
    const res = await api.get(`/consent/status/${id}`);
    const status = res.data?.status;
    if (!status || status === poll.lastStatus) return;
    poll.lastStatus = status;
    poll.listeners.forEach((fn) => {
      try { fn({ request_id: id, status }); } catch (err) { console.error('[realtime] consent listener failed', err); }
    });
    if (TERMINAL_CONSENT_STATUSES.includes(status) && poll.timer) {
      clearInterval(poll.timer);
      poll.timer = null;
    }
  } catch (err) {
    // Transient network hiccup — leave the interval running and try again
    // on the next tick rather than killing the poll loop over one failure.
    console.error('[realtime] consent status poll failed', err);
  }
}

/**
 * Watch a single consent request for the moment the customer approves it.
 *
 * @param {number|string} requestId
 * @param {(payload: {request_id:number, status:string}) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeToConsentRequest(requestId, onUpdate) {
  const id = Number(requestId);
  if (!id) return () => {};

  let poll = consentPolls.get(id);
  if (!poll) {
    poll = { count: 0, listeners: new Set(), timer: null, lastStatus: null };
    consentPolls.set(id, poll);
  }
  poll.count += 1;
  poll.listeners.add(onUpdate);

  if (poll.lastStatus) {
    try { onUpdate({ request_id: id, status: poll.lastStatus }); } catch (err) { console.error('[realtime] consent replay failed', err); }
  }

  // Poll immediately — covers "already granted by the time this mounted" —
  // then on an interval, same shape as the case-pull room's join-ack +
  // subsequent pushes.
  pollConsentStatusOnce(id, poll);
  if (!poll.timer && !TERMINAL_CONSENT_STATUSES.includes(poll.lastStatus)) {
    poll.timer = setInterval(() => pollConsentStatusOnce(id, poll), POLL_INTERVAL_MS);
  }

  return () => {
    poll.listeners.delete(onUpdate);
    poll.count -= 1;
    if (poll.count > 0) return;

    if (poll.timer) clearInterval(poll.timer);
    consentPolls.delete(id);
  };
}

// Nothing left to watch anywhere — drop the connection rather than hold an
// idle socket (and its server-side supervisor) open app-wide. Consent
// polling never opens this connection in the first place, so it plays no
// part here.
function disconnectIfIdle() {
  if (rooms.size === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Tell the server to re-read and re-broadcast now. Call right after an action
 * that changes pull state (submit / cancel / delete) so the UI reflects it
 * immediately instead of on the next tick.
 */
export function refreshCasePulls(caseId) {
  const id = Number(caseId);
  if (!id || !socket?.connected) return;
  socket.emit('refresh_case', { caseId: id });
}

/** Subscribe to 'connected' | 'disconnected' | 'error'. Returns unsubscribe. */
export function subscribeToConnectionStatus(fn) {
  statusListeners.add(fn);
  if (socket) fn(socket.connected ? 'connected' : 'disconnected');
  return () => statusListeners.delete(fn);
}
