import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Send, Loader2, Users, Info, Bell } from 'lucide-react';
import { showTestBrowserNotification } from '../lib/pushNotifications';
import PageHeader from '../components/ui/PageHeader';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

/**
 * Dropdown options map to the backend's audience system:
 *   'ALL'            → audience: 'ALL' (all active users)
 *   'DSA_ADMIN' etc. → audience: 'ROLE', targetRole: <role>
 */
const TARGET_OPTIONS = [
  { value: 'ALL', label: 'All active users', audience: 'ALL', targetRole: null },
  { value: 'DSA_ADMIN', label: 'DSA Admins only', audience: 'ROLE', targetRole: 'DSA_ADMIN' },
  { value: 'DSA_MEMBER', label: 'DSA Members only', audience: 'ROLE', targetRole: 'DSA_MEMBER' },
  { value: 'SUB_DSA', label: 'Sub-DSAs only', audience: 'ROLE', targetRole: 'SUB_DSA' },
  { value: 'MSME_CUSTOMER', label: 'MSME Customers only', audience: 'ROLE', targetRole: 'MSME_CUSTOMER' },
  { value: 'USER', label: 'A specific user', audience: 'USER', targetRole: null },
];

const AdminSendNotificationPage = () => {
  const { isMobile } = useResponsive();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState('ALERT');
  const [targetOption, setTargetOption] = useState(TARGET_OPTIONS[0]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [actionUrl, setActionUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [sending, setSending] = useState(false);
  const [testingBrowserNotification, setTestingBrowserNotification] = useState(false);
  const [result, setResult] = useState(null); // { delivered, failed }

  const handleTestBrowserNotification = async () => {
    setTestingBrowserNotification(true);
    try {
      await showTestBrowserNotification();
      toast.success('Test browser notification sent.');
    } catch (err) {
      toast.error(err.message || 'Unable to show browser notification.');
    } finally {
      setTestingBrowserNotification(false);
    }
  };

  useEffect(() => {
    if (targetOption.value !== 'USER' || recipient || recipientEmail.trim().length < 2) {
      setRecipientSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingRecipients(true);
      try {
        const { adminNotificationsService } = await import('../api/notificationsService');
        const matches = await adminNotificationsService.listRecipients(recipientEmail.trim());
        if (!cancelled) setRecipientSuggestions(matches);
      } catch {
        if (!cancelled) setRecipientSuggestions([]);
      } finally {
        if (!cancelled) setLoadingRecipients(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientEmail, recipient, targetOption.value]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Please enter a notification title.');
    if (!message.trim()) return toast.error('Please enter a notification message.');
    if (targetOption.value === 'USER' && !recipient) return toast.error('Please select a user from the email suggestions.');

    setSending(true);
    setResult(null);
    try {
      const { adminNotificationsService } = await import('../api/notificationsService');
      const data = await adminNotificationsService.send({
        title: title.trim(),
        message: message.trim(),
        audience: targetOption.audience,
        targetRole: targetOption.targetRole,
        targetUserId: recipient?.id || null,
        actionUrl: actionUrl.trim() || null,
        couponCode: couponCode.trim() || null,
        notificationType,
      });
      setResult(data.data || data);
      setTitle('');
      setMessage('');
      setNotificationType('ALERT');
      setActionUrl('');
      setCouponCode('');
      setRecipientEmail('');
      setRecipient(null);
      toast.success('Notification sent successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--on-surface)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '68px 16px 0' : '24px 24px 0',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <PageHeader
          title="Send Broadcast Notification"
          subtitle="Push an in-app notification to one or more user groups."
          breadcrumbs={[
            { label: 'Admin', path: '/admin' },
            { label: 'Notifications' },
          ]}
          compact={isMobile}
        />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '0 16px 16px' : '0 24px 24px',
      }}>
        {/* Info box */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '12px 16px',
          background: 'var(--primary-bg)',
          border: '1px solid var(--primary)',
          borderLeft: '3px solid var(--primary)',
          marginBottom: 24,
          borderRadius: 0,
        }}>
          <Info size={16} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Broadcast notifications are delivered via in-app socket events and, for opted-in users, via browser push. Users who have disabled push in their browser will receive the notification only when they have the app open.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Title <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New ESR Engine Update Available"
              maxLength={200}
              required
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {title.length}/200 characters
            </p>
          </div>

          {/* Message */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Message <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea
              className="form-control"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the notification in plain language…"
              rows={4}
              maxLength={2000}
              required
              style={{ resize: 'vertical' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {message.length}/2000 characters
            </p>
          </div>

          {/* Target */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              <Users size={13} style={{ display: 'inline', marginRight: 4 }} />
              Send to
            </label>
            <select
              className="form-control"
              value={targetOption.value}
              onChange={(e) => setTargetOption(TARGET_OPTIONS.find((o) => o.value === e.target.value))}
              style={{ maxWidth: 280 }}
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {targetOption.value === 'USER' && (
              <div style={{ position: 'relative', maxWidth: 420, marginTop: 10 }}>
                <input
                  className="form-control"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => { setRecipientEmail(e.target.value); setRecipient(null); }}
                  placeholder="Type a user email address"
                  autoComplete="off"
                  required
                />
                {loadingRecipients && <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Searching users...</p>}
                {!recipient && recipientSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 2, top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    {recipientSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => { setRecipient(user); setRecipientEmail(user.email); setRecipientSuggestions([]); }}
                        style={{ display: 'block', width: '100%', padding: '9px 12px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--on-surface)', cursor: 'pointer' }}
                      >
                        <strong>{user.email}</strong>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{user.name || 'Unnamed user'}{user.tenant?.name ? ` · ${user.tenant.name}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {recipient && <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--success)' }}>Selected: {recipient.name || recipient.email}</p>}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Notification type
            </label>
            <select className="form-control" value={notificationType} onChange={(e) => setNotificationType(e.target.value)} style={{ maxWidth: 280 }}>
              <option value="ALERT">Alert</option>
              <option value="FEATURE_UPDATE">Feature update</option>
              <option value="COUPON">Coupon</option>
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Coupon code <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              className="form-control"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME100"
              maxLength={100}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Recipients will get a copy button for this code.</p>
          </div>

          {/* Redirect */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Redirect link <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              className="form-control"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/cases/123 or https://example.com"
              maxLength={500}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Users will open this path or link when they tap the notification.</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !title.trim() || !message.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestBrowserNotification}
            disabled={testingBrowserNotification}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}
          >
            {testingBrowserNotification ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={15} />}
            {testingBrowserNotification ? 'Testing…' : 'Test Browser Notification'}
          </button>
        </form>

        {/* Result summary */}
        {result && (
          <div style={{
            marginTop: 24,
            padding: '16px 20px',
            background: 'var(--success-bg)',
            border: '1px solid var(--success)',
            borderLeft: '3px solid var(--success)',
            borderRadius: 0,
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
              Sent successfully
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Delivered to {result.delivered ?? 0} user(s).
              Sent to {result.recipient_count ?? result.delivered ?? 0} user(s).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSendNotificationPage;
