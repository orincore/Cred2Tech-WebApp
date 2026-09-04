import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Building2, Wallet, LayoutGrid, ShieldCheck, ShieldOff, Repeat, Tag, Gift, XCircle,
  Users, PlusCircle, MinusCircle, LayoutDashboard, CalendarClock,
} from 'lucide-react';
import {
  getTenantSummary, updateTenantStatus, updateTenantVirtualWorkspace,
  grantFreeVirtualWorkspace, adminSubscribeVirtualWorkspace, adminUpgradeVirtualWorkspacePlan,
  adminCancelVirtualWorkspace, adminDowngradeToFree, adminExtendVirtualWorkspace,
  adminTopupTenantWallet, adminDeductTenantWallet,
  getTenantEmployees, allocateTenantEmployeeCredits, revokeTenantEmployeeCredits,
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workspace', label: 'Virtual Workspace', icon: LayoutGrid },
  { id: 'wallet', label: 'Wallet & Credits', icon: Wallet },
  { id: 'team', label: 'Team & Allocation', icon: Users },
];

const StatCard = ({ label, value }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', padding: 14 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)', marginTop: 4 }}>{value}</div>
  </div>
);

const Card = ({ icon: Icon, title, subtitle, children }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', marginBottom: 20 }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon size={16} color="var(--primary)" />
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>{subtitle}</p>}
      </div>
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const AdminTenantManagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // RAZORPAY_AUTOPAY (Subscriptions API) is the default here, matching the
  // tenant's own self-service Subscription card — it genuinely supports
  // UPI Autopay (confirmed against Razorpay's docs); the newer ceiling-
  // based RAZORPAY_RECURRING rail is card-only on this account (verified
  // live), so it's not the one that gets a tenant an actual UPI mandate.
  const [subPaymentMethod, setSubPaymentMethod] = useState('RAZORPAY_AUTOPAY');
  const [subPromoCode, setSubPromoCode] = useState('');
  const [subPlanId, setSubPlanId] = useState('');
  const [upgradePlanId, setUpgradePlanId] = useState('');
  const [extendDate, setExtendDate] = useState('');

  const [topupAmount, setTopupAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductRemarks, setDeductRemarks] = useState('');

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [allocations, setAllocations] = useState({}); // { [userId]: { amount, note } }

  const fetchData = useCallback(async () => {
    try {
      const res = await getTenantSummary(id);
      setData(res);
      // Subscribe selector defaults to the tenant's current plan (once
      // subscribed) or the cheapest active plan, so it never opens empty.
      const defaultPlanId = res.subscription?.plan_id || res.plans?.[0]?.id || '';
      setSubPlanId(String(defaultPlanId));
      // Upgrade selector only ever lists plans priced ABOVE what's
      // currently paid (see the Upgrade Plan section render) — default to
      // the first one of those, not the current plan itself, which
      // wouldn't be a valid option in that filtered list.
      const cheapestUpgrade = res.plans?.find((p) => p.monthly_price_credits > (res.subscription?.effective_amount_credits ?? -1));
      setUpgradePlanId(cheapestUpgrade ? String(cheapestUpgrade.id) : '');
    } catch (err) {
      toast.error('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await getTenantEmployees(id);
      setEmployees(res || []);
    } catch (err) {
      toast.error('Failed to load team members');
    } finally {
      setLoadingEmployees(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'team' && employees.length === 0) fetchEmployees(); }, [tab, employees.length, fetchEmployees]);

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

  // "Free" isn't a priced SubscriptionPlan — it's the restricted-access
  // tier (limited dashboard nav, no wallet recharge, no paid pulls; see
  // Sidebar.jsx's virtual_workspace_free_nav_item_ids gate and
  // requireActiveWorkspace) a tenant lands on when they aren't paying.
  // Deliberately NOT the same as "Grant Free Access" above (that's a full-
  // access admin comp override) — this is the ordinary downgrade target.
  const handleDowngradeToFree = async () => {
    setBusy(true);
    try {
      await adminDowngradeToFree(id);
      toast.success('Switched to the Free plan — restricted access (limited dashboard, no wallet recharge, no paid features) until upgraded again');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to switch to the Free plan');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubscribe = async () => {
    if (!subPlanId) return toast.error('Select a plan');
    if (subPlanId === 'FREE') return handleDowngradeToFree();
    setBusy(true);
    try {
      const res = await adminSubscribeVirtualWorkspace(id, { planId: subPlanId, paymentMethod: subPaymentMethod, promoCode: subPromoCode.trim() || null });
      if (res.payment_method === 'WALLET_CREDITS') {
        toast.success('Subscribed — paid from tenant wallet credits');
      } else if (res.payment_method === 'RAZORPAY_RECURRING') {
        // Unlike RAZORPAY_AUTOPAY's Subscriptions API, there's no Razorpay
        // notify_info equivalent for this rail — a plain Order has no
        // built-in notification mechanism. The tenant won't hear about
        // this automatically; they need to be told directly (or just open
        // their own Organization Profile page, which shows the same
        // "payment authorization needed" banner and can complete it there).
        toast.success(
          'Auto-pay mandate registered — no automatic notification is sent for this payment method, so let the tenant know directly. They can complete authorization from their own Organization Profile page.',
          { duration: 14000 }
        );
      } else {
        toast.success(
          `Razorpay subscription created (${res.razorpay_subscription_id}) — Razorpay has emailed/texted the tenant an authorization link, and they'll also see it from their own Organization Profile page. Authorizing it charges the first month immediately.`
          + (res.short_url ? ` Backup link: ${res.short_url}` : ''),
          { duration: 14000 }
        );
      }
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start subscription');
    } finally {
      setBusy(false);
    }
  };

  // Upgrades an already-subscribed tenant to a HIGHER-priced plan — same
  // subscription/mandate stays active, the tenant just owes the price
  // difference. Mirrors the DSA's own self-service upgrade in
  // VirtualWorkspaceSubscriptionCard.jsx. Downgrades aren't offered here at
  // all (see the Upgrade Plan section's filtered dropdown) — the backend
  // rejects them outright regardless.
  const handleAdminUpgradePlan = async () => {
    if (!upgradePlanId) return toast.error('Select a plan');
    setBusy(true);
    try {
      const res = await adminUpgradeVirtualWorkspacePlan(id, { planId: upgradePlanId });
      if (res.payment_method === 'WALLET_CREDITS') {
        toast.success('Plan upgraded — the price difference was debited from the tenant\'s wallet immediately');
      } else if (res.payment_method === 'RAZORPAY_RECURRING') {
        // No notify_info equivalent for this rail — tell the admin
        // directly rather than implying Razorpay already notified anyone.
        toast.success(
          'Upgrade started — a new auto-pay mandate was registered. No automatic notification is sent for this payment method, so let the tenant know directly, or have them open their own Organization Profile page to complete it.',
          { duration: 14000 }
        );
      } else if (res.razorpay_subscription_id) {
        // RAZORPAY_AUTOPAY — a single Checkout authorizes the new mandate
        // AND charges the prorated amount owed today (see upgradePlan()'s
        // own doc comment); Razorpay's notify_info already emailed/texted
        // the tenant a link for it, same as a fresh subscribe.
        toast.success(
          `Upgrade started — a new auto-pay mandate was registered${res.charge_now_credits != null ? ` (₹${res.charge_now_credits} charged on authorization)` : ''}. Razorpay has emailed/texted the tenant a link to authorize it; they'll also see it from their own Organization Profile page.`,
          { duration: 14000 }
        );
      } else {
        toast.success('Plan upgraded');
      }
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to switch plan');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Cancel this tenant's subscription? No further auto-debit will happen — full Virtual Workspace access stays as-is until the current billing period ends, then the tenant drops to the Free plan (restricted access) rather than being locked out entirely. For an immediate downgrade right now instead, use the Free option in Switch Plan above.")) return;
    setBusy(true);
    try {
      await adminCancelVirtualWorkspace(id);
      toast.success("Subscription cancelled — no further charges. Full access continues until the current period ends, then the tenant drops to the Free plan.");
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to cancel subscription');
    } finally {
      setBusy(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!extendDate) return toast.error('Pick a new end date');
    setBusy(true);
    try {
      const result = await adminExtendVirtualWorkspace(id, extendDate);
      toast.success(
        result.status === 'PAUSED'
          ? 'Extended — the live Razorpay subscription is paused and will auto-resume on the new date, so autopay won\'t charge again until then'
          : 'Subscription extended',
        { duration: 8000 }
      );
      setExtendDate('');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to extend subscription');
    } finally {
      setBusy(false);
    }
  };

  const handleTopup = async () => {
    const credits = parseInt(topupAmount, 10);
    if (!credits || credits <= 0) return toast.error('Enter a valid credit amount');
    setBusy(true);
    try {
      await adminTopupTenantWallet(id, credits);
      toast.success(`${credits} free credits added to wallet`);
      setTopupAmount('');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to top up wallet');
    } finally {
      setBusy(false);
    }
  };

  const handleDeduct = async () => {
    const credits = parseInt(deductAmount, 10);
    if (!credits || credits <= 0) return toast.error('Enter a valid credit amount');
    setBusy(true);
    try {
      await adminDeductTenantWallet(id, credits, deductRemarks.trim() || undefined);
      toast.success(`${credits} credits deducted from wallet`);
      setDeductAmount(''); setDeductRemarks('');
      await fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to deduct from wallet');
    } finally {
      setBusy(false);
    }
  };

  const updateAllocationField = (userId, field, value) => {
    setAllocations((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
  };

  const handleAllocate = async (userId) => {
    const amount = parseInt(allocations[userId]?.amount, 10);
    if (!amount || amount <= 0) return toast.error('Enter a valid credit amount');
    setBusy(true);
    try {
      await allocateTenantEmployeeCredits(id, userId, amount, allocations[userId]?.note || undefined);
      toast.success(`${amount} credits allocated`);
      setAllocations((prev) => ({ ...prev, [userId]: { amount: '', note: '' } }));
      await Promise.all([fetchEmployees(), fetchData()]);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to allocate credits');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (userId) => {
    const amount = parseInt(allocations[userId]?.amount, 10);
    if (!amount || amount <= 0) return toast.error('Enter a valid credit amount');
    setBusy(true);
    try {
      await revokeTenantEmployeeCredits(id, userId, amount, allocations[userId]?.note || undefined);
      toast.success(`${amount} credits revoked back to tenant wallet`);
      setAllocations((prev) => ({ ...prev, [userId]: { amount: '', note: '' } }));
      await Promise.all([fetchEmployees(), fetchData()]);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to revoke credits');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)' }}>Tenant not found</div>;

  const { subscription, access_plan } = data;
  const isSubscribedLike = subscription && ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'GRACE_PERIOD'].includes(subscription.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', background: 'var(--bg-elevated)' }}>
        <button onClick={() => navigate('/tenants')} className="btn btn-ghost btn-sm" style={{ marginBottom: 10, borderRadius: 0 }}>
          <ArrowLeft size={14} /> Back to DSA List
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={18} color="var(--primary)" />
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>{data.tenant_name}</h1>
              <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>{data.email} · {data.city || '—'} · {data.type}</p>
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
      </div>

      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--outline)', background: 'var(--bg)', display: 'flex', gap: 4, flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              padding: '10px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--on-muted)',
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>

          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
                <StatCard label="Wallet Balance" value={data.wallet_balance} />
                <StatCard label="Customers" value={data.total_customers} />
                <StatCard label="Cases" value={data.total_cases} />
                <StatCard label="Team Size" value={data.team_size} />
                <StatCard label="Last Activity" value={data.last_activity ? formatDate(data.last_activity) : '—'} />
              </div>
              <Card icon={Wallet} title="Recent Wallet Transactions">
                {data.recent_wallet_transactions?.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <tbody>
                      {data.recent_wallet_transactions.map((tx) => (
                        <tr key={tx.id} style={{ borderTop: '1px solid var(--outline)' }}>
                          <td style={{ padding: '10px 0', color: 'var(--on-muted)' }}>{formatDateTime(tx.created_at)}</td>
                          <td style={{ padding: '10px 0' }}>{tx.reference_type}</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'CREDIT' ? '#10b981' : '#f43f5e' }}>
                            {tx.transaction_type === 'CREDIT' ? '+' : '-'} {tx.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--on-muted)', fontSize: 12 }}>No recent transactions</div>
                )}
              </Card>
            </>
          )}

          {tab === 'workspace' && (
            <Card icon={LayoutGrid} title="Virtual Workspace" subtitle="Gates the full case-management sidebar for this DSA">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', background: 'var(--bg-elevated)', color: ACCESS_PLAN_COLOR[access_plan] }}>
                  {ACCESS_PLAN_LABEL[access_plan]}
                </span>
                {subscription && (
                  <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                    {subscription.payment_method === 'WALLET_CREDITS' ? 'Wallet Credits' : 'Razorpay Auto-pay'} — ₹{subscription.effective_amount_credits}/mo
                    {subscription.status === 'PAUSED' && ' — paused (admin-extended)'}
                  </span>
                )}
              </div>

              {subscription && (subscription.current_period_start || subscription.current_period_end) && (
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Started</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{subscription.current_period_start ? formatDateTime(subscription.current_period_start) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>
                      {subscription.status === 'PAUSED' ? 'Covered / Resumes' : 'Ends / Next Charge'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{subscription.current_period_end ? formatDateTime(subscription.current_period_end) : '—'}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                <button onClick={handleGrantFree} disabled={busy || access_plan === 'FREE_GRANTED'} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gift size={13} /> Grant Free Access (No Charge)
                </button>
                <button onClick={handleLockAccess} disabled={busy || access_plan === 'NO_ACCESS'} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', border: '1px solid var(--error)' }}>
                  <XCircle size={13} /> Lock Access
                </button>
                {isSubscribedLike && (
                  <button onClick={handleCancelSubscription} disabled={busy} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, color: 'var(--error)', border: '1px solid var(--error)' }}>
                    Cancel Subscription
                  </button>
                )}
              </div>

              {isSubscribedLike && (
                <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarClock size={13} /> Extend Subscription (Compensation)
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--on-muted)', marginBottom: 10 }}>
                    Pushes the covered-through date out — for Razorpay auto-pay this pauses the live subscription so it won't charge again until the new date, then resumes automatically.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" className="form-control" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} style={{ maxWidth: 180 }} />
                    <button onClick={handleExtendSubscription} disabled={busy || !extendDate} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>Extend</button>
                  </div>
                </div>
              )}

              {isSubscribedLike && (
                <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 4 }}>Upgrade Plan</p>
                  <p style={{ fontSize: 11, color: 'var(--on-muted)', marginBottom: 10 }}>
                    Upgrade-only — only plans priced higher than the tenant's current ₹{subscription.effective_amount_credits}/mo are listed. Moving to a lower-priced plan (or Free) isn't a direct switch; use "Grant Free Access"/Lock above, or have the tenant cancel and let their current plan expire first.
                  </p>
                  {(() => {
                    const upgradeOptions = data.plans.filter((p) => p.monthly_price_credits > subscription.effective_amount_credits);
                    if (upgradeOptions.length === 0) {
                      return <p style={{ fontSize: 11.5, color: 'var(--on-muted)', fontStyle: 'italic' }}>No higher-priced plan is configured to upgrade to.</p>;
                    }
                    return (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select className="form-control" value={upgradePlanId} onChange={(e) => setUpgradePlanId(e.target.value)} style={{ maxWidth: 260 }}>
                          {upgradeOptions.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — ₹{p.monthly_price_credits}/mo (+₹{p.monthly_price_credits - subscription.effective_amount_credits} now)</option>
                          ))}
                        </select>
                        <button onClick={handleAdminUpgradePlan} disabled={busy || !upgradePlanId} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>
                          {busy ? 'Upgrading…' : 'Upgrade Plan'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {access_plan !== 'SUBSCRIBED' && (
                <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 10 }}>Start a Real Subscription</p>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Plan</label>
                    <select className="form-control" value={subPlanId} onChange={(e) => setSubPlanId(e.target.value)} style={{ maxWidth: 260 }}>
                      <option value="FREE">Free (Restricted Access)</option>
                      {data.plans?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.first_cycle_price_credits != null && p.first_cycle_price_credits !== p.monthly_price_credits
                            ? `₹${p.first_cycle_price_credits} first mo, then ₹${p.monthly_price_credits}/mo`
                            : `₹${p.monthly_price_credits}/mo`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {subPlanId === 'FREE' ? (
                    <button onClick={handleAdminSubscribe} disabled={busy} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>
                      Switch to Free Plan
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                          <input type="radio" checked={subPaymentMethod === 'RAZORPAY_AUTOPAY'} onChange={() => setSubPaymentMethod('RAZORPAY_AUTOPAY')} />
                          <Repeat size={13} /> Razorpay Auto-pay (card or UPI)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                          <input type="radio" checked={subPaymentMethod === 'WALLET_CREDITS'} onChange={() => setSubPaymentMethod('WALLET_CREDITS')} />
                          <Wallet size={13} /> Wallet Credits (Balance: {data.wallet_balance})
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Tag size={13} color="var(--on-muted)" />
                        <input type="text" value={subPromoCode} onChange={(e) => setSubPromoCode(e.target.value)} placeholder="Promo code (optional)" className="form-control" style={{ maxWidth: 200, textTransform: 'uppercase' }} />
                        <button onClick={handleAdminSubscribe} disabled={busy || !subPlanId} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>Subscribe</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          )}

          {tab === 'wallet' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                <StatCard label="Wallet Balance" value={data.wallet_balance} />
              </div>

              <Card icon={Gift} title="Free Admin Credit Allocation" subtitle="Add credits to this tenant's wallet at no cost, or correct a balance">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Add Free Credits</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <input type="number" className="form-control" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="e.g. 500" />
                      <button onClick={handleTopup} disabled={busy} className="btn btn-primary btn-sm" style={{ borderRadius: 0, whiteSpace: 'nowrap' }}>
                        <PlusCircle size={13} /> Add
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Deduct Credits</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <input type="number" className="form-control" value={deductAmount} onChange={(e) => setDeductAmount(e.target.value)} placeholder="e.g. 100" />
                      <button onClick={handleDeduct} disabled={busy} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, whiteSpace: 'nowrap', color: 'var(--error)', border: '1px solid var(--error)' }}>
                        <MinusCircle size={13} /> Deduct
                      </button>
                    </div>
                    <input type="text" className="form-control" value={deductRemarks} onChange={(e) => setDeductRemarks(e.target.value)} placeholder="Reason (optional)" style={{ marginTop: 8 }} />
                  </div>
                </div>
              </Card>

              <Card icon={Wallet} title="Recent Wallet Transactions">
                {data.recent_wallet_transactions?.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <tbody>
                      {data.recent_wallet_transactions.map((tx) => (
                        <tr key={tx.id} style={{ borderTop: '1px solid var(--outline)' }}>
                          <td style={{ padding: '10px 0', color: 'var(--on-muted)' }}>{formatDateTime(tx.created_at)}</td>
                          <td style={{ padding: '10px 0' }}>{tx.reference_type}</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'CREDIT' ? '#10b981' : '#f43f5e' }}>
                            {tx.transaction_type === 'CREDIT' ? '+' : '-'} {tx.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--on-muted)', fontSize: 12 }}>No recent transactions</div>
                )}
              </Card>
            </>
          )}

          {tab === 'team' && (
            <Card icon={Users} title="Team & Credit Allocation" subtitle="Move credits between this tenant's own wallet and a member's (sub-DSA/employee) wallet">
              {loadingEmployees ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><LoadingSpinner size={24} /></div>
              ) : employees.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--on-muted)', fontSize: 12 }}>No team members yet</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {employees.map((emp) => {
                    const alloc = allocations[emp.id] || { amount: '', note: '' };
                    const ew = emp.EmployeeWallet?.[0];
                    return (
                      <div key={emp.id} style={{ border: '1px solid var(--outline)', padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>{emp.name || emp.email}</div>
                            <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{emp.role?.name} · {emp.email}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12 }}>
                            <div style={{ fontWeight: 800, color: 'var(--on-surface)' }}>{ew?.allocated_balance ?? 0} allocated</div>
                            <div style={{ color: 'var(--on-muted)' }}>{ew?.consumed_credits ?? 0} used</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="form-control"
                            value={alloc.amount}
                            onChange={(e) => updateAllocationField(emp.id, 'amount', e.target.value)}
                            placeholder="Credits"
                            style={{ maxWidth: 110 }}
                          />
                          <input
                            type="text"
                            className="form-control"
                            value={alloc.note}
                            onChange={(e) => updateAllocationField(emp.id, 'note', e.target.value)}
                            placeholder="Note (optional)"
                            style={{ maxWidth: 200 }}
                          />
                          <button onClick={() => handleAllocate(emp.id)} disabled={busy} className="btn btn-primary btn-sm" style={{ borderRadius: 0 }}>
                            <PlusCircle size={13} /> Allocate from Tenant Wallet
                          </button>
                          <button onClick={() => handleRevoke(emp.id)} disabled={busy} className="btn btn-ghost btn-sm" style={{ borderRadius: 0, color: 'var(--error)', border: '1px solid var(--error)' }}>
                            <MinusCircle size={13} /> Revoke
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminTenantManagePage;
