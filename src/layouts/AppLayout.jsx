import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import MsmeSidebar from '../components/layout/MsmeSidebar';
import VirtualWorkspaceGraceBanner from '../components/VirtualWorkspaceGraceBanner';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials } from '../utils/helpers';
import { TOAST_OPTIONS } from '../constants/toastOptions';
import PageTour from '../components/tour/PageTour';

// First-time-visit walkthrough of the app shell itself (nav, search, theme
// toggle, profile row) — separate step lists for desktop (sidebar is always
// open, so every nav element is addressable directly) and mobile (the
// sidebar starts off-canvas, so this instead points at the header controls
// that are always on screen rather than at individual nav links).
const DESKTOP_NAV_STEPS = [
  { target: '[data-tour="sidebar-search"]', title: 'Search the menu', description: 'Type here to instantly filter the navigation list below down to matching sections, handy once your sidebar has a lot of items.' },
  { target: '[data-tour="sidebar-nav-list"]', title: 'Your navigation', description: 'Every screen you have access to lives here. What you see is based on your role, so your list may look different from a teammate’s.' },
  { target: '[data-tour="sidebar-theme-toggle"]', title: 'Light / dark mode', description: 'Switch the whole app between light and dark themes. Your choice is remembered on this device.' },
  { target: '[data-tour="sidebar-feedback"]', title: 'Report an issue', description: 'Spotted a bug or have feedback? Tap here to send it straight to the Cred2Tech team from any screen.' },
  { target: '[data-tour="sidebar-profile"]', title: 'Your account', description: 'Your name and email are shown here. Tap this row any time to open your Profile and manage your account, password, and security settings.' },
  { target: '[data-tour="sidebar-collapse-toggle"]', title: 'Collapse the sidebar', description: 'Use this handle to hide the sidebar and get more room for the page content. Click it again any time to bring the navigation back.' },
];

const MOBILE_NAV_STEPS = [
  { target: '[data-tour="mobile-menu-button"]', title: 'Open the menu', description: 'Tap this icon any time to open your navigation. Every screen you have access to is listed there, based on your role.', placement: 'bottom' },
  { target: '[data-tour="mobile-theme-toggle"]', title: 'Light / dark mode', description: 'Switch between light and dark themes. Your choice is remembered on this device.', placement: 'bottom' },
  { target: '[data-tour="mobile-avatar"]', title: 'Your account', description: 'Open the menu and tap your avatar at the bottom any time to reach your Profile, password, and security settings.', placement: 'bottom' },
];

const AppLayout = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // MSME borrowers reach the shared /cases/* journey pages through this
  // layout — render their portal sidebar so the chrome matches the /msme
  // pages exactly, instead of the DSA nav (which their role would blank out).
  const isMsme = user?.role === 'MSME_CUSTOMER' || localStorage.getItem('roleName') === 'MSME_CUSTOMER';
  const msmeLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('roleName');
    window.location.href = '/msme/login';
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
        setShowMobileSidebar(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setShowMobileSidebar(!showMobileSidebar);
    } else {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  return (
    <div className="app-shell" style={{ position: 'relative' }}>
      {/* Mobile Overlay */}
      {isMobile && showMobileSidebar && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 150,
          }}
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
      
      {isMsme ? (
        <MsmeSidebar
          isOpen={isSidebarOpen}
          isMobile={isMobile}
          showMobile={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          user={user}
          onLogout={msmeLogout}
        />
      ) : (
        <Sidebar
          isOpen={isSidebarOpen}
          isMobile={isMobile}
          showMobile={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
        />
      )}
      
      <div 
        className="app-main" 
        style={{ 
          marginLeft: !isMobile && isSidebarOpen ? 'var(--sidebar-width)' : '0',
          transition: 'margin-left 0.3s ease',
          width: '100%',
        }}
      >
        {/* Sidebar Toggle Button - Desktop */}
        {!isMobile && (
          <button
            data-tour="sidebar-collapse-toggle"
            onClick={toggleSidebar}
            style={{
              position: 'fixed',
              top: '80px',
              left: isSidebarOpen ? 'var(--sidebar-width)' : '0',
              zIndex: 200,
              width: '24px',
              height: '48px',
              background: 'var(--surface)',
              border: '1px solid var(--outline)',
              borderLeft: isSidebarOpen ? 'none' : '1px solid var(--outline)',
              borderRadius: '0 8px 8px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: isSidebarOpen ? '2px 2px 8px rgba(0,0,0,0.1)' : '-2px 2px 8px rgba(0,0,0,0.1)',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'var(--on-surface)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-low)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
            title={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          >
            {isSidebarOpen ? '<' : '>'}
          </button>
        )}
        
        {/* Mobile Header */}
        {isMobile && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--outline)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            {/* Menu Button */}
            <button
              data-tour="mobile-menu-button"
              onClick={toggleSidebar}
              style={{
                width: '40px',
                height: '40px',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '20px', color: 'var(--on-surface)' }}>
                {showMobileSidebar ? '✕' : '☰'}
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Theme Toggle */}
              <button
                data-tour="mobile-theme-toggle"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--surface-low)',
                  border: '1px solid var(--outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--on-surface)',
                }}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              {/* User Avatar */}
              <div data-tour="mobile-avatar" style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--on-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--surface)',
                border: '2px solid var(--outline)',
              }}>
                {getInitials(user?.name || 'U')}
              </div>
            </div>
          </div>
        )}
        
        {!isMsme && <VirtualWorkspaceGraceBanner />}
        <main className="page-content" style={{ padding: isMobile ? 0 : 0 }}>
          <Outlet />
        </main>
      </div>
      {/* Every feedback-eligible role now gets the trigger inline in its own
          sidebar header (next to the logo) — DSA roles in Sidebar.jsx, MSME
          customers in MsmeSidebar.jsx — so no floating overlay is needed here. */}
      <Toaster position="top-right" toastOptions={TOAST_OPTIONS} />
      {/* First-time app-shell walkthrough — PageTour itself already gates on
          DSA_ADMIN/DSA_MEMBER/SUB_DSA (see DSA_TOUR_ROLES), so this never
          shows for the MSME sidebar rendered above. */}
      {/* Deliberately a shorter delay than a page-specific PageTour's default
          (900ms) — both this and e.g. DashboardPage's own tour mount at
          roughly the same instant on first load, and whichever's timer fires
          first claims the single-tour lock (see PageTour.jsx). Firing this
          one first makes the order deterministic and sensible (orient to
          the app shell, then the page you're on) instead of a race. */}
      {!isMsme && <PageTour pageKey="global-nav" steps={isMobile ? MOBILE_NAV_STEPS : DESKTOP_NAV_STEPS} delay={450} />}
    </div>
  );
};

export default AppLayout;
