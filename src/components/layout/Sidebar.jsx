import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from '../../constants/navItems';
import Badge from '../ui/Badge';
import { getInitials } from '../../utils/helpers';

const Sidebar = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.some((r) => hasRole(r))) return false;
    return true;
  });

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--sidebar-bg)',
      minHeight: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      borderRight: '1px solid var(--sidebar-border)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 18px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 34,
          height: 34,
          background: 'var(--primary)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
        }}>
          <Zap size={18} color="white" />
        </div>
        <div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Platform UI</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>RBAC Management</p>
        </div>
      </div>

      {/* Nav section label */}
      <div style={{ padding: '18px 20px 6px' }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
                opacity: item.disabled ? 0.45 : 1,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                textDecoration: 'none',
                position: 'relative',
              })}
              className={({ isActive }) => isActive ? 'nav-active' : ''}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: -10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: '60%',
                      background: 'var(--primary-light)',
                      borderRadius: '0 4px 4px 0',
                    }} />
                  )}
                  <Icon size={17} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.1)',
                      color: 'var(--sidebar-text)',
                      padding: '2px 7px',
                      borderRadius: 99,
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
        padding: '14px 14px',
        borderTop: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* Avatar */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: 'white',
          flexShrink: 0,
          letterSpacing: '0.03em',
        }}>
          {getInitials(user?.name || 'U')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: 'var(--sidebar-text-active)',
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user?.name || 'User'}
          </p>
          <Badge type="role" value={user?.role} />
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleLogout}
          title="Log out"
          style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
