/**
 * Browser push-notification helpers.
 *
 * VAPID public key lives in VITE_PUSH_VAPID_PUBLIC_KEY (set in .env).
 * Registration / unregistration flow mirrors the backend VAPID subscription table:
 * POST /notifications/push/subscribe  → backend stores endpoint + keys
 * POST /notifications/push/unsubscribe → backend removes the subscription
 *
 * The app also keeps a local flag (localStorage key below) for the in-app
 * preference toggle on the Profile page — the server is the source of truth
 * via PATCH /notifications/push-preference, but the toggle reads this local
 * value on mount so it reflects the user's choice even when offline.
 */
import { notificationsService } from '../api/notificationsService';

const LOCAL_PREF_KEY = 'c2t_push_enabled';

/** Returns the VAPID public key from env (empty string if not configured). */
export function getVapidPublicKey() {
  return import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY || '';
}

/** True if the browser supports the Push API and service workers. */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current Notification permission: 'granted' | 'denied' | 'default'. */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/** Show a local notification to verify browser permission and the service worker. */
export async function showTestBrowserNotification() {
  if (!isPushSupported()) {
    throw new Error('Browser notifications are not supported in this browser.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Browser notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('New Notification', {
    body: 'Browser notifications are working.',
    icon: '/logos/favicon.png',
    badge: '/logos/favicon.png',
    dir: 'auto',
    lang: 'en-IN',
    data: { action_url: '/admin/notifications/send' },
    tag: 'cred2tech-browser-notification-test',
  });
}

/**
 * Returns the locally-cached push preference (true/false/null if never set).
 * The server is the source of truth; this is a fast local read for the toggle.
 */
export function getLocalPushPreference() {
  try {
    const val = localStorage.getItem(LOCAL_PREF_KEY);
    return val === null ? null : val === 'true';
  } catch {
    return null;
  }
}

/**
 * Save push preference locally (mirrors the server's push_enabled field so the
 * toggle reflects the last known state without a network round-trip on mount).
 */
function setLocalPushPreference(enabled) {
  try {
    localStorage.setItem(LOCAL_PREF_KEY, String(enabled));
  } catch (_) { /* storage quota or private mode — ignore */ }
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/** Convert a Uint8Array to a base64url string for the push subscription. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Enable push notifications for the current browser.
 *
 * Flow: requests notification permission → gets a push subscription → sends the
 * subscription object to the backend → updates the server's push_enabled flag.
 *
 * @param {boolean} [serverPref=true]  — whether to also enable in-app push on the server.
 * @returns {Promise<boolean>} true if fully enabled, false if blocked at any step.
 */
export async function enablePush(serverPref = true) {
  if (!isPushSupported()) return false;

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    console.warn('[push] VITE_PUSH_VAPID_PUBLIC_KEY is not set; push subscription skipped.');
    return false;
  }

  try {
    const sw = await navigator.serviceWorker.ready;

    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send to backend.
    const { endpoint, keys } = subscription.toJSON();
    await notificationsService.subscribePush({ endpoint, keys });

    // Update server-side push_enabled preference.
    if (serverPref) {
      await notificationsService.setPushPreference(true);
    }

    setLocalPushPreference(true);
    return true;
  } catch (err) {
    console.error('[push] enablePush failed', err);
    return false;
  }
}

/**
 * Disable push notifications for the current browser.
 *
 * Flow: gets the current push subscription → unsubscribes from the browser →
 * tells the backend to remove the subscription → updates the server's push_enabled flag.
 *
 * @param {boolean} [serverPref=true] — whether to also disable in-app push on the server.
 * @returns {Promise<void>}
 */
export async function disablePush(serverPref = true) {
  try {
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await notificationsService.unsubscribePush(sub.endpoint);
    }

    if (serverPref) {
      await notificationsService.setPushPreference(false);
    }

    setLocalPushPreference(false);
  } catch (err) {
    console.error('[push] disablePush failed', err);
    // Don't surface to the user — just log and clear local state.
    setLocalPushPreference(false);
  }
}
