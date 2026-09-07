import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Bell, Check, ChevronRight, Settings, ShieldCheck, X } from 'lucide-react';
import { notificationsService } from '../api/notificationsService';
import { listenToNotifications, listenToNotificationUnreadCount, initFocusTracking } from '../lib/realtime';
import { useAuth } from './AuthContext';
import { enablePush, getLocalPushPreference, getNotificationPermission, isPushSupported } from '../lib/pushNotifications';

/**
 * NotificationContext — mounted inside AuthProvider so it has access to auth.user.
 *
 * Provides:
 *   unreadCount      — integer for the bell badge
 *   isPanelOpen      — boolean
 *   openPanel / closePanel
 *   notifications    — page of Notification objects (newest first)
 *   hasMore          — true when more pages exist
 *   isLoading        — true while loading the next page
 *   loadMore()       — append next page
 *   markRead(id)     — mark one notification read
 *   markAllRead()    — mark all read
 *   refreshCount()    — re-fetch unread count
 *
 * On a new socket notification it prepends to the list, increments the badge
 * count, and fires a react-hot-toast (unless the panel is already open, in
 * which case the user is already looking at it).
 *
 * Usage:
 *   const { unreadCount, openPanel, markRead } = useNotifications();
 */
const NotificationContext = createContext(null);

const normalizeNotification = (notification) => ({
  ...notification,
  is_read: notification.is_read ?? Boolean(notification.read_at),
});

const PUSH_PROMPT_KEY = (userId) => `c2t_push_prompt_seen_v2:${userId}`;

const readPushPromptSeen = (userId) => {
  try {
    return localStorage.getItem(PUSH_PROMPT_KEY(userId)) === 'true';
  } catch {
    return false;
  }
};

