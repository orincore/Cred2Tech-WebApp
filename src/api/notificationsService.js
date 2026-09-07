import api from './axiosInstance';

/**
 * User-facing notification API — mirrors ticketService.js's plain-object-of-async-functions
 * pattern. All calls use the authenticated token from the axios interceptor.
 */
export const notificationsService = {
  /** Paginated notification list, newest first. */
  list: async ({ cursor = null, limit = 20, unreadOnly = false } = {}) => {
    const res = await api.get('/notifications', {
      params: { cursor, limit, unreadOnly: unreadOnly ? 'true' : undefined },
    });
    return res.data.data; // { items, nextCursor }
  },

  /** Unread count for the bell badge. */
  unreadCount: async () => {
    const res = await api.get('/notifications/unread-count');
    return res.data.count;
  },

  /** Mark one notification as read. */
  markRead: async (id) => {
    const res = await api.post(`/notifications/${id}/read`);
    return res.data;
  },

  /** Mark all unread notifications as read. */
  markAllRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },

  /** Mark as tapped (read + acted upon) and return the action URL to navigate to. */
  markTapped: async (id) => {
    const res = await api.post(`/notifications/${id}/tap`);
    return res.data;
  },

  /** Subscribe the browser for push notifications (VAPID flow). */
  subscribePush: async ({ endpoint, keys }) => {
    const res = await api.post('/notifications/push/subscribe', { endpoint, keys });
    return res.data;
  },

  /** Unsubscribe the browser from push notifications. */
  unsubscribePush: async (endpoint) => {
    const res = await api.post('/notifications/push/unsubscribe', { endpoint });
    return res.data;
  },

  /** Read the user's app-level browser push preference. */
  getPushPreference: async () => {
    const res = await api.get('/notifications/push-preference');
    return !!res.data.push_enabled;
  },

  /** Update the user's in-app push preference (toggles the checkbox in settings). */
  setPushPreference: async (enabled) => {
    const res = await api.patch('/notifications/push-preference', { enabled });
    return res.data;
  },
};

/**
 * Admin-only notification API.
 */
export const adminNotificationsService = {
  /** Search active users who can receive a one-user notification. */
  listRecipients: async (email) => {
    const res = await api.get('/admin/notifications/recipients', { params: { email } });
    return res.data.data;
  },

  /** Send a broadcast notification to all users or a filtered set. */
  send: async ({ title, message, audience = 'ALL', targetRole = null, targetUserId = null, actionUrl = null, couponCode = null, notificationType = 'ALERT' }) => {
    const res = await api.post('/admin/notifications/send', {
      title,
      message,
      audience,
      targetRole,
      targetUserId,
      actionUrl,
      couponCode,
      notificationType,
    });
    return res.data;
  },

  /** Paginated list of past admin broadcasts. */
  listBroadcasts: async ({ cursor = null, limit = 20 } = {}) => {
    const res = await api.get('/admin/notifications/broadcasts', {
      params: { cursor, limit },
    });
    return res.data.data;
  },

  /** Analytics for one broadcast (read/tap counts). */
  getBroadcast: async (id) => {
    const res = await api.get(`/admin/notifications/broadcasts/${id}`);
    return res.data.data;
  },
};
