import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, LogOut, ChevronUp, Sun, Moon, ExternalLink } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { MSME_NAV_ITEMS } from '../../constants/navItems';
import { getInitials } from '../../utils/helpers';
import Logo from '../Logo';

// `user` and `onLogout` come in as props (not from MsmeAuthContext) so this
// same sidebar can render inside AppLayout on the shared /cases/* journey
// pages, where MsmeAuthProvider isn't mounted — keeping the MSME chrome
// identical across the whole flow.
const MsmeSidebar = ({ isOpen, isMobile, showMobile, onClose, user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const sidebarVisible = isMobile ? showMobile : isOpen;

  const handleLinkClick = () => {
    if (isMobile && onClose) onClose();
  };

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--sidebar-bg)',
      minHeight: '100vh',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: sidebarVisible ? 0 : 'calc(-1 * var(--sidebar-width))',
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: isMobile ? 200 : 100,
      borderRight: '1px solid var(--sidebar-border)',
      transition: 'left 0.3s ease',
      boxShadow: isMobile && sidebarVisible ? '4px 0 16px rgba(0,0,0,0.3)' : 'none',
    }}>
      {/* Header / Logo */}
      <div style={{
        padding: '24px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Logo size="medium" />
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--on-surface)',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-low)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      

      {/* Nav section label */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ChevronUp size={12} color="#94a3b8" />
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }} className="custom-scrollbar">
        {MSME_NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              {item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="nav-item"
                >
                  <Icon size={16} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ExternalLink size={13} color="var(--on-muted)" style={{ flexShrink: 0, opacity: 0.6 }} />
                </a>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} color={isActive ? 'var(--on-surface)' : 'var(--on-muted)'} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              )}
            </motion.div>
          );
        })}
      </nav>

      {/* User section */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Avatar */}
        <div
          onClick={() => { navigate('/msme/profile'); handleLinkClick(); }}
          title="View profile"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--on-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--surface)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {getInitials(user?.name || 'U')}
        </div>
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => { navigate('/msme/profile'); handleLinkClick(); }}
          title="View profile"
        >
          <p style={{
            color: 'var(--on-surface)',
            fontSize: 13,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}>
            {user?.name || 'User'}
          </p>
          <p style={{
            color: 'var(--on-muted)',
            fontSize: 11,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {user?.mobile ? `+91 ${user.mobile}` : (user?.email || '')}
          </p>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--on-muted)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--on-muted)';
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
};

export default MsmeSidebar;
