import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { PlayCircle, Check, Search, X, Phone, Building2, Mail } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { demoRequestService } from '../api/demoRequestService';

// Mirrors Cred2Tech-UI's app/request-demo/page.tsx PRODUCTS list — falls
// back to the raw value for any future option added there before this map
// is updated.
const PRODUCT_LABELS = {
  'loan-eligibility': 'Instant Loan Eligibility Check',
  'virtual-workspace': 'Virtual Workspace (Sourcing Partner Platform)',
  'scheme-discovery': 'Government Scheme Discovery',
  'full-platform': 'Full Platform Overview',
  other: 'Other',
};
const productLabel = (value) => PRODUCT_LABELS[value] || value;

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const PAGE_SIZE = 20;

const compactField = {
  border: '1px solid var(--outline)',
  borderRadius: 0,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  outline: 'none',
};

const DemoRequestsTab = () => {
  const { isMobile } = useResponsive();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null); // row shown in the detail modal

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await demoRequestService.listForAdmin({ search, unreadOnly, page, pageSize: PAGE_SIZE });
      setRows(result.data);
      setTotal(result.total);
    } catch {
      toast.error('Failed to load demo requests');
    } finally {
      setLoading(false);
    }
  }, [search, unreadOnly, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { demoRequestService.unreadCount().then(setUnreadCount).catch(() => {}); }, [rows]);

  const handleMarkAsRead = async (e, row) => {
    e?.stopPropagation();
    try {
      const updated = await demoRequestService.markAsRead(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setUnreadCount((c) => Math.max(0, c - 1));
      setActive((a) => (a && a.id === row.id ? updated : a));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const openDetail = (row) => {
    setActive(row);
    if (!row.is_read) handleMarkAsRead(null, row);
  };

  const activeFilterCount = (unreadOnly ? 1 : 0);
  const clearFilters = () => { setUnreadOnly(false); setSearch(''); setPage(1); };

  const columns = [
    {
      key: 'contact', label: 'Requester',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {!r.is_read && <div style={{ width: 7, height: 7, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} title="Unread" />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{r.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
              {r.business_name} · {formatDateTime(r.created_at)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'reach', label: 'Reach',
      render: (r) => (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--on-surface)' }}>{r.email}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{r.mobile_number}</div>
        </div>
      ),
    },
    { key: 'product', label: 'Product', align: 'center', render: (r) => <span style={{ fontSize: 12 }}>{productLabel(r.product)}</span> },
    {
      key: 'actions', label: 'Action', align: 'right',
      render: (r) => !r.is_read ? (
        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={(e) => handleMarkAsRead(e, r)}>
          <Check size={12} /> Mark read
        </button>
      ) : null,
    },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
        <StatCard title="Total" value={total} icon={PlayCircle} />
        <StatCard title="Unread" value={unreadCount} color="var(--primary)" icon={PlayCircle} />
      </div>

      <div className="card" style={{ padding: 0, borderRadius: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 280 }}>
            <Search size={13} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, business, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            Unread only
          </label>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', marginLeft: 'auto', cursor: 'pointer' }}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={PlayCircle} title="No demo requests found" description="Submissions from the website's Request Demo form will show up here." />
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, idx) => (
              <div
                key={r.id}
                onClick={() => openDetail(r)}
                style={{ padding: 12, borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--outline)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {!r.is_read && <div style={{ width: 7, height: 7, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} title="Unread" />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{r.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{r.business_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 1 }}>{r.email} · {r.mobile_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 1 }}>{formatDateTime(r.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{productLabel(r.product)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable columns={columns} data={rows} onRowClick={openDetail} />
        )}
      </div>

      {!loading && total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {active && (
        <div className="modal-overlay" onClick={() => setActive(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{active.full_name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setActive(null)} aria-label="Close"><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={14} /> {active.business_name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={14} /> <a href={`mailto:${active.email}`} style={{ color: 'var(--primary)' }}>{active.email}</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={14} /> <a href={`tel:${active.mobile_number}`} style={{ color: 'var(--primary)' }}>{active.mobile_number}</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlayCircle size={14} /> {productLabel(active.product)}
              </div>
              {active.message && (
                <div style={{ marginTop: 4, padding: 12, background: 'var(--bg-elevated, var(--surface))', border: '1px solid var(--outline)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {active.message}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Submitted {formatDateTime(active.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DemoRequestsTab;
