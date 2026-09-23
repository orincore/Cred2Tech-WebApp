import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, ShieldCheck, LogOut, Check, Copy, Pencil, Lock, Trash2, Briefcase, Network, Clock, Ban, LayoutGrid, ChevronRight, Mail, Smartphone, Bell, Loader2 } from 'lucide-react';
import OsIcon from '../components/OsIcon';
import toast from 'react-hot-toast';
import { getMe } from '../api/authService';
import { msmeApi } from '../api/msmeService';
import * as mfaApi from '../api/mfaService';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, formatHierarchyPath, getErrorMessage } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import TravelingBorderButton from '../components/TravelingBorderButton';
import OtpInput from '../components/OtpInput';
import VirtualWorkspaceSubscriptionCard from '../components/VirtualWorkspaceSubscriptionCard';
import {
  isPushSupported,
  getNotificationPermission,
  getLocalPushPreference,
  enablePush,
  disablePush,
} from '../lib/pushNotifications';

// Responsive hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

// Custom spring-like easing used everywhere on this page instead of the
// default linear/ease-in-out transitions — gives every motion a slight
// deceleration "mass" instead of a mechanical, instant-feeling snap.
const EASE = [0.32, 0.72, 0, 1];

const initials = (name) => {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0]?.toUpperCase() || '—';
};

// ─── Double-Bezel primitives ────────────────────────────────────────────────
// Every major panel on this page is built from an outer "shell" (a faint
// tinted tray with a hairline ring) holding an inner "core" (the actual
// surface, with its own subtle top highlight) — like a glass plate sitting in
// a machined enclosure, instead of a flat bordered box floating on the page.
const Shell = ({ isDark, children, style, ...rest }) => (
  <div
    style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(79,70,229,0.03)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(79,70,229,0.08)'}`,
      borderRadius: 0,
      padding: 6,
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

const Core = ({ isDark, children, style, ...rest }) => (
  <div
    style={{
      background: 'var(--surface)',
      borderRadius: 0,
      boxShadow: `inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)'}`,
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

// A tiny pill "eyebrow" tag — precedes every section heading instead of
// dropping straight into a bare <h2>.
const Eyebrow = ({ children, color = 'var(--primary)' }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 0,
    background: `${color}14`, color, marginBottom: 12,
  }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{children}</span>
  </div>
);

// Read-only "key: value" summary card for Additional Information — replaces
// the old underlined-input-look-alike rows (which visually implied these
// fields were editable, when they never were) with a plain label/value row
// layout, grouped under a titled card matching the style already used for
// the MFA method cards elsewhere on this page.
const InfoCard = ({ icon: Icon, title, isDark, children }) => (
  <Shell isDark={isDark}>
    <Core isDark={isDark} style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--outline)'}`,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 0, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(79,70,229,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={13} strokeWidth={1.75} color="var(--primary)" />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '0.01em' }}>{title}</span>
      </div>
      <div>{children}</div>
    </Core>
  </Shell>
);

const InfoRow = ({ label, value, mono = false, last = false, isDark }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    padding: '13px 18px', borderBottom: last ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'var(--outline)'}`,
  }}>
    <span style={{ fontSize: 12.5, color: 'var(--on-muted)', opacity: 0.75 }}>{label}</span>
    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--on-surface)', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>
      {value}
    </span>
  </div>
);

// ─── Modal chrome ────────────────────────────────────────────────────────────
// One shared glass shell + icon badge for every confirmation dialog on this
// page, instead of six near-identical hand-copied style blocks.
const ModalShell = ({ isDark, onDismiss, children, maxWidth = 420 }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.22, ease: EASE }}
    onMouseDown={(e) => { if (e.target === e.currentTarget && onDismiss) onDismiss(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 1000, padding: 20,
      background: isDark ? 'rgba(5,9,24,0.62)' : 'rgba(10,22,40,0.35)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }}
      transition={{ duration: 0.45, ease: EASE }}
      style={{
        background: isDark ? 'rgba(22,32,72,0.94)' : 'rgba(255,255,255,0.96)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.08)'}`,
        borderRadius: 0,
        boxShadow: isDark
          ? '0 40px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 40px 100px rgba(79,70,229,0.16), inset 0 1px 0 rgba(255,255,255,0.7)',
        padding: 34, maxWidth, width: '100%',
      }}
    >
      {children}
    </motion.div>
  </motion.div>
);

const ModalIconBadge = ({ icon: Icon, color, isDark }) => (
  <div style={{
    width: 58, height: 58, borderRadius: 0,
    background: isDark ? `${color}26` : `${color}14`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
    boxShadow: `inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'}`,
  }}>
    <Icon size={25} strokeWidth={1.75} color={color} />
  </div>
);

const ModalTitle = ({ children, isDark }) => (
  <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 8px' }}>{children}</h3>
);

const ModalMessage = ({ children }) => (
  <p style={{ fontSize: 13.5, color: 'var(--on-muted)', opacity: 0.85, margin: '0 0 24px', lineHeight: 1.55 }}>{children}</p>
);

// Plain confirm/cancel dialog — covers Logout, Revoke Device, Revoke Session,
// Ban Device, Unban Device (all identical in shape: icon, title, message,
// two buttons).
const ConfirmModal = ({ isDark, icon, iconColor, title, message, onCancel, onConfirm, confirmLabel, confirmColor = 'red', loading, loadingLabel }) => (
  <ModalShell isDark={isDark} onDismiss={loading ? undefined : onCancel}>
    <div style={{ textAlign: 'center' }}>
      <ModalIconBadge icon={icon} color={iconColor} isDark={isDark} />
      <ModalTitle isDark={isDark}>{title}</ModalTitle>
      <ModalMessage>{message}</ModalMessage>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <TravelingBorderButton onClick={onCancel} size="sm" disabled={loading}>Cancel</TravelingBorderButton>
        <TravelingBorderButton onClick={onConfirm} size="sm" color={confirmColor} disabled={loading}>
          {loading ? loadingLabel : confirmLabel}
        </TravelingBorderButton>
      </div>
    </div>
  </ModalShell>
);

