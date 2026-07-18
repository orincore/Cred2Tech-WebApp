import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/ui/EmptyState';
import PlatformDashboardView from './dashboard/PlatformDashboardView';
import DsaDashboardView from './dashboard/DsaDashboardView';
import { Sun, Moon, CloudSun, RefreshCw, LayoutDashboard } from 'lucide-react';

const DSA_SIDE_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'mtd', label: 'MTD' },
  { value: 'ytd', label: 'YTD' },
];

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile, isTablet };
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const [period, setPeriod] = useState('mtd');
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastUpdated(new Date());
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  }, []);

  // Auto-refresh every 60s, matching the reference dashboard's behavior.
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshKey((k) => k + 1);
      setLastUpdated(new Date());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isDsaSide = DSA_SIDE_ROLES.includes(user?.role);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div
        style={{
          borderBottom: '1px solid var(--outline)',
          padding: isMobile ? '80px 16px 16px' : '24px 24px 20px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            {isSuperAdmin ? 'Platform Analytics' : 'Organization Overview'}
          </p>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            {greeting}, {user?.name?.split(' ')[0] || 'there'}{' '}
            {hour < 12 ? <Sun size={20} color="#f59e0b" /> : hour < 17 ? <CloudSun size={20} color="#f59e0b" /> : <Moon size={20} color="#6366f1" />}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '4px 0 0' }}>
            Last updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Auto-refreshes every 60s
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--outline)', borderRadius: 0, overflow: 'hidden' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: period === p.value ? 'var(--primary)' : 'transparent',
                  color: period === p.value ? '#fff' : 'var(--on-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh"
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--outline)',
              borderRadius: 0,
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} color="var(--on-surface)" style={spinning ? { animation: 'spin 0.7s linear infinite' } : undefined} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>
        {isSuperAdmin ? (
          <PlatformDashboardView period={period} refreshKey={refreshKey} isMobile={isMobile} isTablet={isTablet} />
        ) : isDsaSide ? (
          <DsaDashboardView period={period} refreshKey={refreshKey} isMobile={isMobile} isTablet={isTablet} />
        ) : (
          <EmptyState
            icon={LayoutDashboard}
            title="No dashboard configured"
            description="There isn't a dashboard view set up for your role yet. Use the sidebar to navigate to the sections you have access to."
          />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
