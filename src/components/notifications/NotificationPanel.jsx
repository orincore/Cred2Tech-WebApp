import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Bell, Check, CheckCheck, Copy, ExternalLink, Loader2, FileText, Coins, CheckCircle2, XCircle, LockKeyhole, Shield, CreditCard, Building2, Ticket, TrendingUp, File, Monitor, MapPin } from 'lucide-react';
import { FaApple, FaAndroid, FaWindows, FaLinux } from 'react-icons/fa6';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';
import { notificationsService } from '../../api/notificationsService';

// ─── Event-type → icon map ──────────────────────────────────────
const EVENT_ICONS = {
  CASE_STAGE_CHANGED: FileText,
  CASE_ASSIGNED: FileText,
  CASE_DISBURSED: Coins,
  PULL_COMPLETED: CheckCircle2,
  PULL_FAILED: XCircle,
  LOGIN_ALERT: LockKeyhole,
  SECURITY_ALERT: Shield,
  WALLET_CREDITED: CreditCard,
  WALLET_DEBITED: CreditCard,
  SUBSCRIPTION_PURCHASED: Building2,
  SUBSCRIPTION_CANCELLED: Building2,
  SUBSCRIPTION_EXPIRED: Building2,
  SUBSCRIPTION_GRACE_REMINDER: Building2,
  SUBSCRIPTION_DOWNGRADE_APPLIED: Building2,
  SUBSCRIPTION_AUTO_RENEWAL_RESUMED: Building2,
  TICKET_CREATED: Ticket,
  TICKET_REPLIED: Ticket,
  TICKET_STATUS_CHANGED: Ticket,
  COMMISSION_PAID: TrendingUp,
  COMMISSION_REJECTED: TrendingUp,
  PAYOUT_CREATED: TrendingUp,
  PAYOUT_PAID: TrendingUp,
  PAYOUT_REJECTED: TrendingUp,
  INVOICE_GENERATED: File,
  DATA_PULL: FileText,
  CASE_SANCTIONED: CheckCircle2,
  CASE_SENT_TO_LENDER: FileText,
  WALLET_CREDIT: CreditCard,
  WALLET_LOW_BALANCE: CreditCard,
  DISCOUNT_APPLIED: Coins,
  SUBSCRIPTION: Building2,
  TICKET: Ticket,
  ADMIN_BROADCAST: Bell,
  DEFAULT: Bell,
};

const getEventIcon = (eventType) => EVENT_ICONS[eventType] || EVENT_ICONS.DEFAULT;

const NOTIFICATION_TYPE_LABELS = {
  ALERT: 'Alert',
  FEATURE_UPDATE: 'Feature update',
  COUPON: 'Coupon',
};

// ─── Device icon by label text (same OS set as components/OsIcon.jsx,
// which keys off a raw user-agent string — the notification only carries
// the already-formatted "Chrome on Windows"-style label from the backend's
// trustedDevice.service.js#labelFromUserAgent, so it's matched on that
// text instead). Falls back to a generic monitor glyph. ───────────────
const OS_ICON_BY_LABEL = [
  [/windows/i, FaWindows],
  [/ios|iphone|ipad/i, FaApple],
  [/mac ?os/i, FaApple],
  [/android/i, FaAndroid],
  [/linux/i, FaLinux],
];
const DeviceIcon = ({ label, size = 17, color }) => {
  const Icon = (OS_ICON_BY_LABEL.find(([re]) => re.test(label || '')) || [])[1];
  return Icon ? <Icon size={size} color={color} /> : <Monitor size={size} color={color} />;
};

// ─── Tiny square map thumbnail for a login-alert's resolved lat/lon ────
// No map library or API key involved: a single public OpenStreetMap raster
// tile, re-centered on the exact point with a CSS pixel offset (a
// coordinate almost never lands on a tile's own corner) and a small pin
// dot drawn on top. One image load per opened notification card is well
// within OSM's tile usage policy for a thumbnail like this.
const MAP_SIZE = 56;
const MAP_TILE_PX = 256;
const MAP_ZOOM = 11;

