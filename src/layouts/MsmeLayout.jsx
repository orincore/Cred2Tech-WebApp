import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MsmeAuthProvider, useMsmeAuth } from '../context/MsmeAuthContext';
import MsmeSidebar from '../components/layout/MsmeSidebar';
import { getInitials } from '../utils/helpers';
import { TOAST_OPTIONS } from '../constants/toastOptions';

// Shell for the MSME direct portal. Mirrors AppLayout's responsive sidebar
// behavior; the /msme/login route renders bare (no chrome).
const LayoutContent = () => {
  const { user, logout } = useMsmeAuth();
  const location = useLocation();
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

  const isLoginPage = location.pathname.includes('/login');
  if (isLoginPage) {
    return <Outlet />;
  }

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

      <MsmeSidebar
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        showMobile={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
        user={user}
        onLogout={logout}
      />

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
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-low)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
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
            <button
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

            <div style={{
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
        )}

        <main className="page-content" style={{ paddingTop: isMobile ? 60 : 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const MsmeLayout = () => (
  <MsmeAuthProvider>
    <LayoutContent />
    <Toaster position="top-right" toastOptions={TOAST_OPTIONS} />
  </MsmeAuthProvider>
);

export default MsmeLayout;
