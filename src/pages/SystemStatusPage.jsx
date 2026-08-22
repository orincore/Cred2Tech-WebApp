import React, { useState, useEffect, useCallback } from 'react';
import { Server, Database, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../api/axiosInstance';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatDateTime } from '../utils/helpers';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

const POLL_INTERVAL_MS = 20000;

const SystemStatusPage = () => {
  const { isMobile } = useResponsive();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/system-status');
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the backend to check status.');
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const isPrimary = status?.server?.role === 'primary';
  const isBackup = status?.server?.role === 'backup';
  const dbConnected = status?.database?.connected;
  const viaRelay = status?.database?.via === 'dr-relay';

  return (
    <div style={{ padding: isMobile ? '64px 14px 24px' : '24px 60px 40px' }}>
      <PageHeader
        title="System Status"
        subtitle="Live infrastructure state — which server is currently active, and real RDS connectivity."
      />

      {error && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)',
          padding: 12, marginBottom: 20, fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          title="Active Server"
          value={loading ? undefined : (isPrimary ? 'Primary (EC2)' : isBackup ? 'Backup (Hostinger)' : 'Unknown')}
          subtitle={status?.server?.region ? `Region: ${status.server.region}` : undefined}
          icon={Server}
          color={isPrimary ? 'var(--success)' : isBackup ? 'var(--warning)' : 'var(--text-tertiary)'}
          loading={loading}
        />
        <StatCard
          title="Database Connection"
          value={loading ? undefined : (dbConnected ? 'Connected' : 'Unreachable')}
          subtitle={dbConnected ? `${status.database.latencyMs}ms via ${viaRelay ? 'DR relay' : 'direct'}` : status?.database?.error}
          icon={Database}
          color={dbConnected ? 'var(--success)' : 'var(--error)'}
          loading={loading}
        />
        <StatCard
          title="Failover Path"
          value={loading ? undefined : (viaRelay ? 'Via DR Relay' : 'Direct to RDS')}
          subtitle={isBackup ? 'Hostinger only reaches RDS through the relay during a declared failover' : 'EC2 always talks to RDS directly'}
          icon={viaRelay ? ShieldAlert : ShieldCheck}
          color={viaRelay ? 'var(--warning)' : 'var(--success)'}
          loading={loading}
        />
      </div>

      {/* Explanatory panel: what "backup" actually means here, since it's not
          obvious from a single status word — this box only shows when we're
          actually looking at the backup, since it's irrelevant otherwise. */}
      {isBackup && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid var(--warning)',
          padding: 16, marginBottom: 24, fontSize: 13, color: 'var(--on-surface)',
        }}>
          <strong>This process is running on the Hostinger DR standby, not the primary EC2 instance.</strong> That
          only happens during a declared failover — Route 53 has already redirected traffic here because the EC2
          primary's health check failed. RDS access for this box is temporary and will close automatically once
          EC2 recovers.
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid var(--outline)', paddingTop: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
          {lastChecked ? `Last checked: ${formatDateTime(lastChecked.toISOString())}` : '—'}
          {' · '}Refreshes automatically every {POLL_INTERVAL_MS / 1000}s
        </span>
        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0,
            fontSize: 12, fontWeight: 700, color: 'var(--on-surface)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh now
        </button>
      </div>
    </div>
  );
};

export default SystemStatusPage;
