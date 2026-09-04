import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Search, ChevronUp, MoreHorizontal, MessageSquarePlus, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NAV_ITEMS } from '../../constants/navItems';
import { FEEDBACK_SUBMITTER_ROLES } from '../../constants/roles';
import Badge from '../ui/Badge';
import { getInitials } from '../../utils/helpers';
import Logo from '../Logo';
import FeedbackModal from '../feedback/FeedbackModal';
import { ticketService } from '../../api/ticketService';
import { contactSubmissionService } from '../../api/contactSubmissionService';
import { demoRequestService } from '../../api/demoRequestService';

const TICKET_ADMIN_ROLES = ['SUPER_ADMIN', 'CRED2TECH_MEMBER'];
const UNREAD_POLL_MS = 30000;

const Sidebar = ({ isOpen, isMobile, showMobile, onClose }) => {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const canSubmitFeedback = FEEDBACK_SUBMITTER_ROLES.includes(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Ticket unread badge — only ever updates when the admin explicitly marks
  // a ticket as read (see AdminTicketsListPage/AdminTicketDetailPage), never
  // just by opening a list/detail page. Polled rather than pushed, since
  // this app has no generic notification stream to piggyback on.
  const [unreadTicketCount, setUnreadTicketCount] = useState(0);
  useEffect(() => {
    if (!TICKET_ADMIN_ROLES.some((r) => hasRole(r))) return;
    let cancelled = false;
    const poll = () => ticketService.unreadCount().then((c) => { if (!cancelled) setUnreadTicketCount(c); }).catch(() => {});
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [hasRole]);

  // Same polling pattern as the ticket badge above, for the Website Leads
  // nav item — combines both tabs on AdminContactSubmissionsPage (Contact
  // Requests + Demo Requests) into one badge count.
  const [unreadContactCount, setUnreadContactCount] = useState(0);
  const [unreadDemoCount, setUnreadDemoCount] = useState(0);
  useEffect(() => {
    if (!TICKET_ADMIN_ROLES.some((r) => hasRole(r))) return;
    let cancelled = false;
    const poll = () => {
      contactSubmissionService.unreadCount().then((c) => { if (!cancelled) setUnreadContactCount(c); }).catch(() => {});
      demoRequestService.unreadCount().then((c) => { if (!cancelled) setUnreadDemoCount(c); }).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [hasRole]);

  // Virtual Workspace gate — an unsubscribed sourcing-partner tenant only
  // sees whatever's in virtual_workspace_free_nav_item_ids (Dashboard/Wallet/
  // Support/Profile by default, admin-editable on SuperadminPricingPage).
  // Scoped explicitly to DSA roles so SUPER_ADMIN/CRED2TECH_MEMBER nav is
  // never affected by a tenant's VW flag, regardless of what it says.
  const isDsaRole = hasRole(['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA']);
  const isVirtualWorkspaceGated = isDsaRole && !user?.virtual_workspace_active;
  const freeNavItemIds = user?.virtual_workspace_free_nav_item_ids || [];

  const visibleItems = NAV_ITEMS
    .filter((item) => {
      if (item.roles && !item.roles.some((r) => hasRole(r))) return false;
      if (isVirtualWorkspaceGated && !freeNavItemIds.includes(item.id)) return false;
      if (searchQuery && !item.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .map((item) => {
      if (item.id === 'admin-tickets' && unreadTicketCount > 0) return { ...item, badge: String(unreadTicketCount) };
      if (item.id === 'admin-contact-submissions' && (unreadContactCount + unreadDemoCount) > 0) {
        return { ...item, badge: String(unreadContactCount + unreadDemoCount) };
      }
      return item;
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
      minHeight: '100dvh',
      height: '100dvh',
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
        {canSubmitFeedback && (
          <button
            onClick={() => setIsFeedbackOpen(true)}
            title="Submit feedback or report an issue"
            aria-label="Submit feedback or report an issue"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--outline)',
              color: '#94a3b8',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MessageSquarePlus size={16} />
          </button>
        )}
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
            // type="search" (not "text") is what actually stops Chrome's
            // saved-profile autofill (name/email/address) here — Chrome
            // routinely ignores autocomplete="off" on plain text inputs for
            // its profile-data heuristic, but doesn't apply that heuristic
            // to type="search" fields. WebkitAppearance neutralizes the
            // native search-field styling (rounded corners, built-in clear
            // button) so it still matches this custom look.
            type="search"
            name="nav-search-query"
            id="nav-search"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 12,
              color: 'var(--on-surface)',
              flex: 1,
              width: '100%',
              WebkitAppearance: 'none',
              appearance: 'none',
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
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }} className="custom-scrollbar">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          // NavLink's default matching is prefix-based, so a parent path like
          // "/users" stays highlighted on any nested route ("/users/create")
          // unless told otherwise. That's fine when no other nav item owns
          // that nested route (e.g. "/customers" should stay active on
          // "/customers/add"), but when a sibling item exists for the nested
          // path itself, prefix matching makes both items light up together —
          // force an exact match here so only the sibling that actually owns
          // the current route is highlighted.
          const hasSiblingSubRoute = NAV_ITEMS.some((other) => other.path !== item.path && other.path.startsWith(`${item.path}/`));
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/' || hasSiblingSubRoute}
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
      onClick={() => navigate('/profile')}
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
      {canSubmitFeedback && (
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      )}
    </aside>
  );
};

export default Sidebar;
