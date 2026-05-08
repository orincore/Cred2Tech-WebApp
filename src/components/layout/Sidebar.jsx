import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Search, ChevronUp, MoreHorizontal, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NAV_ITEMS } from '../../constants/navItems';
import Badge from '../ui/Badge';
import { getInitials } from '../../utils/helpers';
import Logo from '../Logo';

const Sidebar = ({ isOpen, isMobile, showMobile, onClose }) => {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [searchQuery, setSearchQuery] = useState('');

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.some((r) => hasRole(r))) return false;
    if (searchQuery && !item.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Determine sidebar visibility
  const sidebarVisible = isMobile ? showMobile : isOpen;
  
  // Handle link click for mobile - close sidebar
  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
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
        <MoreHorizontal size={16} color="#94a3b8" />
      </div>

      {/* Search Bar & Theme Toggle */}
      <div style={{ padding: '0 12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          border: '1px solid var(--outline)',
          borderRadius: 8,
          padding: '6px 10px',
          flex: 1,
          minWidth: 0,
        }}>
          <Search size={14} color="var(--on-muted)" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 12,
              color: 'var(--on-surface)',
              flex: 1,
              width: '100%',
            }}
          />
        </div>

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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-low)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
          }}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      {/* Nav section label */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ChevronUp size={12} color="#94a3b8" />
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }} className="custom-scrollbar">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              onClick={item.disabled ? (e) => e.preventDefault() : handleLinkClick}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{
                opacity: item.disabled ? 0.45 : 1,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} color={isActive ? 'var(--on-surface)' : 'var(--on-muted)'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'var(--bg)',
                      color: 'var(--on-muted)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
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
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/users/${user?.id}`)}
      title="View profile"
      >
        {/* Avatar */}
        <div style={{
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
        }}>
          {getInitials(user?.name || 'U')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
            {user?.email || 'user@cred2tech.com'}
          </p>
        </div>
        <MoreHorizontal size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
      </div>
    </aside>
  );
};

export default Sidebar;
