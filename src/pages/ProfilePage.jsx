import React, { useEffect, useState } from 'react';
import { User, Shield, ShieldCheck, LogOut, Check, Copy, Pencil, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMe } from '../api/authService';
import { msmeApi } from '../api/msmeService';
import * as mfaApi from '../api/mfaService';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, getInitials, formatHierarchyPath, getErrorMessage } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import TravelingBorderButton from '../components/TravelingBorderButton';
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

const ProfilePage = () => {
  const { user: authUser, token, logout } = useAuth();
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

  useEffect(() => {
    if (activeSection === 'mfa' && !mfaStatus && !isMsmeUser) loadMfaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  if (loading) return <LoadingSpinner fullPage />;

  const u = profile || authUser;
  if (!u) return null;

  const isActive = u.status?.toUpperCase() === 'ACTIVE';

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

                {/* Avatar Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 800, color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {getInitials(u.name)}
                  </div>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Current Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
                        name="current-password"
                        autoComplete="current-password"
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
                          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                            <div style={{ width: 140, paddingBottom: 8, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>
                              <input
                                type="text" inputMode="numeric" maxLength={6}
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="6-digit code"
                                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 700, letterSpacing: 2, padding: 0 }}
                              />
                            </div>
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
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                          <div style={{ width: 140, paddingBottom: 8, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>
                            <input
                              type="text" inputMode="numeric" maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="6-digit code"
                              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 700, letterSpacing: 2, padding: 0 }}
                            />
                          </div>
                          <TravelingBorderButton size="sm" onClick={confirmEmailSetup} disabled={mfaLoading}>Confirm</TravelingBorderButton>
                          <button onClick={() => { setEmailSetupPending(false); setMfaCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
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
                  </div>
                )}
              </>
            ) : activeSection === 'additional' ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 24px' }}>Additional Information</h2>

                {/* Role & Access */}
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 16px' }}>Role & Access</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Platform Role</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{toTitleCase(u.role?.name) || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Role ID</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.role_id || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hierarchy & Organization */}
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 16px' }}>Hierarchy & Organization</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>DSA Organization</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.dsa?.name || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Hierarchy Level</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.hierarchy_level || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Hierarchy Path</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{formatHierarchyPath(u.hierarchy_path) || 'Root'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Manager ID</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.manager_id ? `#${u.manager_id}` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Information */}
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 16px' }}>Session Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--on-muted)', marginBottom: 6 }}>Account Created</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{formatDateTime(u.created_at)}</span>
                      </div>
                    </div>
                  </div>
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
    </div>
  );
};

export default ProfilePage;