const savePushPromptSeen = (userId) => {
  try { localStorage.setItem(PUSH_PROMPT_KEY(userId), 'true'); } catch { /* best effort */ }
};

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pushPrompt, setPushPrompt] = useState(null); // 'ask' | 'steps' | null
  const [pushPromptLoading, setPushPromptLoading] = useState(false);
  const cursorRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      setPushPrompt(null);
      return undefined;
    }
    if (!isPushSupported()) return undefined;

    let cancelled = false;
    const checkPushState = async () => {
      let appEnabled = getLocalPushPreference() === true;
      try {
        appEnabled = await notificationsService.getPushPreference();
      } catch (err) {
        console.warn('[NotificationContext] push preference check failed', err);
      }
      if (cancelled) return;

      const permission = getNotificationPermission();
      const promptSeen = readPushPromptSeen(user.id);

      // App-level OFF always requires an explicit click in our prompt, even
      // when Chrome permission is already granted. Never re-enable silently.
      if (!appEnabled) {
        if (!cancelled) setPushPrompt(permission === 'denied' ? 'steps' : 'ask');
        return;
      }
      if (permission === 'granted' && getLocalPushPreference() !== true && !promptSeen) {
        savePushPromptSeen(user.id);
        setPushPrompt('ask');
        return;
      }
      if (promptSeen) return;

      savePushPromptSeen(user.id);
      setPushPrompt(permission === 'denied' ? 'steps' : 'ask');
    };
    checkPushState();

    return () => { cancelled = true; };
  }, [user?.id]);

  const handleEnablePushFromPrompt = async () => {
    setPushPromptLoading(true);
    try {
      const enabled = await enablePush(true);
      if (enabled) {
        setPushPrompt(null);
      } else {
        setPushPrompt('steps');
      }
    } finally {
      setPushPromptLoading(false);
    }
  };

  const handleDeferPush = () => setPushPrompt('steps');

  // Boot: fetch initial unread count and first page, start focus tracking.
  useEffect(() => {
    if (!user?.id) return;

    initFocusTracking();

    async function bootstrap() {
      try {
        const [count, firstPage] = await Promise.all([
          notificationsService.unreadCount(),
          notificationsService.list({ limit: 20 }),
        ]);
        setUnreadCount(count);
        setNotifications((firstPage.items || []).map(normalizeNotification));
        setHasMore(!!firstPage.nextCursor);
        cursorRef.current = firstPage.nextCursor || null;
      } catch (err) {
        console.error('[NotificationContext] bootstrap failed', err);
      }
    }
    bootstrap();
  }, [user?.id]);

  // Socket: listen for incoming push notifications.
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = listenToNotifications((notification) => {
      // Prepend the new notification to the list.
      setNotifications((prev) => [normalizeNotification(notification), ...prev]);

      // Fire a toast only if the panel is not open — if the user is staring
      // at the panel they don't need another visual cue.
      if (!isPanelOpen) {
        toast.custom((t) => (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontFamily: 'inherit',
            fontSize: 13,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--outline)',
            borderLeft: '3px solid var(--primary)',
            boxShadow: 'var(--shadow-lg)',
            padding: '12px 16px',
            opacity: t.visible ? 1 : 0,
            transition: 'opacity 150ms ease-in-out',
          }}>
            <Bell size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                New Notification
              </div>
              <div style={{ marginTop: 3, fontWeight: 800, wordBreak: 'break-word' }}>
                {notification.title}
              </div>
              {notification.message && <div style={{ marginTop: 3, color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>{notification.message}</div>}
            </div>
          </div>
        ), {
          duration: 5000,
        });
      }
    });

    return unsubscribe;
  }, [user?.id, isPanelOpen]);

  useEffect(() => {
    if (!user?.id) return;
    return listenToNotificationUnreadCount((count) => setUnreadCount(Number(count) || 0));
  }, [user?.id]);

  /** Load the next page and append to the list. */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !cursorRef.current) return;
    setIsLoading(true);
    try {
      const page = await notificationsService.list({ cursor: cursorRef.current, limit: 20 });
      setNotifications((prev) => [...prev, ...(page.items || []).map(normalizeNotification)]);
      setHasMore(!!page.nextCursor);
      cursorRef.current = page.nextCursor || null;
    } catch (err) {
      console.error('[NotificationContext] loadMore failed', err);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading]);

  /** Mark one notification read locally + on the server. */
  const markRead = useCallback(async (id) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('[NotificationContext] markRead failed', err);
    }
  }, []);

  /** Mark all unread notifications read. */
  const markAllRead = useCallback(async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationContext] markAllRead failed', err);
    }
  }, []);

  /** Mark one notification tapped and update its local read state. */
  const markTapped = useCallback(async (id, wasUnread) => {
    try {
      await notificationsService.markTapped(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('[NotificationContext] markTapped failed', err);
    }
  }, []);

  /** Re-fetch the unread count from the server. */
  const refreshCount = useCallback(async () => {
    try {
      const count = await notificationsService.unreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('[NotificationContext] refreshCount failed', err);
    }
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        isPanelOpen,
        openPanel,
        closePanel,
        notifications,
        hasMore,
        isLoading,
        loadMore,
        markRead,
        markAllRead,
        markTapped,
        refreshCount,
      }}
    >
      {children}
      {pushPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.48)', backdropFilter: 'blur(3px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" style={{ width: 'min(440px, 100%)', background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0, boxShadow: 'var(--shadow-lg)', color: 'var(--on-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 16px', borderBottom: '1px solid var(--outline)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                  {pushPrompt === 'ask' ? <Bell size={18} /> : <Settings size={18} />}
                </div>
                <div>
                  <p id="push-prompt-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--on-surface)' }}>
                    {pushPrompt === 'ask' ? 'Stay updated with browser alerts' : 'Browser notifications are blocked'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--on-muted)' }}>
                    {pushPrompt === 'ask' ? 'Get important case, wallet, and account updates even when this tab is in the background.' : 'You can turn notifications on later from your browser settings.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={pushPrompt === 'ask' ? handleDeferPush : () => setPushPrompt(null)} aria-label="Close notification prompt" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--outline)', borderRadius: 0, background: 'transparent', color: 'var(--on-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {pushPrompt === 'ask' ? (
              <div style={{ padding: '18px 22px 22px' }}>
                <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                  {['Case and application status changes', 'Wallet and payment updates', 'Security and account alerts'].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--on-muted)' }}>
                      <Check size={14} color="var(--success)" />
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={handleDeferPush} disabled={pushPromptLoading} style={{ padding: '8px 12px', border: '1px solid var(--outline)', borderRadius: 0, background: 'transparent', color: 'var(--on-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Not now</button>
                  <button type="button" onClick={handleEnablePushFromPrompt} disabled={pushPromptLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', border: '1px solid var(--primary)', borderRadius: 0, background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: pushPromptLoading ? 0.65 : 1 }}>
                    {pushPromptLoading ? 'Enabling...' : 'Allow notifications'}
                    {!pushPromptLoading && <ChevronRight size={14} />}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '18px 22px 22px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.6, color: 'var(--on-muted)' }}>To enable notifications later from Cred2Tech:</p>
                <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                  {['Open Profile from the account menu', 'Select the Notifications tab', 'Turn on Browser Push Notifications and choose Allow'].map((item, index) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--on-muted)' }}>
                      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', color: 'var(--primary)', fontSize: 11, fontWeight: 700 }}>{index + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPushPrompt(null)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--bg-elevated)', color: 'var(--on-surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Got it</button>
              </div>
            )}
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationProvider>');
  }
  return ctx;
}