function lonLatToTileFloat(lon, lat, zoom) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

const LocationMap = ({ latitude, longitude, label }) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  const { x, y } = lonLatToTileFloat(longitude, latitude, MAP_ZOOM);
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const offsetX = MAP_SIZE / 2 - (x - tileX) * MAP_TILE_PX;
  const offsetY = MAP_SIZE / 2 - (y - tileY) * MAP_TILE_PX;

  return (
    <div
      title={label || 'Approximate location'}
      style={{
        width: MAP_SIZE,
        height: MAP_SIZE,
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}
    >
      <img
        src={`https://tile.openstreetmap.org/${MAP_ZOOM}/${tileX}/${tileY}.png`}
        alt=""
        width={MAP_TILE_PX}
        height={MAP_TILE_PX}
        loading="lazy"
        style={{ position: 'absolute', left: offsetX, top: offsetY, width: MAP_TILE_PX, height: MAP_TILE_PX, maxWidth: 'none' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {/* Pin marker — dead-center, exactly the resolved lat/lon */}
      <span style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: 'var(--error)',
        border: '2px solid white',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
};

// ─── Login-alert device card — mirrors ProfilePage's Active Sessions
// "DeviceRow" (icon chip + device label + badge + subtitle), plus a tiny
// map on the right when a location was resolved. Rendered in place of the
// plain message sentence for LOGIN_ALERT notifications that carry the
// structured metadata mfa.service.js now attaches; anything without it
// (older rows, or a failed geo lookup) still falls back to that sentence.
const LoginAlertCard = ({ metadata }) => {
  const { device_label: deviceLabel, location, ip_address: ipAddress, trusted } = metadata;
  const subtitle = [location?.label, ipAddress].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
      padding: '10px 10px 10px 12px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 0,
        flexShrink: 0,
        background: 'var(--primary-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <DeviceIcon label={deviceLabel} size={17} color="var(--primary)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {deviceLabel || 'Unknown device'}
          </span>
          {trusted && (
            <span style={{
              flexShrink: 0,
              fontSize: 9.5,
              fontWeight: 700,
              color: 'var(--success)',
              background: 'var(--success-bg)',
              padding: '2px 8px',
              borderRadius: 0,
            }}>
              Trusted device
            </span>
          )}
        </p>
        {subtitle && (
          <p style={{
            margin: '3px 0 0',
            fontSize: 11.5,
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {location?.label && <MapPin size={11} style={{ flexShrink: 0 }} />}
            {subtitle}
          </p>
        )}
      </div>

      <LocationMap latitude={location?.latitude} longitude={location?.longitude} label={location?.label} />
    </div>
  );
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Single notification row ────────────────────────────────────
const NotificationRow = ({ notification, onTap }) => {
  const isUnread = !notification.is_read;
  const couponCode = notification.metadata?.coupon_code;
  const isLoginAlertCard = notification.event_type === 'LOGIN_ALERT' && !!notification.metadata?.device_label;
  const [copied, setCopied] = React.useState(false);

  const handleCopyCoupon = async (event) => {
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success('Coupon code copied');
    } catch {
      toast.error('Unable to copy coupon code');
    }
  };

  const handleClick = async () => {
    if (onTap) onTap(notification);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 20px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        background: isUnread ? 'var(--primary-subtle)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isUnread ? 'var(--primary-subtle)' : 'transparent'; }}
    >
      {/* Icon container */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 0,
        background: isUnread ? 'var(--primary)' : 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          color: isUnread ? 'white' : 'var(--primary)',
          lineHeight: 1,
        }}>
          {React.createElement(getEventIcon(notification.event_type), { size: 18, strokeWidth: 2 })}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{
              display: 'inline-block',
              marginBottom: 6,
              padding: '3px 8px',
              borderRadius: 0,
              background: notification.notification_type === 'COUPON' ? 'var(--success-bg)' :
                         notification.notification_type === 'FEATURE_UPDATE' ? 'var(--primary-subtle)' :
                         'var(--bg-elevated)',
              color: notification.notification_type === 'COUPON' ? 'var(--success)' :
                     notification.notification_type === 'FEATURE_UPDATE' ? 'var(--primary)' :
                     'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {NOTIFICATION_TYPE_LABELS[notification.notification_type] || 'Alert'}
            </span>
            <p style={{
              margin: 0,
              fontSize: 14,
              fontWeight: isUnread ? 600 : 500,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              wordBreak: 'break-word'
            }}>
              {notification.title || 'Notification'}
            </p>
          </div>
          {isUnread && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--primary)',
              flexShrink: 0,
              marginTop: 6,
            }} />
          )}
        </div>
        {isLoginAlertCard ? (
          <LoginAlertCard metadata={notification.metadata} />
        ) : notification.message && (
          <p style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {notification.message}
          </p>
        )}
        {couponCode && (
          <motion.button
            type="button"
            onClick={handleCopyCoupon}
            title="Copy coupon code"
            animate={{ scale: copied ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              padding: '6px 10px',
              border: `1px solid ${copied ? 'var(--success)' : 'var(--primary)'}`,
              borderRadius: 0,
              background: copied ? 'var(--success-bg)' : 'var(--primary-subtle)',
              color: copied ? 'var(--success)' : 'var(--primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = copied ? 'var(--success-bg)' : 'var(--primary-subtle)';
              e.currentTarget.style.color = copied ? 'var(--success)' : 'var(--primary)';
            }}
          >
            <span style={{ letterSpacing: '0.04em' }}>{couponCode}</span>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied && <span>Copied</span>}
          </motion.button>
        )}
        <p style={{
          margin: '8px 0 0',
          fontSize: 12,
          color: 'var(--text-tertiary)',
        }}>
          {formatTime(notification.created_at)}
        </p>
      </div>

      {/* Navigate arrow */}
      {notification.action_url && (
        <ExternalLink size={14} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 2 }} />
      )}
    </motion.div>
  );
};

