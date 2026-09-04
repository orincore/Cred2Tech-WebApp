import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { LayoutGrid, Search, ExternalLink } from 'lucide-react';
import { listAllVirtualWorkspaceSubscriptions } from '../api/tenantService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

const ACCESS_PLAN_LABEL = { NO_ACCESS: 'No Access', FREE_GRANTED: 'Free (Admin Granted)', SUBSCRIBED: 'Subscribed' };
const ACCESS_PLAN_COLOR = {
  NO_ACCESS: { bg: '#fee2e2', fg: '#dc2626', bgDark: '#450a0a', fgDark: '#fca5a5' },
  FREE_GRANTED: { bg: '#dbeafe', fg: '#1d4ed8', bgDark: '#1e3a8a', fgDark: '#93c5fd' },
  SUBSCRIBED: { bg: '#dcfce7', fg: '#15803d', bgDark: '#064e3b', fgDark: '#6ee7b7' },
};

const STATUS_LABEL = {
  CREATED: 'Awaiting first payment', AUTHENTICATED: 'Awaiting activation', ACTIVE: 'Active',
  PENDING: 'Payment retrying', HALTED: 'Payment failed — grace period', GRACE_PERIOD: 'Payment failed — grace period',
  PAUSED: 'Paused (extended)', CANCELLED: 'Cancelled', COMPLETED: 'Completed',
};

const FILTERS = ['ALL', 'NO_ACCESS', 'FREE_GRANTED', 'SUBSCRIBED'];

const AdminVirtualWorkspaceSubscriptionsPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [rows, setRows] = useState([]);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    (async () => {
      try {
        const res = await listAllVirtualWorkspaceSubscriptions();
        setRows(res.rows || []);
        setBillingEnabled(!!res.billing_enabled);
      } catch (err) {
        toast.error('Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.access_plan !== filter) return false;
      if (search && !r.tenant_name?.toLowerCase().includes(search.toLowerCase()) && !r.tenant_email?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const c = { ALL: rows.length, NO_ACCESS: 0, FREE_GRANTED: 0, SUBSCRIBED: 0 };
    rows.forEach((r) => { c[r.access_plan] = (c[r.access_plan] || 0) + 1; });
    return c;
  }, [rows]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--outline)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'var(--bg-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LayoutGrid size={18} color="var(--primary)" />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace Subscriptions</h1>
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>
              Every sourcing partner's access & billing state in one place — real billing is currently {billingEnabled ? 'ENABLED' : 'dormant (admin toggle only)'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: 10, color: 'var(--on-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant name or email…"
            className="form-control"
            style={{ paddingLeft: 26 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                background: filter === f ? 'var(--primary)' : 'var(--bg-elevated)',
                color: filter === f ? '#fff' : 'var(--on-muted)',
                border: '1px solid var(--outline)', borderRadius: 0,
              }}
            >
              {f === 'ALL' ? 'All' : ACCESS_PLAN_LABEL[f]} ({counts[f] || 0})
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ overflowX: 'auto', border: '1px solid var(--outline)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                {['Tenant', 'Access Plan', 'Status', 'Payment Method', 'Price', 'Covered Until', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pc = ACCESS_PLAN_COLOR[r.access_plan];
                return (
                  <tr key={r.tenant_id} style={{ borderTop: '1px solid var(--outline)', cursor: 'pointer' }} onClick={() => navigate(`/tenants/${r.tenant_id}`)}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700 }}>{r.tenant_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{r.tenant_email}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 9px', fontSize: 10.5, fontWeight: 800, background: isDark ? pc.bgDark : pc.bg, color: isDark ? pc.fgDark : pc.fg }}>
                        {ACCESS_PLAN_LABEL[r.access_plan]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{r.subscription ? (STATUS_LABEL[r.subscription.status] || r.subscription.status) : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.subscription ? (r.subscription.payment_method === 'WALLET_CREDITS' ? 'Wallet Credits' : 'Razorpay Auto-pay') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.subscription ? `₹${r.subscription.effective_amount_credits}/mo` : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{r.subscription?.current_period_end ? formatDateTime(r.subscription.current_period_end) : '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${r.tenant_id}`); }}
                      >
                        Manage <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--on-muted)' }}>No tenants match this filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminVirtualWorkspaceSubscriptionsPage;
