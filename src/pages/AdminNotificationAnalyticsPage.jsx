import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, ExternalLink, TrendingUp, Eye, MousePointer, Clock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const formatDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const BroadcastRow = ({ broadcast, onClick, isSelected }) => (
  <tr
    onClick={() => onClick(broadcast)}
    style={{
      cursor: 'pointer',
      transition: 'background 0.15s',
      background: isSelected ? 'var(--primary-bg)' : 'transparent',
    }}
    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-low)'; }}
    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
  >
    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{broadcast.title}</p>
      <p style={{
        margin: '3px 0 0',
        fontSize: 11,
        color: 'var(--text-muted)',
        maxWidth: 320,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {broadcast.message}
      </p>
    </td>
    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {broadcast.audience || broadcast.target_type || '—'}
    </td>
    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {formatDate(broadcast.created_at)}
    </td>
    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <span>{broadcast.sent ?? broadcast.delivered ?? 0}</span>
        <ExternalLink size={12} />
      </div>
    </td>
  </tr>
);

const StatRow = ({ icon: Icon, label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={13} color={color || 'var(--text-muted)'} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <span style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text-primary)' }}>
      {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
    </span>
  </div>
);

const AdminNotificationAnalyticsPage = () => {
  const { isMobile } = useResponsive();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const { adminNotificationsService } = await import('../api/notificationsService');
      const data = await adminNotificationsService.listBroadcasts({ limit: 20 });
      const items = Array.isArray(data) ? data : (data.items || []);
      setBroadcasts(items);
      setHasMore(!Array.isArray(data) && !!data.nextCursor);
      setCursor(!Array.isArray(data) ? data.nextCursor || null : null);
    } catch (err) {
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    try {
      const { adminNotificationsService } = await import('../api/notificationsService');
      const data = await adminNotificationsService.listBroadcasts({ cursor, limit: 20 });
      const items = Array.isArray(data) ? data : (data.items || []);
      setBroadcasts((prev) => [...prev, ...items]);
      setHasMore(!Array.isArray(data) && !!data.nextCursor);
      setCursor(!Array.isArray(data) ? data.nextCursor || null : null);
    } catch (err) {
      toast.error('Failed to load more broadcasts');
    }
  }, [cursor]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const handleSelectBroadcast = async (broadcast) => {
    if (selectedBroadcast?.id === broadcast.id) {
      setSelectedBroadcast(null);
      return;
    }
    setSelectedBroadcast(broadcast);
    if (!broadcast._expanded) {
      setDetailLoading(true);
      try {
        const { adminNotificationsService } = await import('../api/notificationsService');
        const data = await adminNotificationsService.getBroadcast(broadcast.id);
        setSelectedBroadcast((prev) => ({ ...prev, ...data, _expanded: true }));
      } catch (err) {
        toast.error('Failed to load broadcast details');
      } finally {
        setDetailLoading(false);
      }
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--on-surface)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '68px 16px 0' : '24px 24px 0',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <PageHeader
          title="Notification Analytics"
          subtitle="Delivery stats for past broadcast notifications."
          breadcrumbs={[
            { label: 'Admin', path: '/admin' },
            { label: 'Notifications' },
          ]}
          compact={isMobile}
        />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '0 16px 16px' : '0 24px 24px',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <LoadingSpinner />
          </div>
        ) : broadcasts.length === 0 ? (
          <EmptyState title="No broadcasts yet" message="Notifications you send will appear here." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 24, alignItems: 'start' }}>
            {/* Broadcast list */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Title / Message', 'Target', 'Sent at', { label: 'Delivered', align: 'right' }].map((col, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '10px 16px',
                          textAlign: (typeof col === 'object' ? col.align : 'left') || 'left',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          background: 'var(--bg-base)',
                        }}
                      >
                        {typeof col === 'object' ? col.label : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((b) => (
                    <BroadcastRow
                      key={b.id}
                      broadcast={b}
                      onClick={handleSelectBroadcast}
                      isSelected={selectedBroadcast?.id === b.id}
                    />
                  ))}
                </tbody>
              </table>

              {hasMore && (
                <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost" onClick={loadMore} disabled={loading}>
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div>
              {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <LoadingSpinner />
                </div>
              ) : selectedBroadcast ? (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  padding: 20,
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Selected Broadcast
                  </p>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    {selectedBroadcast.title}
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {selectedBroadcast.message}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <StatRow icon={TrendingUp} label="Delivered" value={selectedBroadcast.delivered ?? 0} color="var(--success)" />
                    <StatRow icon={TrendingUp} label="Sent" value={selectedBroadcast.sent ?? 0} color="var(--success)" />
                    <StatRow icon={Eye} label="Read" value={selectedBroadcast.read ?? 0} color="var(--primary)" />
                    <StatRow icon={MousePointer} label="Tapped" value={selectedBroadcast.tapped ?? 0} color="var(--primary)" />
                    <StatRow icon={Clock} label="Sent at" value={formatDate(selectedBroadcast.created_at)} />
                  </div>

                  <button
                    className="btn btn-ghost"
                    onClick={() => setSelectedBroadcast(null)}
                    style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                  >
                    Close detail
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  padding: 32,
                  textAlign: 'center',
                }}>
                  <TrendingUp size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Click a row to view delivery analytics.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationAnalyticsPage;
