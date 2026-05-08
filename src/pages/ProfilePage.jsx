import React, { useEffect, useState } from 'react';
import { User, Shield, LogOut } from 'lucide-react';
import { getMe } from '../api/authService';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, getInitials, formatHierarchyPath } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import TravelingBorderButton from '../components/TravelingBorderButton';

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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    street: '',
    apt: '',
    city: '',
    state: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const sidebarItems = [
    { id: 'profile', icon: User, label: 'Account Information', subtitle: 'Change your Account information' },
    { id: 'password', icon: Shield, label: 'Password', subtitle: 'Change your Password' },
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
        mobile: u.mobile || '',
        street: u.address?.street || '',
        apt: u.address?.apt || u.address?.house_number || '',
        city: u.address?.city || '',
        state: u.address?.state || ''
      });
    }
  }, [profile, authUser]);

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
    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    try {
      // Add API call to change password here
      setPasswordSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError('Failed to change password. Please try again.');
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '80px 16px 24px' : '24px 32px 24px 60px', overflow: 'auto', flex: 1 }}>
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
                <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Full Name</label>
                <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                      padding: 0, focusRing: 0
                    }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Email Address</label>
                <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="name@company.com"
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                      padding: 0, focusRing: 0
                    }}
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Mobile Number</label>
                <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={e => handleChange('mobile', e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                      padding: 0, focusRing: 0
                    }}
                  />
                </div>
              </div>

              {/* Street & Apt */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Street Number</label>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={e => handleChange('street', e.target.value)}
                      placeholder="123"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                        padding: 0, focusRing: 0
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Apt / House Number</label>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                    <input
                      type="text"
                      value={formData.apt}
                      onChange={e => handleChange('apt', e.target.value)}
                      placeholder="A-45"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                        padding: 0, focusRing: 0
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* City & State */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>City</label>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => handleChange('city', e.target.value)}
                      placeholder="Mumbai"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                        padding: 0, focusRing: 0
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>State</label>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => handleChange('state', e.target.value)}
                      placeholder="Maharashtra"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600,
                        padding: 0, focusRing: 0
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Update Button */}
              <div style={{ display: 'flex', gap: 12 }}>
                <TravelingBorderButton
                  onClick={() => console.log('Update profile')}
                  size="sm"
                >
                  Update
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
                    <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Current Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
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
                    <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>New Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
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
                    <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Confirm New Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                      <input
                        type="password"
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
            ) : activeSection === 'additional' ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 24px' }}>Additional Information</h2>

                {/* Role & Access */}
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 16px' }}>Role & Access</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Platform Role</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{toTitleCase(u.role?.name) || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Role ID</label>
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
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>DSA Organization</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.dsa?.name || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Hierarchy Level</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{u.hierarchy_level || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Hierarchy Path</label>
                      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: isDark ? '1px solid #374151' : '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>{formatHierarchyPath(u.hierarchy_path) || 'Root'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Manager ID</label>
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
                      <label style={{ display: 'block', fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6 }}>Account Created</label>
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
                color: isDark ? '#94a3b8' : '#4a5d73',
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
    </div>
  );
};

export default ProfilePage;

