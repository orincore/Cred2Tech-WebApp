import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Users, ArrowRight, ChevronDown } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import DataPurgedBadge from '../components/case/DataPurgedBadge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDate, toTitleCase, resolveEntityName } from '../utils/helpers';
import { getDirectMsmeCases } from '../api/adminMsmeService';

// Compact mobile stat block — mirrors the sharp-border, tight-padding tiles
// used on the Pricing/Logs pages' collapsible summary rows.
function MiniStat({ label, value, color, loading }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || 'var(--on-surface)' }}>{loading ? '—' : value}</div>
    </div>
  );
}

// Responsive hook — same shape as UsersListPage/TenantsListPage/VendorManagementPage.
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

const AdminMsmeCasesPage = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);

  const fetchCases = async () => {
    try {
      const data = await getDirectMsmeCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load MSME cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); }, []);

  const stats = useMemo(() => ({
    total: cases.length,
    unallocated: cases.filter(c => !c.assigned_dsa_tenant_id).length,
    allocated: cases.filter(c => c.assigned_dsa_tenant_id).length,
  }), [cases]);

  const goToAllocate = (caseRecord) => navigate(`/admin/msme-cases/${caseRecord.id}/allocate`);

  const columns = [
    {
      key: 'business', label: 'Business',
      render: (c) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{toTitleCase(resolveEntityName(c.customer)) || 'N/A'}</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>PAN: {c.customer?.business_pan || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{formatDate(c.created_at)}</div>
        </div>
      )
    },
    {
      key: 'loan', label: 'Requested Loan',
      render: (c) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>
            {c.loan_amount ? `₹${Number(c.loan_amount).toLocaleString('en-IN')}` : 'Not Specified'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>{c.product_type || '—'}</div>
        </div>
      )
    },
    {
      key: 'stage', label: 'Status',
      render: (c) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <Badge type="level" value={c.stage} />
          {c.data_purged_at && <DataPurgedBadge />}
        </div>
      )
    },
    {
      key: 'payment', label: 'Payment',
      render: (c) => c.case_payment?.status === 'PAID' ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', border: '1px solid var(--success)' }}>
          Paid
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Pending</span>
      )
    },
    {
      key: 'allocation', label: 'Allocation',
      render: (c) => c.assigned_dsa_tenant_id ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{toTitleCase(c.assigned_dsa_user?.name)}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>Allocated {c.allocated_at ? formatDate(c.allocated_at) : ''}</div>
        </div>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '3px 8px', border: '1px solid var(--warning)' }}>
          Unallocated
        </span>
      )
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        // Matches Cred2Tech/frontend's reference behavior and the backend's
        // actual capability (allocateDirectCase has no stage check at all):
        // any lead can be allocated, not only ones that have reached
        // LEAD_CREATED — self-onboarded cases sit in DRAFT until the
        // customer submits, which used to hide this button for every real
        // case. Already-allocated cases can be re-allocated too — the
        // allocate page's own picker handles both.
        <button className="btn btn-secondary btn-sm" onClick={() => goToAllocate(c)}>
          {c.assigned_dsa_tenant_id ? 'Reallocate' : 'Allocate'}
        </button>
      )
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Direct MSME Leads"
          subtitle="Manage and allocate self-onboarded MSME customers to DSA partners."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Lead summary ───
            Mobile: collapsed by default behind one toggle row — same
            collapse-on-mobile pattern used on the Pricing/Logs pages.
            Desktop: always-expanded shared StatCard grid, unchanged. */}
        {isMobile ? (
          <div style={{ border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', marginBottom: 12 }}>
            <button
              onClick={() => setShowStats(v => !v)}
              style={{
                width: '100%', padding: '9px 12px', background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Users size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--on-surface)' }}>Lead Summary</span>
              <span style={{ fontSize: 11, color: 'var(--on-muted)', fontWeight: 600 }}>{loading ? '…' : `${stats.total} total`}</span>
              <ChevronDown
                size={13}
                color="var(--on-muted)"
                style={{ flexShrink: 0, transition: 'transform 0.15s', transform: showStats ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {showStats && (
              <div style={{ padding: '0 12px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <MiniStat label="Total" value={stats.total} loading={loading} />
                <MiniStat label="Unallocated" value={stats.unallocated} color="var(--warning)" loading={loading} />
                <MiniStat label="Allocated" value={stats.allocated} color="var(--success)" loading={loading} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard title="Total Leads" value={stats.total} icon={Users} loading={loading} />
            <StatCard title="Unallocated" value={stats.unallocated} color="var(--warning)" icon={Users} loading={loading} />
            <StatCard title="Allocated" value={stats.allocated} color="var(--success)" icon={Users} loading={loading} />
          </div>
        )}

      {loading ? (
        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
        </div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          <EmptyState
            icon={Users}
            title="No Direct MSME cases"
            description="Self-onboarded MSME leads awaiting allocation will show up here."
          />
        </div>
      ) : isMobile ? (
        // Mobile: card list instead of a table — same reasoning as
        // TenantsListPage/VendorManagementPage/UsersListPage. A table forced
        // into a small viewport either truncates every column or becomes
        // horizontally scrollable; a card puts every field for one lead in a
        // single vertical read.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cases.map((c) => {
            const isPaid = c.case_payment?.status === 'PAID';
            return (
              <div
                key={c.id}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 12 }}
              >
                {/* Identity row: business name on the left, stage badge anchored right */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {toTitleCase(resolveEntityName(c.customer)) || 'N/A'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>PAN: {c.customer?.business_pan || '—'} · {formatDate(c.created_at)}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <Badge type="level" value={c.stage} />
                    {c.data_purged_at && <DataPurgedBadge />}
                  </div>
                </div>

                {/* Fields grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)',
                }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Requested Loan</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                      {c.loan_amount ? `₹${Number(c.loan_amount).toLocaleString('en-IN')}` : 'Not Specified'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{c.product_type || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Payment</div>
                    {isPaid ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', border: '1px solid var(--success)', display: 'inline-block' }}>Paid</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Pending</span>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Allocation</div>
                    {c.assigned_dsa_tenant_id ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{toTitleCase(c.assigned_dsa_user?.name)}</div>
                        <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>Allocated {c.allocated_at ? formatDate(c.allocated_at) : ''}</div>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '3px 8px', border: '1px solid var(--warning)', display: 'inline-block' }}>Unallocated</span>
                    )}
                  </div>
                </div>

                {/* Action — already-allocated cases can be re-allocated too. */}
                <button
                  onClick={() => goToAllocate(c)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', marginTop: 12, padding: '8px 0',
                    background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0,
                    fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer',
                  }}
                >
                  {c.assigned_dsa_tenant_id ? 'Reallocate' : 'Allocate'} <ArrowRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          <DataTable columns={columns} data={cases} />
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminMsmeCasesPage;
