import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Bell icon button that opens the notification panel.
 * Renders an unread-count badge when the count is > 0.
 */
const NotificationBell = () => {
  const { unreadCount, openPanel } = useNotifications();

  return (
    <button
      className="btn btn-ghost btn-icon"
      title="Notifications"
      onClick={openPanel}
      style={{ position: 'relative' }}
    >
      <Bell size={18} color="var(--text-tertiary)" />
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 8,
          background: 'var(--error)',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
