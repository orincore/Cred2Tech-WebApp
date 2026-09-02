import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, ShieldCheck, LogOut, Check, Copy, Pencil, Lock, Trash2, Briefcase, Network, Clock, Ban } from 'lucide-react';
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
import PageHeader from '../components/ui/PageHeader';

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

// Read-only "key: value" summary card for Additional Information — replaces
// the old underlined-input-look-alike rows (which visually implied these
// fields were editable, when they never were) with a plain label/value row
// layout, grouped under a titled card matching the style already used for
// the MFA method cards elsewhere on this page.
const InfoCard = ({ icon: Icon, title, children }) => (
  <div style={{ border: '1px solid var(--outline)', overflow: 'hidden' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
      background: 'var(--surface)', borderBottom: '1px solid var(--outline)',
    }}>
      <Icon size={15} color="var(--on-muted)" />
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{title}</span>
    </div>
    <div>{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono = false, last = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    padding: '12px 16px', borderBottom: last ? 'none' : '1px solid var(--outline)',
  }}>
    <span style={{ fontSize: 13, color: 'var(--on-muted)' }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>
      {value}
    </span>
  </div>
);

const ProfilePage = () => {
  const { user: authUser, token, logout } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isMobile } = useResponsive();
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
  const sidebarItems = isMsmeUser
    ? [{ id: 'profile', icon: User, label: 'Account Information', subtitle: 'Change your Account information' }]
    : [
        { id: 'profile', icon: User, label: 'Account Information', subtitle: 'Change your Account information' },
        { id: 'password', icon: Shield, label: 'Password', subtitle: 'Change your Password' },
        { id: 'mfa', icon: ShieldCheck, label: 'Two-Factor Auth', subtitle: 'Manage your MFA methods' },
        { id: 'additional', icon: User, label: 'Additional Info', subtitle: 'View your account details' },
      ];

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

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '80px 16px 24px' : '24px 24px 24px', overflow: 'auto', flex: 1 }}>
        <PageHeader title="My Profile" subtitle="Manage your account settings and preferences" />
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 20 : 40, maxWidth: 1200 }}>
          
          {/* ─── Left Sidebar ─── */}
          <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0 }}>
            {/* Sidebar Menu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sidebarItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <div 
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 12,
                      background: isActive ? 'var(--surface)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ 
                      width: 36, height: 36, borderRadius: 10,
                      background: isActive ? 'var(--primary)' : 'var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={18} color={isActive ? '#fff' : 'var(--on-muted)'} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0' }}>{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Right Content ─── */}
          <div style={{ flex: 1 }}>
            {activeSection === 'profile' ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 24px' }}>Personal Information</h2>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {isMsmeUser ? (
                    <>
                      {/* Full Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Full Name</label>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12,
                          borderBottom: focusedField === 'name' ? '1px solid var(--primary)' : (isDark ? '1px solid #374151' : '1px solid #e5e7eb'),
                          transition: 'border-color 0.15s'
                        }}>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={e => handleChange('name', e.target.value)}
                            onFocus={() => setFocusedField('name')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="Enter your full name"
                            title="Click to edit your full name"
                            style={{
                              width: '100%', background: 'transparent', border: 'none', outline: 'none',
                              color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                              padding: 0, cursor: 'text'
                            }}
                          />
                          <Pencil size={14} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Email Address</label>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12,
                          borderBottom: focusedField === 'email' ? '1px solid var(--primary)' : (isDark ? '1px solid #374151' : '1px solid #e5e7eb'),
                          transition: 'border-color 0.15s'
                        }}>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={e => handleChange('email', e.target.value)}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="name@company.com"
                            title="Click to edit your email address"
                            style={{
                              width: '100%', background: 'transparent', border: 'none', outline: 'none',
                              color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                              padding: 0, cursor: 'text'
                            }}
                          />
                          <Pencil size={14} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Mobile */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Mobile Number</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>
                          <input
                            type="tel"
                            value={formData.mobile}
                            disabled
                            title="Your mobile number is your verified login identity and can't be changed here."
                            style={{
                              width: '100%', background: 'transparent', border: 'none', outline: 'none',
                              color: 'var(--on-muted)', fontSize: 15, fontWeight: 600,
                              padding: 0, cursor: 'not-allowed'
                            }}
                          />
                          <Lock size={14} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Update Button */}
                      <div style={{ display: 'flex', gap: 12 }}>
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
                            <LogOut size={16} />
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
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Full Name</label>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0, paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>{u.name || '—'}</p>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Email Address</label>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0, paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>{u.email || '—'}</p>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Mobile Number</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>
                          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-muted)', margin: 0, flex: 1 }}>{u.mobile || '—'}</p>
                          <Lock size={14} color="var(--on-muted)" style={{ flexShrink: 0 }} title="Your mobile number is your verified login identity and can't be changed here." />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        {canSelfEdit ? (
                          <TravelingBorderButton onClick={() => navigate(`/users/${u.id}/edit`)} size="sm" solid showIcon={false}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pencil size={14} /> Edit Profile</div>
                          </TravelingBorderButton>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>Contact your administrator to update your account information.</p>
                        )}
                        <TravelingBorderButton
                          onClick={() => setShowLogoutConfirm(true)}
                          size="sm"
                          color="red"
                          showIcon={false}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <LogOut size={16} />
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
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 24px' }}>Change Password</h2>

                {passwordError && (
                  <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div style={{ padding: '12px 16px', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {passwordSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Current Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
                        name="current-password"
                        autoComplete="off"
                        value={passwordData.currentPassword}
                        onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                        placeholder="Enter current password"
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                          padding: 0, focusRing: 0
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password', { state: { email: u.email } })}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>New Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
                        name="new-password"
                        autoComplete="new-password"
                        value={passwordData.newPassword}
                        onChange={e => handlePasswordChange('newPassword', e.target.value)}
                        placeholder="Enter new password"
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                          padding: 0, focusRing: 0
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Confirm New Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
                        name="confirm-new-password"
                        autoComplete="new-password"
                        value={passwordData.confirmPassword}
                        onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                        placeholder="Confirm new password"
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                          padding: 0, focusRing: 0
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ width: '250px' }}>
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
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 8px' }}>Two-Factor Authentication</h2>
                <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>
                  Required for every account. At least one method must always stay enabled.
                </p>

                {pendingBackupCodes && (
                  <div style={{ padding: 20, background: 'var(--surface)', border: '1px solid var(--outline)', marginBottom: 24 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 4px' }}>Save your new backup codes</p>
                    <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 14px' }}>Each code works once. Your old codes no longer work.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 14, background: 'var(--bg)', border: '1px solid var(--outline)', marginBottom: 12 }}>
                      {pendingBackupCodes.map((c) => (
                        <span key={c} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, textAlign: 'center', color: 'var(--on-surface)' }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <TravelingBorderButton size="sm" onClick={() => { navigator.clipboard?.writeText(pendingBackupCodes.join('\n')); toast.success('Copied.'); }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Copy size={14} /> Copy</div>
                      </TravelingBorderButton>
                      <TravelingBorderButton size="sm" onClick={() => setPendingBackupCodes(null)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Saved it</div>
                      </TravelingBorderButton>
                    </div>
                  </div>
                )}

                {mfaLoading && !mfaStatus ? (
                  <LoadingSpinner size={24} />
                ) : mfaStatus && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Authenticator App */}
                    <div style={{ padding: 18, border: '1px solid var(--outline)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: totpSetup ? 16 : 0 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Authenticator App</p>
                          <p style={{ fontSize: 12, color: mfaStatus.mfaTotpEnabled ? '#16a34a' : 'var(--on-muted)', margin: '2px 0 0', fontWeight: 600 }}>
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
                          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                            <img src={totpSetup.qrCodeDataUrl} alt="TOTP QR code" style={{ width: 140, height: 140, border: '1px solid var(--outline)' }} />
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 6px' }}>Scan with your authenticator app, or enter manually:</p>
                              <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, wordBreak: 'break-all', color: 'var(--on-surface)' }}>{totpSetup.secret}</p>
                            </div>
                          </div>
                          <div style={{ marginBottom: 14 }}>
                            <OtpInput length={6} value={mfaCode} onChange={setMfaCode} onEnter={confirmTotpSetup} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <TravelingBorderButton size="sm" onClick={confirmTotpSetup} disabled={mfaLoading}>Confirm</TravelingBorderButton>
                            <button onClick={() => { setTotpSetup(null); setMfaCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email Code */}
                    <div style={{ padding: 18, border: '1px solid var(--outline)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: emailSetupPending ? 16 : 0 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Email Code</p>
                          <p style={{ fontSize: 12, color: mfaStatus.mfaEmailEnabled ? '#16a34a' : 'var(--on-muted)', margin: '2px 0 0', fontWeight: 600 }}>
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
                          <div style={{ marginBottom: 14 }}>
                            <OtpInput length={6} value={mfaCode} onChange={setMfaCode} onEnter={confirmEmailSetup} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <TravelingBorderButton size="sm" onClick={confirmEmailSetup} disabled={mfaLoading}>Confirm</TravelingBorderButton>
                            <button onClick={() => { setEmailSetupPending(false); setMfaCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Backup codes */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 18, border: '1px solid var(--outline)' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Backup Codes</p>
                        <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>{mfaStatus.remainingBackupCodes} unused code(s) remaining</p>
                      </div>
                      <TravelingBorderButton size="sm" onClick={() => openStepUp('backup-codes')}>Regenerate</TravelingBorderButton>
                    </div>

                    {/* Active Sessions — real logins auth.middleware.js checks on
                        every request (distinct from Trusted Devices below,
                        which only ever skips the MFA challenge). Revoking one
                        signs that device out immediately, not just at its next
                        login. Reuses Trusted Devices' exact card/row layout. */}
                    <div style={{ padding: 18, border: '1px solid var(--outline)' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Active Sessions</p>
                      <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 14px' }}>
                        Everywhere you're currently signed in. Revoking a session signs that device out right away.
                      </p>
                      {sessionsLoading && !sessions ? (
                        <LoadingSpinner size={20} />
                      ) : !sessions || sessions.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>No active sessions found.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {sessions.map((s) => (
                            <div key={s.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--outline)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <OsIcon userAgent={s.user_agent} size={20} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {s.device_label || 'Unknown device'}
                                    {s.isCurrentDevice && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                                        This device
                                      </span>
                                    )}
                                  </p>
                                  <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '3px 0 0' }}>
                                    Last active {formatDateTime(s.last_activity_at)} · Signed in {formatDateTime(s.created_at)}
                                    {s.location ? ` · ${s.location}` : ''}
                                    {s.ip_address ? ` · ${s.ip_address}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <button
                                  onClick={() => openRevokeSession(s)}
                                  title={s.isCurrentDevice ? 'Sign out of this device' : 'Revoke this session'}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 6, display: 'flex' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button
                                  onClick={() => openBanSession(s)}
                                  title="Revoke and block this device's IP from ever logging in again"
                                  disabled={!s.ip_address}
                                  style={{
                                    background: 'none', border: 'none', cursor: s.ip_address ? 'pointer' : 'not-allowed',
                                    color: s.ip_address ? '#b91c1c' : 'var(--on-muted)', opacity: s.ip_address ? 1 : 0.4,
                                    padding: 6, display: 'flex',
                                  }}
                                >
                                  <Ban size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Blocked Devices — everything Ban Device above has
                        blocked, with an Unban option to reverse it. */}
                    <div style={{ padding: 18, border: '1px solid var(--outline)' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Blocked Devices</p>
                      <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 14px' }}>
                        Devices you've banned can't log in to this account at all, even with the correct password.
                      </p>
                      {blockedDevicesLoading && !blockedDevices ? (
                        <LoadingSpinner size={20} />
                      ) : !blockedDevices || blockedDevices.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>No blocked devices.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {blockedDevices.map((b) => (
                            <div key={b.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--outline)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <Ban size={20} color="#b91c1c" style={{ flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
                                    {b.ip_address}
                                  </p>
                                  <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '3px 0 0' }}>
                                    Blocked {formatDateTime(b.created_at)}
                                  </p>
                                </div>
                              </div>
                              <TravelingBorderButton onClick={() => openUnban(b)} size="sm">Unban</TravelingBorderButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trusted Devices */}
                    <div style={{ padding: 18, border: '1px solid var(--outline)' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 2px' }}>Trusted Devices</p>
                      <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 14px' }}>
                        Devices you've chosen to trust skip the MFA challenge on login for 30 days.
                      </p>
                      {trustedDevicesLoading && !trustedDevices ? (
                        <LoadingSpinner size={20} />
                      ) : !trustedDevices || trustedDevices.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>No trusted devices yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {trustedDevices.map((d) => (
                            <div key={d.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--outline)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <OsIcon userAgent={d.user_agent} size={20} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {d.device_label || 'Unknown device'}
                                    {d.isCurrentDevice && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                                        This device
                                      </span>
                                    )}
                                  </p>
                                  <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '3px 0 0' }}>
                                    Last used {formatDateTime(d.last_used_at)} · Added {formatDateTime(d.created_at)} · Expires in {daysUntil(d.expires_at)} day{daysUntil(d.expires_at) === 1 ? '' : 's'}
                                    {d.ip_address ? ` · ${d.ip_address}` : ''}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => openRevokeDevice(d)}
                                title="Revoke trust for this device"
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 6, flexShrink: 0, display: 'flex' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : activeSection === 'additional' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Additional Information</h2>
                  {canSelfEdit && (
                    <TravelingBorderButton onClick={() => navigate(`/users/${u.id}/edit`)} size="sm" solid showIcon={false}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} /> Edit</div>
                    </TravelingBorderButton>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>
                  {canSelfEdit ? 'Account, role, and hierarchy details — edit via the button above.' : 'Read-only account, role, and hierarchy details. Contact your administrator to make changes.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <InfoCard icon={Briefcase} title="Role & Access">
                    <InfoRow label="Platform Role" value={toTitleCase(u.role?.name) || '—'} />
                    <InfoRow label="Role ID" value={u.role_id ?? '—'} mono last />
                  </InfoCard>

                  <InfoCard icon={Network} title="Hierarchy & Organization">
                    <InfoRow label="Organization" value={u.tenant?.name || '—'} />
                    <InfoRow label="Hierarchy Level" value={u.hierarchy_level ?? '—'} />
                    <InfoRow label="Hierarchy Path" value={formatHierarchyPath(u.hierarchy_path) || 'Root'} />
                    <InfoRow label="Manager ID" value={u.manager_id ? `#${u.manager_id}` : '—'} mono last />
                  </InfoCard>

                  {canEditOrg && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', border: '1px solid var(--outline)' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Organization compliance details</p>
                        <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>GST, PAN, company type, and registered address</p>
                      </div>
                      <TravelingBorderButton onClick={() => navigate('/organization')} size="sm" solid showIcon={false}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} /> Edit</div>
                      </TravelingBorderButton>
                    </div>
                  )}

                  <InfoCard icon={Clock} title="Session Information">
                    <InfoRow label="Account Created" value={formatDateTime(u.created_at)} last />
                  </InfoCard>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.15s ease'
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff',
            borderRadius: 20,
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32,
            maxWidth: 400,
            width: '90%',
            animation: 'slideUp 0.2s ease'
          }}>
            <div style={{ textAlign: 'center' }}>
              {/* Warning Icon */}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <LogOut size={32} color="#dc2626" />
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: 20,
                fontWeight: 700,
                color: isDark ? '#e6edf7' : '#0a1628',
                marginBottom: 8
              }}>
                Confirm Logout
              </h3>

              {/* Message */}
              <p style={{
                fontSize: 14,
                color: 'var(--on-muted)',
                marginBottom: 24
              }}>
                Are you sure you want to logout? You will need to sign in again to access your account.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton
                  onClick={() => setShowLogoutConfirm(false)}
                  size="sm"
                >
                  Cancel
                </TravelingBorderButton>
                <TravelingBorderButton
                  onClick={() => {
                    logout();
                    setShowLogoutConfirm(false);
                  }}
                  size="sm"
                  color="red"
                >
                  Logout
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MFA Step-Up Password Confirmation */}
      {stepUp.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff', borderRadius: 20, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32, maxWidth: 400, width: '90%', animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isDark ? 'rgba(79, 70, 229, 0.15)' : 'rgba(79, 70, 229, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Shield size={32} color="#4f46e5" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e6edf7' : '#0a1628', marginBottom: 8 }}>
                Confirm your password
              </h3>
              <p style={{ fontSize: 14, color: 'var(--on-muted)', marginBottom: 20 }}>
                For your security, re-enter your password to continue.
              </p>
              {stepUp.error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'left' }}>
                  {stepUp.error}
                </div>
              )}
              <input
                type="password"
                autoFocus
                value={stepUp.password}
                onChange={(e) => setStepUp((s) => ({ ...s, password: e.target.value, error: '' }))}
                onKeyDown={(e) => e.key === 'Enter' && submitStepUp()}
                placeholder="Current password"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '0 0 12px',
                  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', background: 'transparent',
                  color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, marginBottom: 24, outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeStepUp} size="sm" disabled={stepUp.loading}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={submitStepUp} size="sm" disabled={stepUp.loading}>
                  {stepUp.loading ? 'Confirming...' : 'Confirm'}
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Trusted Device Confirmation — plain confirm, not step-up
          gated, since revoking only ever increases security going forward
          (forces MFA back on for that device) rather than removing a
          control, unlike disabling TOTP/email above. */}
      {revokeDeviceTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff', borderRadius: 20, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32, maxWidth: 400, width: '90%', animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Trash2 size={32} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e6edf7' : '#0a1628', marginBottom: 8 }}>
                Revoke this device?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--on-muted)', marginBottom: 24 }}>
                {revokeDeviceTarget.device_label || 'This device'} will need to verify MFA again on its next login.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeRevokeDevice} size="sm" disabled={revokingDevice}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={confirmRevokeDevice} size="sm" color="red" disabled={revokingDevice}>
                  {revokingDevice ? 'Revoking...' : 'Revoke'}
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Session Confirmation — same plain-confirm treatment as
          Trusted Devices above, but this one signs the device out right
          away (and, if it's the current one, signs this tab out too). */}
      {revokeSessionTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff', borderRadius: 20, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32, maxWidth: 400, width: '90%', animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Trash2 size={32} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e6edf7' : '#0a1628', marginBottom: 8 }}>
                {revokeSessionTarget.isCurrentDevice ? 'Sign out of this device?' : 'Revoke this session?'}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--on-muted)', marginBottom: 24 }}>
                {revokeSessionTarget.isCurrentDevice
                  ? "You'll be signed out immediately and need to log in again."
                  : `${revokeSessionTarget.device_label || 'This device'} will be signed out immediately.`}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeRevokeSession} size="sm" disabled={revokingSession}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={confirmRevokeSession} size="sm" color="red" disabled={revokingSession}>
                  {revokingSession ? 'Revoking...' : 'Revoke'}
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {banSessionTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff', borderRadius: 20, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32, maxWidth: 420, width: '90%', animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isDark ? 'rgba(185, 28, 28, 0.15)' : 'rgba(185, 28, 28, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Ban size={32} color="#b91c1c" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e6edf7' : '#0a1628', marginBottom: 8 }}>
                Ban this device?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--on-muted)', marginBottom: 24 }}>
                {banSessionTarget.isCurrentDevice
                  ? "You'll be signed out immediately, and this device's IP address won't be able to log in to this account again — even with the correct password."
                  : `${banSessionTarget.device_label || 'This device'} will be signed out immediately, and its IP address${banSessionTarget.ip_address ? ` (${banSessionTarget.ip_address})` : ''} won't be able to log in to this account again — even with the correct password.`}
                {' '}Use this if you believe someone else has your credentials.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeBanSession} size="sm" disabled={banningSession}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={confirmBanSession} size="sm" color="red" disabled={banningSession}>
                  {banningSession ? 'Banning...' : 'Ban Device'}
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {unbanTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: isDark ? '#162048' : '#ffffff', borderRadius: 20, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
            padding: 32, maxWidth: 400, width: '90%', animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isDark ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <ShieldCheck size={32} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e6edf7' : '#0a1628', marginBottom: 8 }}>
                Unban this device?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--on-muted)', marginBottom: 24 }}>
                {unbanTarget.ip_address} will be able to log in to this account again with the correct password.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <TravelingBorderButton onClick={closeUnban} size="sm" disabled={unbanning}>Cancel</TravelingBorderButton>
                <TravelingBorderButton onClick={confirmUnban} size="sm" disabled={unbanning}>
                  {unbanning ? 'Unbanning...' : 'Unban'}
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

