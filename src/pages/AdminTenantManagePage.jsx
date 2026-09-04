import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Building2, Wallet, LayoutGrid, ShieldCheck, ShieldOff, CreditCard, Tag, Gift, XCircle } from 'lucide-react';
import {
  getTenantSummary, updateTenantStatus, updateTenantVirtualWorkspace,
  grantFreeVirtualWorkspace, adminSubscribeVirtualWorkspace, adminCancelVirtualWorkspace,
} from '../api/tenantService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate, formatDateTime, getErrorMessage } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

const ACCESS_PLAN_LABEL = {
  NO_ACCESS: 'No Access — Locked',
  FREE_GRANTED: 'Free Access (Admin Granted, No Charge)',
  SUBSCRIBED: 'Subscribed',
};
const ACCESS_PLAN_COLOR = { NO_ACCESS: 'var(--error)', FREE_GRANTED: 'var(--info)', SUBSCRIBED: 'var(--success)' };

const StatCard = ({ label, value }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', padding: 14 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', marginTop: 4 }}>{value}</div>
  </div>
);

const AdminTenantManagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subPaymentMethod, setSubPaymentMethod] = useState('RAZORPAY_AUTOPAY');
  const [subPromoCode, setSubPromoCode] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await getTenantSummary(id);
      setData(res);
    } catch (err) {
      toast.error('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleStatus = async () => {
    setBusy(true);
    try {
      await updateTenantStatus(id, data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      toast.success('Tenant status updated');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  const handleGrantFree = async () => {
    setBusy(true);
    try {
      await grantFreeVirtualWorkspace(id);
      toast.success('Granted free Virtual Workspace access — no charge, ever, until changed here');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to grant free access');
    } finally {
      setBusy(false);
    }
  };

  const handleLockAccess = async () => {
    if (!window.confirm('Lock this tenant out of Virtual Workspace? They will only see Dashboard/Wallet/Support/Profile.')) return;
    setBusy(true);
    try {
      await updateTenantVirtualWorkspace(id, false);
      toast.success('Virtual Workspace access locked');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to lock access');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubscribe = async () => {
    setBusy(true);
    try {
      const res = await adminSubscribeVirtualWorkspace(id, { paymentMethod: subPaymentMethod, promoCode: subPromoCode.trim() || null });
      if (res.payment_method === 'WALLET_CREDITS') {
        toast.success('Subscribed — charged from tenant wallet credits');
        await fetchData();
      } else {
        toast.success(`Razorpay subscription created (${res.razorpay_subscription_id}) — the tenant still needs to complete Checkout authorization themselves from their own Organization Profile page, or you can complete it now with a card you control.`, { duration: 10000 });
        await fetchData();
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start subscription');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel this subscription and lock Virtual Workspace access?')) return;
    setBusy(true);
    try {
      await adminCancelVirtualWorkspace(id);
      toast.success('Subscription cancelled and access locked');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to cancel subscription');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)' }}>Tenant not found</div>;

  const { subscription, virtual_workspace, access_plan } = data;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <button onClick={() => navigate('/tenants')} className="btn btn-ghost btn-sm" style={{ marginBottom: 16, borderRadius: 0 }}>
          <ArrowLeft size={14} /> Back to DSA List
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="var(--primary)" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>{data.tenant_name}</h1>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>{data.email} · {data.city || '—'} · {data.type}</p>
            </div>
          </div>
          <button onClick={handleToggleStatus} disabled={busy} className="btn btn-sm" style={{
            borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6,
            background: data.status === 'ACTIVE' ? 'var(--error-bg)' : 'var(--success-bg)',
            color: data.status === 'ACTIVE' ? 'var(--error)' : 'var(--success)', border: 'none',
          }}>
            {data.status === 'ACTIVE' ? <><ShieldOff size={14} /> Deactivate Account</> : <><ShieldCheck size={14} /> Activate Account</>}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
          <StatCard label="Wallet Balance" value={data.wallet_balance} />
          <StatCard label="Customers" value={data.total_customers} />
          <StatCard label="Cases" value={data.total_cases} />
          <StatCard label="Team Size" value={data.team_size} />
          <StatCard label="Last Activity" value={data.last_activity ? formatDate(data.last_activity) : '—'} />
        </div>

        {/* Virtual Workspace management */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', marginBottom: 24 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutGrid size={16} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace</h3>
              <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>Gates the full case-management sidebar for this DSA</p>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', background: 'var(--bg-elevated)', color: ACCESS_PLAN_COLOR[access_plan] }}>
                {ACCESS_PLAN_LABEL[access_plan]}
              </span>
              {subscription && (
                <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                  {subscription.payment_method === 'WALLET_CREDITS' ? 'Wallet Credits' : 'Razorpay Auto-pay'} — ₹{subscription.effective_amount_credits}/mo
                  {subscription.current_period_end && ` — next charge ${formatDateTime(subscription.current_period_end)}`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <button onClick={handleGrantFree} disabled={busy || access_plan === 'FREE_GRANTED'} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={13} /> Grant Free Access (No Charge)
              </button>
              <button onClick={handleLockAccess} disabled={busy || access_plan === 'NO_ACCESS'} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', border: '1px solid var(--error)' }}>
                <XCircle size={13} /> Lock Access
              </button>
              {subscription && ['ACTIVE', 'CREATED', 'AUTHENTICATED', 'PENDING', 'HALTED', 'GRACE_PERIOD'].includes(subscription.status) && (
                <button onClick={handleCancelSubscription} disabled={busy} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, color: 'var(--error)', border: '1px solid var(--error)' }}>
                  Cancel Subscription
                </button>
              )}
            </div>

            {access_plan !== 'SUBSCRIBED' && (
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 10 }}>Start a Real Subscription</p>
                <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input type="radio" checked={subPaymentMethod === 'RAZORPAY_AUTOPAY'} onChange={() => setSubPaymentMethod('RAZORPAY_AUTOPAY')} />
                    <CreditCard size={13} /> Razorpay Auto-pay
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input type="radio" checked={subPaymentMethod === 'WALLET_CREDITS'} onChange={() => setSubPaymentMethod('WALLET_CREDITS')} />
                    <Wallet size={13} /> Wallet Credits (Balance: {data.wallet_balance})
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Tag size={13} color="var(--on-muted)" />
                  <input type="text" value={subPromoCode} onChange={(e) => setSubPromoCode(e.target.value)} placeholder="Promo code (optional)" className="form-control" style={{ maxWidth: 200, textTransform: 'uppercase' }} />
                  <button onClick={handleAdminSubscribe} disabled={busy} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>Subscribe</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent wallet transactions */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Recent Wallet Transactions</h3>
          </div>
          {data.recent_wallet_transactions?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <tbody>
                {data.recent_wallet_transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderTop: '1px solid var(--outline)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--on-muted)' }}>{formatDateTime(tx.created_at)}</td>
                    <td style={{ padding: '10px 16px' }}>{tx.reference_type}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'CREDIT' ? '#10b981' : '#f43f5e' }}>
                      {tx.transaction_type === 'CREDIT' ? '+' : '-'} {tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--on-muted)', fontSize: 12 }}>No recent transactions</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTenantManagePage;