// Session / trusted-device list row — shared shape for Active Sessions,
// Blocked Devices, and Trusted Devices below.
const DeviceRow = ({ isDark, icon, title, badge, subtitle, actions }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '13px 16px', background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(79,70,229,0.025)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'var(--outline)'}`, borderRadius: 0,
    transition: 'background 0.25s ' + 'cubic-bezier(0.32,0.72,0,1)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 0, flexShrink: 0,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(79,70,229,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {badge}
        </p>
        <p style={{ fontSize: 11, color: 'var(--on-muted)', opacity: 0.7, margin: '3px 0 0' }}>{subtitle}</p>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>{actions}</div>
  </div>
);

// "Island" circular icon button — a destructive/utility action never sits
// naked; it lives inside its own soft rounded chip.
const IconAction = ({ icon: Icon, color, onClick, title, disabled }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      width: 32, height: 32, borderRadius: 0, border: 'none',
      background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: disabled ? 'var(--on-muted)' : color, opacity: disabled ? 0.35 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.2s ' + 'cubic-bezier(0.32,0.72,0,1), transform 0.2s cubic-bezier(0.32,0.72,0,1)',
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}14`; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <Icon size={15} strokeWidth={1.75} />
  </button>
);

const SectionEnter = ({ children, sectionKey }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={sectionKey}
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

const ProfilePage = () => {
  const { user: authUser, token, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isMobile } = useResponsive();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [formData, setFormData] = useState({ name: '', email: '', mobile: '' });
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // MSME customers authenticate via mobile OTP (no password), and "Additional
  // Info" is DSA staff hierarchy/role/session detail that doesn't apply to them.
  // AuthContext's normalizeUser() collapses authUser.role to a plain string
  // (see AuthContext.jsx), unlike the raw getMe() shape (`profile.role.name`)
  // used elsewhere on this page — comparing against `.role?.name` here always
  // read undefined, so every MSME customer was silently treated as staff.
  const isMsmeUser = authUser?.role === 'MSME_CUSTOMER';
  // Subscription management is a DSA_ADMIN-only concern (matches
  // VirtualWorkspaceSubscriptionCard's own self-gating and the same card's
  // existing home on OrganizationProfilePage) — DSA_MEMBER/SUB_DSA staff
  // don't manage tenant billing, so the tab doesn't appear for them.
  const canManageSubscription = hasRole('DSA_ADMIN');

  // ─── Push notification preferences ──────────────────────────────────────────
  const pushSupported = isPushSupported();
  const notifPermission = getNotificationPermission();
  // Initialise from the local cache (server truth is fetched below).
  const [pushEnabled, setPushEnabled] = useState(
    pushSupported && notifPermission === 'granted' ? (getLocalPushPreference() ?? false) : false
  );
  const [pushLoading, setPushLoading] = useState(false);

  const handleTogglePush = async (e) => {
    const enable = e.target.checked;
    setPushLoading(true);
    try {
      if (enable) {
        const ok = await enablePush(true);
        setPushEnabled(ok);
        if (!ok) {
          e.target.checked = false;
          const message = getNotificationPermission() === 'denied'
            ? 'Push notifications are blocked in your browser settings. Please allow notifications for this site.'
            : 'Unable to enable browser notifications. Check the VAPID configuration and try again.';
          toast.error(message);
        }
      } else {
        await disablePush(true);
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const sidebarItems = isMsmeUser
    ? [{ id: 'profile', icon: User, label: 'Account Information', subtitle: 'Change your Account information' }]
    : [
        { id: 'profile', icon: User, label: 'Account Information', subtitle: 'Change your Account information' },
        { id: 'password', icon: Shield, label: 'Password', subtitle: 'Change your Password' },
        { id: 'mfa', icon: ShieldCheck, label: 'Two-Factor Auth', subtitle: 'Manage your MFA methods' },
        { id: 'additional', icon: User, label: 'Additional Info', subtitle: 'View your account details' },
        { id: 'notifications', icon: Bell, label: 'Notifications', subtitle: 'Push and in-app preferences' },
        ...(canManageSubscription ? [{ id: 'subscription', icon: LayoutGrid, label: 'Subscription', subtitle: 'Plan, billing, and upgrades' }] : []),
      ];

  useEffect(() => {
    const requestedSection = searchParams.get('tab') || searchParams.get('section');
    if (requestedSection && sidebarItems.some((item) => item.id === requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, [searchParams, sidebarItems]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getMe();
        setProfile(data.user || data);
      } catch {
        setProfile(authUser);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [authUser]);

  // Update form data when profile loads
  useEffect(() => {
    const u = profile || authUser;
    if (u) {
      setFormData({
        name: u.name || '',
        email: u.email || '',
        mobile: u.mobile || ''
      });
    }
  }, [profile, authUser]);

  // ─── Two-Factor Authentication ───────────────────────────────────────────
  // Declared here (with the other hooks, before any early return below) so
  // hook order/count stays identical across renders regardless of loading
  // state — a hook defined after `if (loading) return ...` would only run on
  // some renders and not others, which is exactly what React's Rules of
  // Hooks forbid ("Rendered more hooks than during the previous render").
  const [mfaStatus, setMfaStatus] = useState(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  // action: 'totp' | 'email' | 'totp-disable' | 'email-disable' | 'backup-codes'
  const [stepUp, setStepUp] = useState({ open: false, action: null, password: '', error: '', loading: false });
  const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauthUrl, qrCodeDataUrl }
  const [emailSetupPending, setEmailSetupPending] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingBackupCodes, setPendingBackupCodes] = useState(null);

  // "Trust this device" — devices that skip the MFA challenge on login for
  // 30 days. See src/pages/MfaChallengePage.jsx for where the grant is
  // created (a checkbox at MFA-verification time).
  const [trustedDevices, setTrustedDevices] = useState(null);
  const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(false);
  const [revokeDeviceTarget, setRevokeDeviceTarget] = useState(null); // { id, device_label } | null
  const [revokingDevice, setRevokingDevice] = useState(false);

  // "Active Sessions" — real logins auth.middleware.js checks on every
  // request (distinct from trusted devices above, which only skip the MFA
  // challenge). Revoking one logs that device out immediately.
  const [sessions, setSessions] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokeSessionTarget, setRevokeSessionTarget] = useState(null); // { id, device_label, isCurrentDevice } | null
  const [revokingSession, setRevokingSession] = useState(false);
  const [banSessionTarget, setBanSessionTarget] = useState(null); // { id, device_label, isCurrentDevice, ip_address } | null
  const [banningSession, setBanningSession] = useState(false);

  // "Blocked Devices" — everything Ban Device above has blocked; Unban
  // reverses it (the device just goes back to logging in normally, it does
  // not restore the old session).
  const [blockedDevices, setBlockedDevices] = useState(null);
  const [blockedDevicesLoading, setBlockedDevicesLoading] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState(null); // { id, ip_address } | null
  const [unbanning, setUnbanning] = useState(false);

  const loadMfaStatus = async () => {
    setMfaLoading(true);
    try {
      const data = await mfaApi.manageStatus();
      setMfaStatus(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMfaLoading(false);
    }
  };

  const loadTrustedDevices = async () => {
    setTrustedDevicesLoading(true);
    try {
      const data = await mfaApi.listTrustedDevices();
      setTrustedDevices(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTrustedDevicesLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await mfaApi.listSessions();
      setSessions(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadBlockedDevices = async () => {
    setBlockedDevicesLoading(true);
    try {
      const data = await mfaApi.listBlockedDevices();
      setBlockedDevices(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBlockedDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'mfa' && !isMsmeUser) {
      if (!mfaStatus) loadMfaStatus();
      if (!trustedDevices) loadTrustedDevices();
      if (!sessions) loadSessions();
      if (!blockedDevices) loadBlockedDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const openRevokeDevice = (device) => setRevokeDeviceTarget(device);
  const closeRevokeDevice = () => setRevokeDeviceTarget(null);

  const confirmRevokeDevice = async () => {
    if (!revokeDeviceTarget) return;
    setRevokingDevice(true);
    try {
      await mfaApi.revokeTrustedDevice(revokeDeviceTarget.id);
      toast.success('Device trust revoked.');
      setRevokeDeviceTarget(null);
      await loadTrustedDevices();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRevokingDevice(false);
    }
  };

  const openRevokeSession = (session) => setRevokeSessionTarget(session);
  const closeRevokeSession = () => setRevokeSessionTarget(null);

  const confirmRevokeSession = async () => {
    if (!revokeSessionTarget) return;
    setRevokingSession(true);
    try {
      await mfaApi.revokeSession(revokeSessionTarget.id);
      // Revoking the row already flagged "This device" on the list is this
      // DSA logging themselves out right now — the backend's own check
      // (comparing the revoked token to the request's own bearer token)
      // would reach the same conclusion, but the list already told us
      // client-side, so there's no need to inspect the response for it.
      if (revokeSessionTarget.isCurrentDevice) {
        toast.success('Signed out of this device.');
        logout();
        return;
      }
      toast.success('Session revoked — that device has been signed out.');
      setRevokeSessionTarget(null);
      await loadSessions();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRevokingSession(false);
    }
  };

  const openBanSession = (session) => setBanSessionTarget(session);
  const closeBanSession = () => setBanSessionTarget(null);

  const confirmBanSession = async () => {
    if (!banSessionTarget) return;
    setBanningSession(true);
    try {
      const result = await mfaApi.banSessionDevice(banSessionTarget.id);
      // Same "logged out, no further usage" rule as revoke — banning your
      // own current device signs you out immediately too, not just the
      // *other* device it was meant for.
      if (banSessionTarget.isCurrentDevice || result?.revokedCurrentDevice) {
        toast.success(result?.message || 'Device blocked and signed out.');
        logout();
        return;
      }
      toast.success(result?.message || 'Device blocked — it can no longer log in to this account.');
      setBanSessionTarget(null);
      await Promise.all([loadSessions(), loadBlockedDevices()]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBanningSession(false);
    }
  };

  const openUnban = (device) => setUnbanTarget(device);
  const closeUnban = () => setUnbanTarget(null);

  const confirmUnban = async () => {
    if (!unbanTarget) return;
    setUnbanning(true);
    try {
      const result = await mfaApi.unbanDevice(unbanTarget.id);
      toast.success(result?.message || 'Device unbanned.');
      setUnbanTarget(null);
      await loadBlockedDevices();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUnbanning(false);
    }
  };

  // "Expires in N days" — computed client-side from the API's expires_at,
  // not stored precomputed (so it stays accurate no matter how long the
  // list has been sitting on screen).
  const daysUntil = (isoDate) => Math.max(0, Math.ceil((new Date(isoDate) - new Date()) / (24 * 60 * 60 * 1000)));

  if (loading) return <LoadingSpinner fullPage />;

  const u = profile || authUser;
  if (!u) return null;

  const isActive = u.status?.toUpperCase() === 'ACTIVE';
  // Matches the backend's PATCH /users/:id role gate exactly (SUPER_ADMIN,
  // DSA_ADMIN, CRED2TECH_MEMBER) — the only roles that can reach EditUserPage
  // for themselves. u.role can be either the raw getMe() shape ({name}) or
  // the flattened string AuthContext produces, so check both.
  const roleName = u.role?.name || u.role;
  const canSelfEdit = ['SUPER_ADMIN', 'DSA_ADMIN', 'CRED2TECH_MEMBER'].includes(roleName);
  // Narrower than canSelfEdit — matches PUT /tenants/:id's role gate, which
  // (unlike PATCH /users/:id) doesn't include CRED2TECH_MEMBER.
  const canEditOrg = ['SUPER_ADMIN', 'DSA_ADMIN'].includes(roleName);

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileSave = async () => {
    if (!isMsmeUser) {
      toast.error('Profile changes for staff accounts are managed by your admin.');
      return;
    }
    setSaving(true);
    try {
      const res = await msmeApi.updateProfile({ name: formData.name, email: formData.email });
      setProfile(prev => ({ ...prev, ...res.data }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handlePasswordSubmit = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordData.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!passwordData.newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (passwordData.newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    try {
      await mfaApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordSuccess('Password changed successfully. Other signed-in devices have been signed out.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    }
  };

  const openStepUp = (action) => setStepUp({ open: true, action, password: '', error: '', loading: false });
  const closeStepUp = () => setStepUp({ open: false, action: null, password: '', error: '', loading: false });

  const submitStepUp = async () => {
    if (!stepUp.password) { setStepUp((s) => ({ ...s, error: 'Enter your password.' })); return; }
    setStepUp((s) => ({ ...s, loading: true, error: '' }));
    try {
      if (stepUp.action === 'totp') {
        const data = await mfaApi.manageTotpInit(stepUp.password);
        setTotpSetup(data);
        setMfaCode('');
      } else if (stepUp.action === 'email') {
        await mfaApi.manageEmailInit(stepUp.password, null);
        setEmailSetupPending(true);
        setMfaCode('');
      } else if (stepUp.action === 'totp-disable') {
        await mfaApi.manageTotpDisable(stepUp.password);
        toast.success('Authenticator app disabled.');
        await loadMfaStatus();
      } else if (stepUp.action === 'email-disable') {
        await mfaApi.manageEmailDisable(stepUp.password);
        toast.success('Email verification disabled.');
        await loadMfaStatus();
      } else if (stepUp.action === 'backup-codes') {
        const data = await mfaApi.manageRegenerateBackupCodes(stepUp.password);
        setPendingBackupCodes(data.backupCodes);
        await loadMfaStatus();
      }
      closeStepUp();
    } catch (err) {
      setStepUp((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
    }
  };

  const confirmTotpSetup = async () => {
    if (!mfaCode.trim()) return;
    setMfaLoading(true);
    try {
      const data = await mfaApi.manageTotpConfirm({ secret: totpSetup.secret, code: mfaCode.trim() });
      toast.success('Authenticator app enabled.');
      if (data.backupCodes) setPendingBackupCodes(data.backupCodes);
      setTotpSetup(null);
      setMfaCode('');
      await loadMfaStatus();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmEmailSetup = async () => {
    if (!mfaCode.trim()) return;
    setMfaLoading(true);
    try {
      const data = await mfaApi.manageEmailConfirm({ code: mfaCode.trim() });
      toast.success('Email verification enabled.');
      if (data.backupCodes) setPendingBackupCodes(data.backupCodes);
      setEmailSetupPending(false);
      setMfaCode('');
      await loadMfaStatus();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMfaLoading(false);
    }
  };

  // Shared "soft pill" input row — replaces the old bare-underline look with
  // a lightly-tinted, generously-padded field that still respects the
  // existing focus/disabled affordances (edit pencil / lock icon) exactly.
  const fieldWrap = (focused, disabled = false) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
    borderRadius: 0, background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(79,70,229,0.035)',
    border: `1px solid ${focused ? 'var(--primary)' : (isDark ? 'rgba(255,255,255,0.07)' : 'var(--outline)')}`,
    boxShadow: focused ? `0 0 0 4px ${isDark ? 'rgba(99,102,241,0.18)' : 'rgba(79,70,229,0.1)'}` : 'none',
    transition: 'border-color 0.3s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s cubic-bezier(0.32,0.72,0,1)',
    opacity: disabled ? 0.65 : 1,
  });
  const fieldInput = { width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--on-surface)', fontSize: 14.5, fontWeight: 600, padding: 0 };
  const fieldLabel = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--on-muted)', opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden',
    }}>
      {/* Ambient background glow — fixed, never on a scrolling container, so
          it never repaints on scroll. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: -180, right: -160, width: 520, height: 520, borderRadius: '50%',
          background: isDark ? 'radial-gradient(circle, rgba(99,102,241,0.16), transparent 70%)' : 'radial-gradient(circle, rgba(79,70,229,0.10), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -220, left: -140, width: 480, height: 480, borderRadius: '50%',
          background: isDark ? 'radial-gradient(circle, rgba(56,189,248,0.10), transparent 70%)' : 'radial-gradient(circle, rgba(56,189,248,0.06), transparent 70%)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '84px 16px 32px' : '32px 32px 40px', overflow: 'auto', flex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
          style={{ maxWidth: 1180 }}
        >
          {/* ─── Identity header ─── */}
          <Shell isDark={isDark} style={{ marginBottom: isMobile ? 24 : 32 }}>
            <Core isDark={isDark} style={{
              padding: isMobile ? '22px 20px' : '28px 32px',
              display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 22, flexWrap: 'wrap',
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: isMobile ? 60 : 72, height: isMobile ? 60 : 72, borderRadius: 0,
                  background: `linear-gradient(145deg, var(--primary), ${isDark ? '#8b5cf6' : '#6366F1'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isDark ? '0 12px 30px rgba(99,102,241,0.35)' : '0 12px 30px rgba(79,70,229,0.25)',
                }}>
                  <span style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#fff' }}>{initials(u.name)}</span>
                </div>
                <div style={{
                  position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 0,
                  background: isActive ? 'var(--success)' : 'var(--error)', border: `3px solid var(--surface)`,
                }} />
              </div>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: isMobile ? 19 : 23, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>{u.name || 'Your Account'}</h1>
                  {roleName && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--primary)',
                      background: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(79,70,229,0.1)', padding: '4px 10px', borderRadius: 0,
                    }}>{toTitleCase(roleName)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                  {u.email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--on-muted)', opacity: 0.75 }}>
                      <Mail size={12} strokeWidth={1.75} /> {u.email}
                    </span>
                  )}
                  {u.mobile && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--on-muted)', opacity: 0.75 }}>
                      <Smartphone size={12} strokeWidth={1.75} /> {u.mobile}
                    </span>
                  )}
                  {u.tenant?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--on-muted)', opacity: 0.75 }}>
                      <Briefcase size={12} strokeWidth={1.75} /> {u.tenant.name}
                    </span>
                  )}
                </div>
              </div>
            </Core>
          </Shell>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 20 : 36 }}>

            {/* ─── Left Sidebar ─── */}
            <div style={{ width: isMobile ? '100%' : 264, flexShrink: 0 }}>
              <Shell isDark={isDark} style={{ padding: isMobile ? 6 : 8 }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 4, overflowX: isMobile ? 'auto' : 'visible' }}>
                  {sidebarItems.map(item => {
                    const Icon = item.icon;
                    const isItemActive = activeSection === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        style={{
                          position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 0, cursor: 'pointer', flexShrink: 0,
                          minWidth: isMobile ? 200 : 'auto',
                        }}
                      >
                        {isItemActive && (
                          <motion.div
                            layoutId="profile-sidebar-active"
                            transition={{ duration: 0.45, ease: EASE }}
                            style={{
                              position: 'absolute', inset: 0, borderRadius: 0,
                              background: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(79,70,229,0.08)',
                              border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(79,70,229,0.14)'}`,
                            }}
                          />
                        )}
                        <div style={{
                          position: 'relative', width: 36, height: 36, borderRadius: 0, flexShrink: 0,
                          background: isItemActive ? 'var(--primary)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(79,70,229,0.06)'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isItemActive ? (isDark ? '0 6px 16px rgba(99,102,241,0.4)' : '0 6px 16px rgba(79,70,229,0.28)') : 'none',
                          transition: 'background 0.3s cubic-bezier(0.32,0.72,0,1)',
                        }}>
                          <Icon size={17} strokeWidth={1.75} color={isItemActive ? '#fff' : 'var(--on-muted)'} />
                        </div>
                        <div style={{ position: 'relative', minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--on-surface)', margin: 0, whiteSpace: 'nowrap' }}>{item.label}</p>
                          {!isMobile && <p style={{ fontSize: 10.5, color: 'var(--on-muted)', opacity: 0.65, margin: '2px 0 0' }}>{item.subtitle}</p>}
                        </div>
                        {isItemActive && !isMobile && (
                          <ChevronRight size={14} strokeWidth={2} color="var(--primary)" style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Shell>
            </div>

            {/* ─── Right Content ─── */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <SectionEnter sectionKey={activeSection}>
              {activeSection === 'profile' ? (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 26px' }}>Personal Information</h2>

                  {/* Form Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {isMsmeUser ? (
                      <>
                        {/* Full Name */}
                        <div>
                          <label style={fieldLabel}>Full Name</label>
                          <div style={fieldWrap(focusedField === 'name')}>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={e => handleChange('name', e.target.value)}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="Enter your full name"
                              title="Click to edit your full name"
                              style={{ ...fieldInput, cursor: 'text' }}
                            />
                            <Pencil size={14} strokeWidth={1.75} color="var(--on-muted)" style={{ flexShrink: 0, opacity: 0.6 }} />
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <label style={fieldLabel}>Email Address</label>
                          <div style={fieldWrap(focusedField === 'email')}>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={e => handleChange('email', e.target.value)}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="name@company.com"
                              title="Click to edit your email address"
                              style={{ ...fieldInput, cursor: 'text' }}
                            />
                            <Pencil size={14} strokeWidth={1.75} color="var(--on-muted)" style={{ flexShrink: 0, opacity: 0.6 }} />
                          </div>
                        </div>

                        {/* Mobile */}
                        <div>
                          <label style={fieldLabel}>Mobile Number</label>
                          <div style={fieldWrap(false, true)}>
                            <input
                              type="tel"
                              value={formData.mobile}
                              disabled
                              title="Your mobile number is your verified login identity and can't be changed here."
                              style={{ ...fieldInput, color: 'var(--on-muted)', cursor: 'not-allowed' }}
                            />
                            <Lock size={14} strokeWidth={1.75} color="var(--on-muted)" style={{ flexShrink: 0, opacity: 0.6 }} />
                          </div>
                        </div>

                        {/* Update Button */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                          <TravelingBorderButton
                            onClick={handleProfileSave}
                            size="sm"
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Update'}
                          </TravelingBorderButton>
                          <TravelingBorderButton
                            onClick={() => setShowLogoutConfirm(true)}
                            size="sm"
                            color="red"
                            showIcon={false}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <LogOut size={16} strokeWidth={1.75} />
                              Logout
                            </div>
                          </TravelingBorderButton>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Staff accounts are managed through the single Edit User
                            screen (/users/:id/edit) — these fields are read-only
                            display here, not a second, separately-wired edit form. */}
                        <div>
                          <label style={fieldLabel}>Full Name</label>
                          <div style={fieldWrap(false)}>
                            <p style={{ ...fieldInput, margin: 0 }}>{u.name || '—'}</p>
                          </div>
                        </div>
                        <div>
                          <label style={fieldLabel}>Email Address</label>
                          <div style={fieldWrap(false)}>
                            <p style={{ ...fieldInput, margin: 0 }}>{u.email || '—'}</p>
                          </div>
                        </div>
                        <div>
                          <label style={fieldLabel}>Mobile Number</label>
                          <div style={fieldWrap(false, true)}>
                            <p style={{ ...fieldInput, margin: 0, color: 'var(--on-muted)' }}>{u.mobile || '—'}</p>
                            <Lock size={14} strokeWidth={1.75} color="var(--on-muted)" style={{ flexShrink: 0, opacity: 0.6 }} title="Your mobile number is your verified login identity and can't be changed here." />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                          {canSelfEdit ? (
                            <TravelingBorderButton onClick={() => navigate(`/users/${u.id}/edit`)} size="sm" solid showIcon={false}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pencil size={14} strokeWidth={1.75} /> Edit Profile</div>
                            </TravelingBorderButton>
                          ) : (
                            <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.75, margin: 0 }}>Contact your administrator to update your account information.</p>
                          )}
                          <TravelingBorderButton
                            onClick={() => setShowLogoutConfirm(true)}
                            size="sm"
                            color="red"
                            showIcon={false}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <LogOut size={16} strokeWidth={1.75} />
                              Logout
                            </div>
                          </TravelingBorderButton>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : activeSection === 'password' ? (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 26px' }}>Change Password</h2>

                  {passwordError && (
                    <div style={{ padding: '13px 16px', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 0, fontSize: 13, marginBottom: 18, fontWeight: 600 }}>
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div style={{ padding: '13px 16px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 0, fontSize: 13, marginBottom: 18, fontWeight: 600 }}>
                      {passwordSuccess}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Decoy field: Chrome's password manager scans the whole
                        page (not just this section) for a "username" input to
                        pair with the nearby password fields below, and — with
                        nothing else to grab — was reaching for the sidebar's
                        search box (always mounted, regardless of which
                        Profile tab is open) and silently filling it with the
                        saved email. This absorbs that targeting instead. */}
                    <input type="text" name="username" autoComplete="username" value={u.email || ''} readOnly
                      style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
                      aria-hidden="true" tabIndex={-1} />
                    <div>
                      <label style={fieldLabel}>Current Password</label>
                      <div style={fieldWrap(false)}>
                        <input
                          type="password"
                          name="current-password"
                          autoComplete="off"
                          value={passwordData.currentPassword}
                          onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                          placeholder="Enter current password"
                          style={fieldInput}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => navigate('/forgot-password', { state: { email: u.email } })}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}
                        >
                          Forgot your password?
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={fieldLabel}>New Password</label>
                      <div style={fieldWrap(false)}>
                        <input
                          type="password"
                          name="new-password"
                          autoComplete="new-password"
                          value={passwordData.newPassword}
                          onChange={e => handlePasswordChange('newPassword', e.target.value)}
                          placeholder="Enter new password"
                          style={fieldInput}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={fieldLabel}>Confirm New Password</label>
                      <div style={fieldWrap(false)}>
                        <input
                          type="password"
                          name="confirm-new-password"
                          autoComplete="new-password"
                          value={passwordData.confirmPassword}
                          onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                          placeholder="Confirm new password"
                          style={fieldInput}
                        />
                      </div>
                    </div>

                    <div style={{ width: '250px', marginTop: 6 }}>
                      <TravelingBorderButton
                        onClick={handlePasswordSubmit}
                        size="sm"
                        className="w-full"
                      >
                        Change Password
                      </TravelingBorderButton>
                    </div>
                  </div>
                </>
              ) : activeSection === 'mfa' ? (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 8px' }}>Two-Factor Authentication</h2>
                  <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.75, margin: '0 0 26px' }}>
                    Required for every account. At least one method must always stay enabled.
                  </p>

                  {pendingBackupCodes && (
                    <Shell isDark={isDark} style={{ marginBottom: 20 }}>
                      <Core isDark={isDark} style={{ padding: 22 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 4px' }}>Save your new backup codes</p>
                        <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.75, margin: '0 0 14px' }}>Each code works once. Your old codes no longer work.</p>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 16, borderRadius: 0,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(79,70,229,0.04)', marginBottom: 14,
                        }}>
                          {pendingBackupCodes.map((c) => (
                            <span key={c} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, textAlign: 'center', color: 'var(--on-surface)' }}>{c}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <TravelingBorderButton size="sm" onClick={() => { navigator.clipboard?.writeText(pendingBackupCodes.join('\n')); toast.success('Copied.'); }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Copy size={14} strokeWidth={1.75} /> Copy</div>
                          </TravelingBorderButton>
                          <TravelingBorderButton size="sm" onClick={() => setPendingBackupCodes(null)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} strokeWidth={1.75} /> Saved it</div>
                          </TravelingBorderButton>
                        </div>
                      </Core>
                    </Shell>
                  )}

                  {mfaLoading && !mfaStatus ? (
                    <LoadingSpinner size={24} />
                  ) : mfaStatus && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Authenticator App */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ padding: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: totpSetup ? 18 : 0, flexWrap: 'wrap', gap: 10 }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Authenticator App</p>
                              <p style={{ fontSize: 12, color: mfaStatus.mfaTotpEnabled ? 'var(--success)' : 'var(--on-muted)', opacity: mfaStatus.mfaTotpEnabled ? 1 : 0.7, margin: '3px 0 0', fontWeight: 600 }}>
                                {mfaStatus.mfaTotpEnabled ? 'Enabled' : 'Not set up'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <TravelingBorderButton size="sm" onClick={() => openStepUp('totp')}>
                                {mfaStatus.mfaTotpEnabled ? 'Change device' : 'Set up'}
                              </TravelingBorderButton>
                              {mfaStatus.mfaTotpEnabled && (
                                <TravelingBorderButton size="sm" color="red" onClick={() => openStepUp('totp-disable')}>Disable</TravelingBorderButton>
                              )}
                            </div>
                          </div>
                          {totpSetup && (
                            <div>
                              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
                                <img src={totpSetup.qrCodeDataUrl} alt="TOTP QR code" style={{ width: 140, height: 140, borderRadius: 0, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--outline)'}` }} />
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.75, margin: '0 0 6px' }}>Scan with your authenticator app, or enter manually:</p>
                                  <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, wordBreak: 'break-all', color: 'var(--on-surface)' }}>{totpSetup.secret}</p>
                                </div>
                              </div>
                              <div style={{ marginBottom: 16 }}>
                                <OtpInput length={6} value={mfaCode} onChange={setMfaCode} onEnter={confirmTotpSetup} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <TravelingBorderButton size="sm" onClick={confirmTotpSetup} disabled={mfaLoading}>Confirm</TravelingBorderButton>
                                <button onClick={() => { setTotpSetup(null); setMfaCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </Core>
                      </Shell>

                      {/* Email Code */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ padding: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: emailSetupPending ? 18 : 0, flexWrap: 'wrap', gap: 10 }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Email Code</p>
                              <p style={{ fontSize: 12, color: mfaStatus.mfaEmailEnabled ? 'var(--success)' : 'var(--on-muted)', opacity: mfaStatus.mfaEmailEnabled ? 1 : 0.7, margin: '3px 0 0', fontWeight: 600 }}>
                                {mfaStatus.mfaEmailEnabled ? `Enabled · ${mfaStatus.email}` : 'Not set up'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <TravelingBorderButton size="sm" onClick={() => openStepUp('email')}>
                                {mfaStatus.mfaEmailEnabled ? 'Re-verify' : 'Set up'}
                              </TravelingBorderButton>
                              {mfaStatus.mfaEmailEnabled && (
                                <TravelingBorderButton size="sm" color="red" onClick={() => openStepUp('email-disable')}>Disable</TravelingBorderButton>
                              )}
                            </div>
                          </div>
                          {emailSetupPending && (
                            <>
                              <div style={{ marginBottom: 16, marginTop: 16 }}>
                                <OtpInput length={6} value={mfaCode} onChange={setMfaCode} onEnter={confirmEmailSetup} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <TravelingBorderButton size="sm" onClick={confirmEmailSetup} disabled={mfaLoading}>Confirm</TravelingBorderButton>
                                <button onClick={() => { setEmailSetupPending(false); setMfaCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </>
                          )}
                        </Core>
                      </Shell>

                      {/* Backup codes */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Backup Codes</p>
                            <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.75, margin: '3px 0 0' }}>{mfaStatus.remainingBackupCodes} unused code(s) remaining</p>
                          </div>
                          <TravelingBorderButton size="sm" onClick={() => openStepUp('backup-codes')}>Regenerate</TravelingBorderButton>
                        </Core>
                      </Shell>

                      {/* Active Sessions — real logins auth.middleware.js checks on
                          every request (distinct from Trusted Devices below,
                          which only ever skips the MFA challenge). Revoking one
                          signs that device out immediately, not just at its next
                          login. Reuses Trusted Devices' exact card/row layout. */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ padding: 20 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Active Sessions</p>
                          <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.7, margin: '0 0 16px' }}>
                            Everywhere you're currently signed in. Revoking a session signs that device out right away.
                          </p>
                          {sessionsLoading && !sessions ? (
                            <LoadingSpinner size={20} />
                          ) : !sessions || sessions.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.7, margin: 0 }}>No active sessions found.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {sessions.map((s) => (
                                <DeviceRow
                                  key={s.id}
                                  isDark={isDark}
                                  icon={<OsIcon userAgent={s.user_agent} size={17} color="var(--on-muted)" />}
                                  title={s.device_label || 'Unknown device'}
                                  badge={s.isCurrentDevice && (
                                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 0 }}>
                                      This device
                                    </span>
                                  )}
                                  subtitle={`Last active ${formatDateTime(s.last_activity_at)} · Signed in ${formatDateTime(s.created_at)}${s.location ? ` · ${s.location}` : ''}${s.ip_address ? ` · ${s.ip_address}` : ''}`}
                                  actions={
                                    <>
                                      <IconAction icon={Trash2} color="var(--error)" onClick={() => openRevokeSession(s)} title={s.isCurrentDevice ? 'Sign out of this device' : 'Revoke this session'} />
                                      <IconAction icon={Ban} color="#b91c1c" onClick={() => openBanSession(s)} title="Revoke and block this device's IP from ever logging in again" disabled={!s.ip_address} />
                                    </>
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </Core>
                      </Shell>

                      {/* Blocked Devices — everything Ban Device above has
                          blocked, with an Unban option to reverse it. */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ padding: 20 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Blocked Devices</p>
                          <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.7, margin: '0 0 16px' }}>
                            Devices you've banned can't log in to this account at all, even with the correct password.
                          </p>
                          {blockedDevicesLoading && !blockedDevices ? (
                            <LoadingSpinner size={20} />
                          ) : !blockedDevices || blockedDevices.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.7, margin: 0 }}>No blocked devices.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {blockedDevices.map((b) => (
                                <DeviceRow
                                  key={b.id}
                                  isDark={isDark}
                                  icon={<Ban size={17} strokeWidth={1.75} color="#b91c1c" />}
                                  title={b.ip_address}
                                  subtitle={`Blocked ${formatDateTime(b.created_at)}`}
                                  actions={<TravelingBorderButton onClick={() => openUnban(b)} size="sm">Unban</TravelingBorderButton>}
                                />
                              ))}
                            </div>
                          )}
                        </Core>
                      </Shell>

                      {/* Trusted Devices */}
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ padding: 20 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Trusted Devices</p>
                          <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.7, margin: '0 0 16px' }}>
                            Devices you've chosen to trust skip the MFA challenge on login for 30 days.
                          </p>
                          {trustedDevicesLoading && !trustedDevices ? (
                            <LoadingSpinner size={20} />
                          ) : !trustedDevices || trustedDevices.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.7, margin: 0 }}>No trusted devices yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {trustedDevices.map((d) => (
                                <DeviceRow
                                  key={d.id}
                                  isDark={isDark}
                                  icon={<OsIcon userAgent={d.user_agent} size={17} color="var(--on-muted)" />}
                                  title={d.device_label || 'Unknown device'}
                                  badge={d.isCurrentDevice && (
                                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 0 }}>
                                      This device
                                    </span>
                                  )}
                                  subtitle={`Last used ${formatDateTime(d.last_used_at)} · Added ${formatDateTime(d.created_at)} · Expires in ${daysUntil(d.expires_at)} day${daysUntil(d.expires_at) === 1 ? '' : 's'}${d.ip_address ? ` · ${d.ip_address}` : ''}`}
                                  actions={<IconAction icon={Trash2} color="var(--error)" onClick={() => openRevokeDevice(d)} title="Revoke trust for this device" />}
                                />
                              ))}
                            </div>
                          )}
                        </Core>
                      </Shell>
                    </div>
                  )}
                </>
              ) : activeSection === 'additional' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Additional Information</h2>
                    </div>
                    {canSelfEdit && (
                      <TravelingBorderButton onClick={() => navigate(`/users/${u.id}/edit`)} size="sm" solid showIcon={false}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} strokeWidth={1.75} /> Edit</div>
                      </TravelingBorderButton>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.75, margin: '8px 0 26px' }}>
                    {canSelfEdit ? 'Account, role, and hierarchy details — edit via the button above.' : 'Read-only account, role, and hierarchy details. Contact your administrator to make changes.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <InfoCard icon={Briefcase} title="Role & Access" isDark={isDark}>
                      <InfoRow isDark={isDark} label="Platform Role" value={toTitleCase(u.role?.name) || '—'} />
                      <InfoRow isDark={isDark} label="Role ID" value={u.role_id ?? '—'} mono last />
                    </InfoCard>

                    <InfoCard icon={Network} title="Hierarchy & Organization" isDark={isDark}>
                      <InfoRow isDark={isDark} label="Organization" value={u.tenant?.name || '—'} />
                      <InfoRow isDark={isDark} label="Hierarchy Level" value={u.hierarchy_level ?? '—'} />
                      <InfoRow isDark={isDark} label="Hierarchy Path" value={formatHierarchyPath(u.hierarchy_path) || 'Root'} />
                      <InfoRow isDark={isDark} label="Manager ID" value={u.manager_id ? `#${u.manager_id}` : '—'} mono last />
                    </InfoCard>

                    {canEditOrg && (
                      <Shell isDark={isDark}>
                        <Core isDark={isDark} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Organization compliance details</p>
                            <p style={{ fontSize: 12, color: 'var(--on-muted)', opacity: 0.7, margin: '3px 0 0' }}>GST, PAN, company type, and registered address</p>
                          </div>
                          <TravelingBorderButton onClick={() => navigate('/organization')} size="sm" solid showIcon={false}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} strokeWidth={1.75} /> Edit</div>
                          </TravelingBorderButton>
                        </Core>
                      </Shell>
                    )}

                    <InfoCard icon={Clock} title="Session Information" isDark={isDark}>
                      <InfoRow isDark={isDark} label="Account Created" value={formatDateTime(u.created_at)} last />
                    </InfoCard>
                  </div>
                </>
              ) : activeSection === 'subscription' ? (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 4px' }}>Subscription</h2>
                  <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.75, margin: '0 0 26px' }}>
                    Your Virtual Workspace plan, billing details, and upgrade or plan-management options.
                  </p>
                  {/* Self-contained — fetches its own status, offers subscribe/switch-plan/cancel. Same component OrganizationProfilePage uses. */}
                  <VirtualWorkspaceSubscriptionCard />
                </>
              ) : activeSection === 'notifications' ? (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 4px' }}>Push Notifications</h2>
                  <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.75, margin: '0 0 24px' }}>
                    Receive browser push notifications for in-app alerts. You can change this in your browser settings at any time.
                  </p>

                  <Shell isDark={isDark}>
                    <Core isDark={isDark} style={{ padding: 24 }}>
                      {!pushSupported ? (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <Bell size={18} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>
                              Push notifications not supported
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--on-muted)' }}>
                              Your browser or device doesn't support push notifications. Try a modern browser like Chrome or Firefox.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <Bell size={18} color="var(--primary)" style={{ marginTop: 3, flexShrink: 0 }} />
                            <div>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>
                                Browser Push Notifications
                              </p>
                              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--on-muted)' }}>
                                {pushEnabled
                                  ? 'You will receive push notifications even when this tab is in the background.'
                                  : notifPermission === 'denied'
                                  ? 'Notifications are blocked in your browser. Allow them in your browser site settings to enable push.'
                                  : 'Enable to receive push notifications when you are not viewing this tab.'}
                              </p>
                            </div>
                          </div>

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              cursor: pushLoading ? 'wait' : 'pointer',
                              opacity: pushLoading ? 0.6 : 1,
                              flexShrink: 0,
                            }}
                            aria-busy={pushLoading}
                          >
                            <input
                              type="checkbox"
                              checked={pushEnabled}
                              onChange={handleTogglePush}
                              disabled={pushLoading || notifPermission === 'denied'}
                              style={{ display: 'none' }}
                            />
                            <div
                              style={{
                                width: 42,
                                height: 24,
                                borderRadius: 12,
                                background: pushEnabled ? 'var(--primary)' : 'var(--border)',
                                border: `1px solid ${pushEnabled ? 'var(--primary)' : 'var(--border)'}`,
                                position: 'relative',
                                transition: 'background 0.2s',
                                flexShrink: 0,
                              }}
                            >
                              {pushLoading ? (
                                <Loader2
                                  size={16}
                                  color="#fff"
                                  style={{ position: 'absolute', top: 3, left: 13, animation: 'spin 1s linear infinite' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    background: '#fff',
                                    position: 'absolute',
                                    top: 2,
                                    left: pushEnabled ? 20 : 2,
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                  }}
                                />
                              )}
                            </div>
                            {pushLoading && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Updating...</span>}
                          </label>
                        </div>
                      )}
                    </Core>
                  </Shell>

                  <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--on-muted)', opacity: 0.65 }}>
                    In-app notifications (the bell icon in the top bar) are always active when you are signed in.
                  </p>
                </>
              ) : null}
              </SectionEnter>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Logout Confirmation Popup */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <ConfirmModal
            isDark={isDark}
            icon={LogOut}
            iconColor="var(--error)"
            title="Confirm Logout"
            message="Are you sure you want to logout? You will need to sign in again to access your account."
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={() => { logout(); setShowLogoutConfirm(false); }}
            confirmLabel="Logout"
            confirmColor="red"
          />
        )}
      </AnimatePresence>

      {/* MFA Step-Up Password Confirmation */}
      <AnimatePresence>
        {stepUp.open && (
          <ModalShell isDark={isDark} onDismiss={stepUp.loading ? undefined : closeStepUp}>
            <div style={{ textAlign: 'center' }}>
              <ModalIconBadge icon={Shield} color="var(--primary)" isDark={isDark} />
              <ModalTitle isDark={isDark}>Confirm your password</ModalTitle>
              <p style={{ fontSize: 13.5, color: 'var(--on-muted)', opacity: 0.85, margin: '0 0 18px' }}>
                For your security, re-enter your password to continue.
              </p>
              {stepUp.error && (
                <div style={{ padding: '10px 14px', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 0, fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'left' }}>
                  {stepUp.error}
                </div>
              )}
              <div style={{ ...fieldWrap(false), marginBottom: 22 }}>
                <input
                  type="password"
                  autoFocus
                  value={stepUp.password}
                  onChange={(e) => setStepUp((s) => ({ ...s, password: e.target.value, error: '' }))}
                  onKeyDown={(e) => e.key === 'Enter' && submitStepUp()}
                  placeholder="Current password"
                  style={fieldInput}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeStepUp} size="sm" disabled={stepUp.loading}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={submitStepUp} size="sm" disabled={stepUp.loading}>
                  {stepUp.loading ? 'Confirming...' : 'Confirm'}
                </TravelingBorderButton>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Revoke Trusted Device Confirmation — plain confirm, not step-up
          gated, since revoking only ever increases security going forward
          (forces MFA back on for that device) rather than removing a
          control, unlike disabling TOTP/email above. */}
      <AnimatePresence>
        {revokeDeviceTarget && (
          <ConfirmModal
            isDark={isDark}
            icon={Trash2}
            iconColor="var(--error)"
            title="Revoke this device?"
            message={`${revokeDeviceTarget.device_label || 'This device'} will need to verify MFA again on its next login.`}
            onCancel={closeRevokeDevice}
            onConfirm={confirmRevokeDevice}
            confirmLabel="Revoke"
            loadingLabel="Revoking..."
            confirmColor="red"
            loading={revokingDevice}
          />
        )}
      </AnimatePresence>

      {/* Revoke Session Confirmation — same plain-confirm treatment as
          Trusted Devices above, but this one signs the device out right
          away (and, if it's the current one, signs this tab out too). */}
      <AnimatePresence>
        {revokeSessionTarget && (
          <ConfirmModal
            isDark={isDark}
            icon={Trash2}
            iconColor="var(--error)"
            title={revokeSessionTarget.isCurrentDevice ? 'Sign out of this device?' : 'Revoke this session?'}
            message={revokeSessionTarget.isCurrentDevice
              ? "You'll be signed out immediately and need to log in again."
              : `${revokeSessionTarget.device_label || 'This device'} will be signed out immediately.`}
            onCancel={closeRevokeSession}
            onConfirm={confirmRevokeSession}
            confirmLabel="Revoke"
            loadingLabel="Revoking..."
            confirmColor="red"
            loading={revokingSession}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banSessionTarget && (
          <ConfirmModal
            isDark={isDark}
            icon={Ban}
            iconColor="#b91c1c"
            title="Ban this device?"
            message={`${banSessionTarget.isCurrentDevice
              ? "You'll be signed out immediately, and this device's IP address won't be able to log in to this account again — even with the correct password."
              : `${banSessionTarget.device_label || 'This device'} will be signed out immediately, and its IP address${banSessionTarget.ip_address ? ` (${banSessionTarget.ip_address})` : ''} won't be able to log in to this account again — even with the correct password.`} Use this if you believe someone else has your credentials.`}
            onCancel={closeBanSession}
            onConfirm={confirmBanSession}
            confirmLabel="Ban Device"
            loadingLabel="Banning..."
            confirmColor="red"
            loading={banningSession}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unbanTarget && (
          <ConfirmModal
            isDark={isDark}
            icon={ShieldCheck}
            iconColor="var(--success)"
            title="Unban this device?"
            message={`${unbanTarget.ip_address} will be able to log in to this account again with the correct password.`}
            onCancel={closeUnban}
            onConfirm={confirmUnban}
            confirmLabel="Unban"
            loadingLabel="Unbanning..."
            confirmColor="primary"
            loading={unbanning}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