// ─── Main panel ─────────────────────────────────────────────────
const NotificationPanel = () => {
  const navigate = useNavigate();
  const {
    isPanelOpen,
    closePanel,
    notifications,
    hasMore,
    isLoading,
    loadMore,
    markAllRead,
    markTapped,
  } = useNotifications();

  const listEndRef = useRef(null);

  // Close on Escape.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closePanel(); };
    if (isPanelOpen) {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [isPanelOpen, closePanel]);

  // Infinite scroll — IntersectionObserver on the sentinel element.
  useEffect(() => {
    if (!isPanelOpen || !hasMore || isLoading) return;
    const sentinel = listEndRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '100px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isPanelOpen, hasMore, isLoading, loadMore]);

  const handleTap = useCallback((notification) => {
    markTapped(notification.id, !notification.is_read);
    closePanel();
    if (!notification.action_url) return;
    if (/^https?:\/\//i.test(notification.action_url)) {
      window.open(notification.action_url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(notification.action_url);
    }
  }, [closePanel, navigate, markTapped]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closePanel}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 190,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Slide-in panel from the right */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              maxWidth: '100vw',
              zIndex: 200,
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              background: 'var(--bg-surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 0,
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Bell size={16} color="white" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 0,
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    title="Mark all as read"
                    aria-label="Mark all notifications as read"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '0 10px',
                      height: 30,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 0,
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.background = 'var(--primary-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                  >
                    <CheckCheck size={15} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={closePanel}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 300,
                  gap: 12,
                  color: 'var(--text-tertiary)',
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 0,
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Bell size={28} color="var(--text-tertiary)" />
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    No notifications yet
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onTap={handleTap}
                    />
                  ))}

                  {/* Infinite-scroll sentinel */}
                  {hasMore && (
                    <div
                      ref={listEndRef}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        color: 'var(--text-tertiary)',
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      {isLoading && (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          Loading more…
                        </>
                      )}
                    </div>
                  )}

                  {!hasMore && notifications.length > 0 && (
                    <p style={{
                      textAlign: 'center',
                      padding: '16px 20px',
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      borderTop: '1px solid var(--border)',
                    }}>
                      — end of notifications —
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
