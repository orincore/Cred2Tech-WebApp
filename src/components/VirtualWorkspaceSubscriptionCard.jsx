import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { LayoutGrid, Wallet, CreditCard, Tag, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { loadRazorpay } from '../utils/razorpay';
import { getErrorMessage, formatDateTime } from '../utils/helpers';

const STATUS_LABEL = {
  CREATED: 'Awaiting first payment',
  AUTHENTICATED: 'Awaiting activation',
  ACTIVE: 'Active',
  PENDING: 'Payment retrying',
  HALTED: 'Payment failed — grace period',
  GRACE_PERIOD: 'Payment failed — grace period',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

// Self-contained — fetches/manages its own state so it can drop into
// OrganizationProfilePage.jsx without threading into that page's own large
// form/state. DSA_ADMIN only, matches the subscription routes' own gating.
//
// Deliberately simple, on purpose: a tenant who chooses to pay (either
// payment method) is always charged and activated immediately, and renews
// on that same date every month — regardless of the platform-wide
// free_until date below. That date only ever matters to a tenant who
// DOESN'T subscribe (see is_currently_free below, and Sidebar.jsx's gate) —
// it never defers or splits an active subscribe/upgrade.
const VirtualWorkspaceSubscriptionCard = () => {
  const { hasRole } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY_AUTOPAY');
  const [promoCode, setPromoCode] = useState('');
  const [planId, setPlanId] = useState('');
  const [switchPlanId, setSwitchPlanId] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/virtual-workspace/subscription');
      setStatus(res.data);
      const defaultPlanId = res.data.subscription?.plan_id || res.data.plans?.[0]?.id || '';
      setPlanId(String(defaultPlanId));
      setSwitchPlanId(String(defaultPlanId));
    } catch {
      // Non-fatal — card just shows nothing actionable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!hasRole('DSA_ADMIN') || loading || !status) return null;

  const { subscription, wallet_balance, plans, monthly_price_credits, billing_enabled, is_currently_free, free_until, key_id } = status;
  const freeUntilLabel = free_until ? new Date(free_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  // Opens Razorpay Checkout for mandate authorization against an
  // already-created subscription — shared by a fresh subscribe, a plan
  // switch, and "Complete Payment Setup" for one stuck at CREATED/
  // AUTHENTICATED (e.g. one an admin started on this tenant's behalf, or a
  // Checkout the tenant closed before finishing). The authorization itself
  // IS the charge — Razorpay bills immediately on success.
  const openCheckout = async (razorpaySubscriptionId, successMessage = 'Subscribed to Virtual Workspace') => {
    const Razorpay = await loadRazorpay();
    const rzp = new Razorpay({
      key: key_id,
      subscription_id: razorpaySubscriptionId,
      name: 'Cred2Tech Virtual Workspace',
      description: 'Monthly subscription',
      handler: async (response) => {
        try {
          await api.post('/virtual-workspace/subscription/confirm', {
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          toast.success(successMessage);
          fetchStatus();
        } catch (err) {
          toast.error(getErrorMessage(err) || 'Failed to confirm subscription');
        }
      },
      theme: { color: '#4F46E5' },
    });
    rzp.on('payment.failed', (response) => toast.error(`Payment failed: ${response.error.description}`));
    rzp.open();
  };

  const handleSubscribe = async () => {
    if (!planId) return toast.error('Select a plan');
    setBusy(true);
    try {
      const res = await api.post('/virtual-workspace/subscription/subscribe', {
        plan_id: planId,
        payment_method: paymentMethod,
        promo_code: promoCode.trim() || null,
      });

      if (res.data.payment_method === 'WALLET_CREDITS') {
        toast.success('Subscribed — paid from wallet credits');
        await fetchStatus();
        return;
      }

      // RAZORPAY_AUTOPAY — open Checkout against the created subscription;
      // authorizing it is what charges the first month, right now.
      await openCheckout(res.data.razorpay_subscription_id);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start subscription');
    } finally {
      setBusy(false);
    }
  };

  const handleCompletePayment = async () => {
    setBusy(true);
    try {
      await openCheckout(subscription.razorpay_subscription_id);
    } finally {
      setBusy(false);
    }
  };

  // "Free" isn't a priced plan — it's the restricted-access tier (limited
  // dashboard nav, no wallet recharge, no paid features) you land on
  // without an active subscription. Takes effect immediately, same as any
  // other plan switch.
  const handleDowngradeToFree = async () => {
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/downgrade-to-free');
      toast.success('Switched to the Free plan — restricted access until you upgrade again');
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to switch to the Free plan');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchPlan = async () => {
    if (!switchPlanId) return toast.error('Select a plan');
    if (switchPlanId === 'FREE') return handleDowngradeToFree();
    if (String(switchPlanId) === String(subscription.plan_id)) return toast.error('You are already on this plan');
    setBusy(true);
    try {
      const res = await api.post('/virtual-workspace/subscription/upgrade', {
        plan_id: switchPlanId,
        promo_code: promoCode.trim() || null,
      });

      if (res.data.payment_method === 'WALLET_CREDITS') {
        toast.success('Plan switched — paid from wallet credits');
        await fetchStatus();
        return;
      }
      if (res.data.updated_in_place) {
        // Razorpay changed the renewal price on the same mandate directly —
        // no fresh Checkout needed.
        toast.success('Plan switched');
        await fetchStatus();
        return;
      }
      toast.success('Plan switched — complete the new payment authorization below to activate it');
      await openCheckout(res.data.razorpay_subscription_id);
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to switch plan');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    const hasRunningCycle = ['ACTIVE', 'PAUSED'].includes(subscription.status) && subscription.current_period_end;
    const confirmMsg = hasRunningCycle
      ? `Cancel your subscription? You won't be charged again — full access stays as-is until ${formatDateTime(subscription.current_period_end)}, then you'll drop to the Free plan (restricted dashboard, no wallet recharge, no paid features) until you resubscribe.`
      : `Cancel this subscription? You won't be charged, and you'll move to the Free plan (restricted access) right away.`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/cancel');
      toast.success(hasRunningCycle ? 'Subscription cancelled — no further charges. Full access continues until your current period ends.' : 'Subscription cancelled — no further charges.');
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to cancel subscription');
    } finally {
      setBusy(false);
    }
  };

  const activeLike = subscription && ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'GRACE_PERIOD', 'PAUSED'].includes(subscription.status);
  const needsCheckout = subscription && ['CREATED', 'AUTHENTICATED'].includes(subscription.status) && subscription.payment_method === 'RAZORPAY_AUTOPAY';

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', marginTop: 24 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <LayoutGrid size={16} color="var(--primary)" />
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace Subscription</h3>
          <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>
            {freeUntilLabel ? `Free until ${freeUntilLabel} for tenants who don't subscribe — plans below are ₹${monthly_price_credits}/month and start right away` : `From ₹${monthly_price_credits}/month — auto-renews`}
          </p>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {is_currently_free && !activeLike && (
          <div style={{ padding: '12px 14px', marginBottom: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 12.5, lineHeight: 1.6 }}>
            🎉 <strong>Congrats — Virtual Workspace is free until {freeUntilLabel}!</strong> No need to subscribe to keep using it during this period.
          </div>
        )}
        {needsCheckout && (
          <div style={{ padding: '12px 14px', marginBottom: 16, background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 12.5, lineHeight: 1.6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Payment authorization needed</strong> — your subscription was started but not yet paid.
              Razorpay has also emailed/texted you a link; you can complete it right here instead.
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleCompletePayment} disabled={busy} style={{ borderRadius: 0 }}>
                  {busy ? 'Opening…' : 'Complete Payment Setup'}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeLike ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '3px 10px',
                background: subscription.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--error-bg)',
                color: subscription.status === 'ACTIVE' ? 'var(--success)' : 'var(--error)',
              }}>
                {STATUS_LABEL[subscription.status] || subscription.status}
              </span>
              <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                {subscription.plan?.name ? `${subscription.plan.name} — ` : ''}
                {subscription.payment_method === 'WALLET_CREDITS' ? 'Paid from wallet credits' : 'Auto-pay via Razorpay'}
              </span>
            </div>
            {subscription.current_period_start && (
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 4px 0' }}>
                Started {formatDateTime(subscription.current_period_start)}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: 0 }}>
              ₹{subscription.effective_amount_credits}/month
              {subscription.current_period_end && ` — ${subscription.pending_cancellation ? 'full access until' : 'next charge'} ${formatDateTime(subscription.current_period_end)}`}
            </p>

            {subscription.pending_cancellation && (
              <p style={{ fontSize: 12, color: 'var(--warning)', margin: '8px 0 0 0', fontWeight: 600 }}>
                Cancellation scheduled — no further charges. Full access continues until the date above, then you'll drop to the Free plan (restricted).
              </p>
            )}

            {!subscription.pending_cancellation && (
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 16, paddingTop: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 8 }}>Switch Plan</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="form-control" value={switchPlanId} onChange={(e) => setSwitchPlanId(e.target.value)} style={{ maxWidth: 260 }}>
                    <option value="FREE">Free (Restricted Access)</option>
                    {plans?.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.monthly_price_credits}/month</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleSwitchPlan} disabled={busy || String(switchPlanId) === String(subscription.plan_id)} style={{ borderRadius: 0 }}>
                    {busy ? 'Switching…' : switchPlanId === 'FREE' ? 'Switch to Free' : 'Switch Plan'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6, marginBottom: 0 }}>
                  {switchPlanId === 'FREE'
                    ? 'Takes effect immediately — cancels billing right now and restricts your access (limited dashboard, no wallet recharge, no paid features) until you upgrade again.'
                    : "Takes effect immediately — starts a fresh billing cycle at the new plan's price."}
                </p>
              </div>
            )}

            {!subscription.pending_cancellation && (
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 16, paddingTop: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={busy} style={{ borderRadius: 0, color: 'var(--error)', border: '1px solid var(--error)' }}>
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {plans?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Choose a plan</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', cursor: 'pointer',
                        border: `1px solid ${String(planId) === String(p.id) ? 'var(--primary)' : 'var(--outline)'}`,
                        background: String(planId) === String(p.id) ? 'var(--primary-subtle)' : 'transparent',
                        minWidth: 140,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                        <input type="radio" checked={String(planId) === String(p.id)} onChange={() => setPlanId(String(p.id))} />
                        {p.name}
                      </span>
                      {p.first_cycle_price_credits != null && p.first_cycle_price_credits !== p.monthly_price_credits ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>₹{p.first_cycle_price_credits} first month</span>
                          <span style={{ fontSize: 10.5, color: 'var(--on-muted)' }}>then ₹{p.monthly_price_credits}/mo</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>₹{p.monthly_price_credits}/mo</span>
                      )}
                      {p.description && <span style={{ fontSize: 10.5, color: 'var(--on-muted)' }}>{p.description}</span>}
                      {p.included_features?.length > 0 && (
                        <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {p.included_features.map((feature, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10.5, color: 'var(--on-muted)' }}>
                              <Check size={11} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <input type="radio" checked={paymentMethod === 'RAZORPAY_AUTOPAY'} onChange={() => setPaymentMethod('RAZORPAY_AUTOPAY')} />
                <CreditCard size={13} /> Auto-pay (default)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <input type="radio" checked={paymentMethod === 'WALLET_CREDITS'} onChange={() => setPaymentMethod('WALLET_CREDITS')} />
                <Wallet size={13} /> Wallet Credits (Balance: {wallet_balance})
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <Tag size={13} color="var(--on-muted)" />
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Promo code (optional)"
                className="form-control"
                style={{ maxWidth: 220, textTransform: 'uppercase' }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 10px' }}>
              {paymentMethod === 'RAZORPAY_AUTOPAY'
                ? "You'll be charged right now, and auto-pay renews the same date every month."
                : "You'll be charged from your wallet right now, and it auto-renews the same date every month."}
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleSubscribe} disabled={busy || !planId} style={{ borderRadius: 0 }}>
              {busy ? 'Starting…' : 'Subscribe'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualWorkspaceSubscriptionCard;
