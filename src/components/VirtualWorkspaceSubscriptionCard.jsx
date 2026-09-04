import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { LayoutGrid, Wallet, CreditCard, Tag, AlertCircle, Check, ShieldCheck, ArrowUpCircle, ArrowDownCircle, Lock, Gift, Calendar, RefreshCw, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { loadRazorpay } from '../utils/razorpay';
import { getErrorMessage, formatDateTime } from '../utils/helpers';

const STATUS_LABEL = {
  CREATED: 'Awaiting first payment',
  AUTHENTICATED: 'Awaiting activation',
  ACTIVE: 'Active',
  PENDING: 'Payment retrying',
  HALTED: 'Payment failed, grace period',
  GRACE_PERIOD: 'Payment failed, grace period',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Small square icon chip, reused for the card header and every info/warning
// banner below it, so the same visual language repeats instead of a bare
// icon floating next to text.
const IconChip = ({ icon: Icon, color, bg, size = 34 }) => (
  <div style={{
    width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color,
  }}>
    <Icon size={Math.round(size * 0.46)} strokeWidth={1.75} />
  </div>
);

// A left-accent callout bar — used for the free-until notice, the payment-
// authorization warning, and the pending-cancellation notice. One shape,
// three semantic colors, instead of three hand-built banners.
const Callout = ({ icon, color, bg, children }) => (
  <div style={{
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px',
    background: bg, borderLeft: `3px solid ${color}`, marginBottom: 18,
  }}>
    <IconChip icon={icon} color={color} bg="transparent" size={20} />
    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--on-surface)' }}>{children}</div>
  </div>
);

// Label-above-value stat pair — replaces run-on sentences like "Started X,
// next charge Y" with a scannable pair of small metric cells.
const StatTile = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px', borderLeft: '1px solid var(--outline)' }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{value}</span>
  </div>
);

// One plan tile, shared by the "choose a plan" (not yet subscribed) and
// "all plans" (already subscribed, upgrade-only) grids, same visual
// language, different selectability rules depending on `variant`.
const PlanCard = ({ plan, variant, selected, onSelect, scheduled = false }) => {
  const isCurrent = variant === 'current';
  const isLocked = variant === 'locked'; // priced the same as current — no supported switch path either direction
  const isDowngrade = variant === 'downgrade'; // priced lower — selectable, takes effect at cycle end
  const disabled = isCurrent || isLocked;
  const hasIntro = plan.first_cycle_price_credits != null && plan.first_cycle_price_credits !== plan.monthly_price_credits;
  const accent = isCurrent ? 'var(--success)' : scheduled ? 'var(--warning)' : selected ? 'var(--primary)' : 'transparent';

  return (
    <label
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 16px 14px',
        cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${isCurrent ? 'var(--success)' : selected ? 'var(--primary)' : 'var(--outline)'}`,
        background: isCurrent ? 'var(--success-bg)' : selected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
        opacity: isLocked ? 0.55 : 1,
        minWidth: 180,
        maxWidth: 230,
        flex: '1 1 180px',
        transition: 'border-color 0.25s cubic-bezier(0.32,0.72,0,1), background 0.25s cubic-bezier(0.32,0.72,0,1), transform 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--on-surface)' }}>
          {!disabled && (
            <input type="radio" checked={selected} onChange={onSelect} style={{ margin: 0, accentColor: 'var(--primary)' }} />
          )}
          {plan.name}
        </span>
        {isCurrent && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldCheck size={11} strokeWidth={2} /> Current
          </span>
        )}
        {scheduled && !isCurrent && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ArrowDownCircle size={11} strokeWidth={2} /> Scheduled
          </span>
        )}
        {isLocked && <Lock size={12} strokeWidth={2} color="var(--on-muted)" />}
        {isDowngrade && !scheduled && <ArrowDownCircle size={12} strokeWidth={1.75} color="var(--on-muted)" />}
      </div>

      {hasIntro ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>{money(plan.first_cycle_price_credits)}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-muted)' }}>first month, then {money(plan.monthly_price_credits)}/mo</span>
        </div>
      ) : (
        <div>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>{money(plan.monthly_price_credits)}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-muted)' }}>/mo</span>
        </div>
      )}

      {plan.description && <span style={{ fontSize: 11, color: 'var(--on-muted)' }}>{plan.description}</span>}

      {plan.included_features?.length > 0 && (
        <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {plan.included_features.map((feature, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--on-muted)' }}>
              <Check size={12} strokeWidth={2} color="var(--success)" style={{ flexShrink: 0, marginTop: 1.5 }} />
              {feature}
            </li>
          ))}
        </ul>
      )}

      {isLocked && (
        <span style={{ fontSize: 10.5, color: 'var(--on-muted)', marginTop: 2 }}>Same price as your current plan</span>
      )}
      {scheduled && (
        <span style={{ fontSize: 10.5, color: 'var(--warning)', marginTop: 2, fontWeight: 600 }}>Switching to this plan at your next renewal</span>
      )}
    </label>
  );
};

// Payment-method selection tile, mirrors PlanCard's own selectable-card
// language instead of a bare radio + inline icon + text row.
const MethodTile = ({ icon: Icon, label, sublabel, selected, onSelect }) => (
  <label
    style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flex: '1 1 200px', cursor: 'pointer',
      border: `1px solid ${selected ? 'var(--primary)' : 'var(--outline)'}`,
      background: selected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
      transition: 'border-color 0.25s cubic-bezier(0.32,0.72,0,1), background 0.25s cubic-bezier(0.32,0.72,0,1)',
    }}
  >
    <input type="radio" checked={selected} onChange={onSelect} style={{ margin: 0, accentColor: 'var(--primary)' }} />
    <Icon size={16} strokeWidth={1.75} color={selected ? 'var(--primary)' : 'var(--on-muted)'} />
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--on-surface)' }}>{label}</div>
      {sublabel && <div style={{ fontSize: 10.5, color: 'var(--on-muted)', marginTop: 1 }}>{sublabel}</div>}
    </div>
  </label>
);

// Self-contained, fetches/manages its own state so it can drop into
// OrganizationProfilePage.jsx without threading into that page's own large
// form/state. DSA_ADMIN only, matches the subscription routes' own gating.
//
// Deliberately simple, on purpose: a tenant who chooses to pay (either
// payment method) is always charged and activated immediately, and renews
// on that same date every month, regardless of the platform-wide free_until
// date below. That date only ever matters to a tenant who DOESN'T subscribe
// (see is_currently_free below, and Sidebar.jsx's gate). It never defers or
// splits an active subscribe/upgrade.
//
// Switching plans is upgrade-only: a tenant already subscribed can only
// move to a HIGHER-priced plan (paying the price difference right now,
// same subscription/mandate kept, see upgradePlan()'s doc comment on the
// backend). Moving to anything cheaper, including Free, only ever happens
// via Cancel, which keeps the current plan active until it actually
// expires rather than switching mid-cycle.
const VirtualWorkspaceSubscriptionCard = () => {
  const { hasRole, refreshUser } = useAuth();
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
      const currentPlanId = res.data.subscription?.plan_id || res.data.plans?.[0]?.id || '';
      setPlanId(String(currentPlanId));
      // Defaults to the current plan itself, nothing pre-selected as an
      // "upgrade" until the tenant actually picks a pricier one.
      setSwitchPlanId(String(currentPlanId));
    } catch {
      // Non-fatal, card just shows nothing actionable.
    } finally {
      setLoading(false);
    }
    // Sidebar.jsx's nav-access gate reads virtual_workspace_restricted_nav_
    // item_ids off the GLOBAL AuthContext user object, which only /auth/me
    // repopulates, refreshing this card's OWN status above does nothing
    // for it. Without this, a subscribe/upgrade/cancel just now still shows
    // the Free plan's restricted sidebar until the next full page reload.
    // Cheap enough to just always pair it with the card's own refresh.
    refreshUser().catch(() => {});
  }, [refreshUser]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!hasRole('DSA_ADMIN') || loading || !status) return null;

  const { subscription, wallet_balance, plans, monthly_price_credits, is_currently_free, free_until, key_id, scheduled_downgrade_plan } = status;
  const freeUntilLabel = free_until ? new Date(free_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  // Cheapest plan first (left), priciest last (right), in both the initial
  // "Choose a plan" grid and the already-subscribed "All Plans" grid, so the
  // price ladder always reads left-to-right regardless of API/DB order.
  const sortedPlans = plans ? [...plans].sort((a, b) => a.monthly_price_credits - b.monthly_price_credits) : plans;

  // Opens Razorpay Checkout for mandate authorization against an
  // already-created subscription, shared by a fresh subscribe and by
  // "Complete Payment Setup" for one stuck at CREATED/AUTHENTICATED (e.g.
  // one an admin started on this tenant's behalf, or a Checkout the tenant
  // closed before finishing). The authorization itself IS the charge,
  // Razorpay bills immediately on success.
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

  // Opens Razorpay Checkout for a plain ONE-TIME payment (an Order, not a
  // Subscription), the upgrade price-difference charge. onPaid runs
  // after Razorpay confirms the payment client-side; the caller is
  // responsible for verifying it server-side (confirm-upgrade-payment).
  const openOneTimeCheckout = async ({ order_id, amount, currency, key_id: orderKeyId }, description, onPaid) => {
    const Razorpay = await loadRazorpay();
    const rzp = new Razorpay({
      key: orderKeyId || key_id,
      order_id,
      amount,
      currency,
      name: 'Cred2Tech Virtual Workspace',
      description,
      handler: (response) => onPaid(response),
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
        toast.success('Subscribed. Paid from wallet credits');
        await fetchStatus();
        return;
      }

      // RAZORPAY_AUTOPAY, open Checkout against the created subscription;
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

  const selectedSwitchPlan = plans?.find((p) => String(p.id) === String(switchPlanId));
  const upgradeDiff = selectedSwitchPlan ? selectedSwitchPlan.monthly_price_credits - subscription?.effective_amount_credits : 0;

  const handleSwitchPlan = async () => {
    if (!switchPlanId || !selectedSwitchPlan) return toast.error('Select a plan');
    if (String(switchPlanId) === String(subscription.plan_id)) return toast.error('You are already on this plan');
    if (upgradeDiff <= 0) return toast.error('Cancel your subscription to move to a lower-priced plan');
    setBusy(true);
    try {
      const res = await api.post('/virtual-workspace/subscription/upgrade', { plan_id: switchPlanId });

      if (res.data.payment_method === 'WALLET_CREDITS') {
        toast.success(`Upgraded to ${selectedSwitchPlan.name}. ${money(upgradeDiff)} debited from wallet`);
        await fetchStatus();
        return;
      }

      // RAZORPAY_AUTOPAY, a one-time Checkout for just the price
      // difference; paying it is what applies the upgrade.
      await openOneTimeCheckout(
        res.data,
        `Upgrade to ${selectedSwitchPlan.name}, price difference`,
        async (response) => {
          try {
            await api.post('/virtual-workspace/subscription/confirm-upgrade-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Upgraded to ${selectedSwitchPlan.name}. Subscription stays active, auto-pay bills the new price from next cycle`);
            await fetchStatus();
          } catch (err) {
            toast.error(getErrorMessage(err) || 'Payment succeeded, but applying the upgrade failed. Contact support with this payment reference.', { duration: 10000 });
            await fetchStatus();
          }
        }
      );
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to switch plan');
    } finally {
      setBusy(false);
    }
  };

  // Schedules a switch to a LOWER-priced plan, effective at the end of the
  // current cycle, never mid-cycle. Nothing is charged now — this only
  // changes what the NEXT renewal bills and switches to.
  const handleScheduleDowngrade = async () => {
    if (!switchPlanId || !selectedSwitchPlan) return toast.error('Select a plan');
    if (String(switchPlanId) === String(subscription.plan_id)) return toast.error('You are already on this plan');
    const downgradeDiff = subscription.effective_amount_credits - selectedSwitchPlan.monthly_price_credits;
    if (downgradeDiff <= 0) return toast.error('Select a lower-priced plan to downgrade, or use Upgrade for a higher-priced one');
    const periodEndLabel = subscription.current_period_end ? formatDateTime(subscription.current_period_end) : 'the end of your current cycle';
    if (!window.confirm(`Switch to ${selectedSwitchPlan.name} (${money(selectedSwitchPlan.monthly_price_credits)}/mo)? This will not take effect until your current plan ends on ${periodEndLabel}. You keep full access at today's price until then, and auto-pay will renew at the new, lower price from your next cycle.`)) return;
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/downgrade', { plan_id: switchPlanId });
      toast.success(`Downgrade to ${selectedSwitchPlan.name} scheduled. It takes effect at your next renewal on ${periodEndLabel}.`);
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to schedule the downgrade');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelScheduledDowngrade = async () => {
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/cancel-downgrade');
      toast.success('Scheduled downgrade cancelled. You will stay on your current plan.');
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to cancel the scheduled downgrade');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    const hasRunningCycle = ['ACTIVE', 'PAUSED'].includes(subscription.status) && subscription.current_period_end;
    const confirmMsg = hasRunningCycle
      ? `Cancel your subscription? You won't be charged again. Full access stays as-is until ${formatDateTime(subscription.current_period_end)}, then you'll drop to the Free plan (restricted dashboard, no wallet recharge, no paid features) until you resubscribe.`
      : `Cancel this subscription? You won't be charged, and you'll move to the Free plan (restricted access) right away.`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/cancel');
      toast.success(hasRunningCycle ? 'Subscription cancelled. No further charges. Full access continues until your current period ends.' : 'Subscription cancelled. No further charges.');
      await fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to cancel subscription');
    } finally {
      setBusy(false);
    }
  };

  const activeLike = subscription && ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'GRACE_PERIOD', 'PAUSED'].includes(subscription.status);
  const needsCheckout = subscription && ['CREATED', 'AUTHENTICATED'].includes(subscription.status) && subscription.payment_method === 'RAZORPAY_AUTOPAY';
  const isHealthy = subscription?.status === 'ACTIVE';

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderTop: '3px solid var(--primary)', marginTop: 24 }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconChip icon={LayoutGrid} color="var(--primary)" bg="var(--primary-subtle)" size={38} />
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace Subscription</h3>
          <p style={{ fontSize: 11.5, color: 'var(--on-muted)', margin: '3px 0 0 0' }}>
            {freeUntilLabel ? `Free until ${freeUntilLabel} for tenants who don't subscribe. Plans below are ${money(monthly_price_credits)}/month and start right away` : `From ${money(monthly_price_credits)}/month, auto-renews`}
          </p>
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {is_currently_free && !activeLike && (
          <Callout icon={Gift} color="var(--success)" bg="var(--success-bg)">
            <strong style={{ color: 'var(--success)' }}>Virtual Workspace is free until {freeUntilLabel}.</strong> No need to subscribe to keep using it during this period.
          </Callout>
        )}
        {needsCheckout && (
          <Callout icon={AlertCircle} color="var(--warning)" bg="var(--warning-bg)">
            <strong style={{ color: 'var(--warning)' }}>Payment authorization needed.</strong> Your subscription was started but not yet paid.
            Razorpay has also emailed and texted you a link; you can complete it right here instead.
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={handleCompletePayment} disabled={busy} style={{ borderRadius: 0 }}>
                {busy ? 'Opening…' : 'Complete Payment Setup'}
              </button>
            </div>
          </Callout>
        )}
        {activeLike ? (
          <div>
            {/* Status header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, padding: '5px 12px',
                background: isHealthy ? 'var(--success-bg)' : 'var(--error-bg)',
                color: isHealthy ? 'var(--success)' : 'var(--error)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span style={{ width: 6, height: 6, background: 'currentColor', display: 'inline-block' }} />
                {STATUS_LABEL[subscription.status] || subscription.status}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--on-muted)' }}>
                {subscription.plan?.name ? `${subscription.plan.name} · ` : ''}
                {subscription.payment_method === 'WALLET_CREDITS' ? 'Paid from wallet credits' : 'Auto-pay via Razorpay'}
              </span>
            </div>

            {/* Price hero */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '14px 0 16px' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>{money(subscription.effective_amount_credits)}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-muted)' }}>/month</span>
            </div>

            {/* Date stats */}
            {(subscription.current_period_start || subscription.current_period_end) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid var(--outline)', marginBottom: subscription.pending_cancellation ? 16 : 0 }}>
                {subscription.current_period_start && (
                  <StatTile label="Started" value={formatDateTime(subscription.current_period_start)} />
                )}
                {subscription.current_period_end && (
                  <StatTile
                    label={subscription.pending_cancellation ? 'Full access until' : 'Next charge'}
                    value={formatDateTime(subscription.current_period_end)}
                  />
                )}
              </div>
            )}

            {subscription.pending_cancellation && (
              <Callout icon={XCircle} color="var(--warning)" bg="var(--warning-bg)">
                <strong style={{ color: 'var(--warning)' }}>Cancellation scheduled.</strong> No further charges. Full access continues until the date above, then you'll drop to the Free plan (restricted).
              </Callout>
            )}

            {!subscription.pending_cancellation && plans?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 20, paddingTop: 20 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpCircle size={14} strokeWidth={1.75} /> All Plans
                </p>

                {scheduled_downgrade_plan && (
                  <Callout icon={ArrowDownCircle} color="var(--warning)" bg="var(--warning-bg)">
                    <strong style={{ color: 'var(--warning)' }}>Downgrade scheduled.</strong> Switching to {scheduled_downgrade_plan.name} ({money(scheduled_downgrade_plan.monthly_price_credits)}/mo) at your next renewal
                    {subscription.current_period_end ? ` on ${formatDateTime(subscription.current_period_end)}` : ''}. You keep full access at today's price until then.
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-ghost btn-sm" onClick={handleCancelScheduledDowngrade} disabled={busy} style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={13} strokeWidth={1.75} /> {busy ? 'Cancelling…' : 'Cancel Scheduled Downgrade'}
                      </button>
                    </div>
                  </Callout>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  {sortedPlans.map((p) => {
                    const isCurrent = String(p.id) === String(subscription.plan_id);
                    // Same price as current: no supported switch path either
                    // way, stays locked. Strictly lower: selectable as a
                    // downgrade, deferred to cycle end (see scheduleDowngrade
                    // on the backend). Strictly higher: the existing
                    // immediate, pay-the-difference upgrade path.
                    const isLocked = !isCurrent && p.monthly_price_credits === subscription.effective_amount_credits;
                    const isDowngradeTarget = !isCurrent && p.monthly_price_credits < subscription.effective_amount_credits;
                    const variant = isCurrent ? 'current' : isLocked ? 'locked' : isDowngradeTarget ? 'downgrade' : 'upgrade';
                    return (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        variant={variant}
                        scheduled={scheduled_downgrade_plan?.id === p.id}
                        selected={String(switchPlanId) === String(p.id)}
                        onSelect={() => setSwitchPlanId(String(p.id))}
                      />
                    );
                  })}
                </div>
                {selectedSwitchPlan && String(switchPlanId) !== String(subscription.plan_id) && upgradeDiff > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px', background: 'var(--primary-subtle)', borderLeft: '3px solid var(--primary)' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSwitchPlan} disabled={busy} style={{ borderRadius: 0, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowUpCircle size={14} strokeWidth={2} /> {busy ? 'Upgrading…' : `Upgrade to ${selectedSwitchPlan.name}, pay ${money(upgradeDiff)} now`}
                    </button>
                    <span style={{ fontSize: 11.5, color: 'var(--on-muted)' }}>
                      Your subscription stays active. This charges just the difference, and auto-pay bills {money(selectedSwitchPlan.monthly_price_credits)}/mo from next cycle.
                    </span>
                  </div>
                )}
                {selectedSwitchPlan && String(switchPlanId) !== String(subscription.plan_id) && upgradeDiff < 0 && scheduled_downgrade_plan?.id !== selectedSwitchPlan.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleScheduleDowngrade} disabled={busy} style={{ borderRadius: 0, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowDownCircle size={14} strokeWidth={2} /> {busy ? 'Scheduling…' : `Schedule downgrade to ${selectedSwitchPlan.name}`}
                    </button>
                    <span style={{ fontSize: 11.5, color: 'var(--on-muted)' }}>
                      This will not take effect until your current plan ends. You keep full access at today's price until then, and auto-pay renews at {money(selectedSwitchPlan.monthly_price_credits)}/mo from your next cycle.
                    </span>
                  </div>
                )}
              </div>
            )}

            {!subscription.pending_cancellation && (
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 20, paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 11.5, color: 'var(--on-muted)', margin: 0, maxWidth: 460 }}>
                  Want to switch to a lower-priced plan? Select it above instead. Want to stop paying entirely (Free plan)? Cancel below. Either way, your current plan stays active until it expires, with no mid-cycle switch.
                </p>
                <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={busy} style={{ borderRadius: 0, color: 'var(--error)', border: '1px solid var(--error)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={14} strokeWidth={1.75} /> Cancel Subscription
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {plans?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Choose a plan</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {sortedPlans.map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      variant="upgrade"
                      selected={String(planId) === String(p.id)}
                      onSelect={() => setPlanId(String(p.id))}
                    />
                  ))}
                </div>
              </div>
            )}

            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Payment method</label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <MethodTile
                icon={CreditCard}
                label="Auto-pay"
                sublabel="Default, via Razorpay"
                selected={paymentMethod === 'RAZORPAY_AUTOPAY'}
                onSelect={() => setPaymentMethod('RAZORPAY_AUTOPAY')}
              />
              <MethodTile
                icon={Wallet}
                label="Wallet Credits"
                sublabel={`Balance: ${wallet_balance}`}
                selected={paymentMethod === 'WALLET_CREDITS'}
                onSelect={() => setPaymentMethod('WALLET_CREDITS')}
              />
            </div>

            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Promo code (optional)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <Tag size={13} strokeWidth={1.75} color="var(--on-muted)" />
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. WELCOME20"
                className="form-control"
                style={{ maxWidth: 220, textTransform: 'uppercase', borderRadius: 0 }}
              />
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--on-muted)', margin: '0 0 14px' }}>
              {paymentMethod === 'RAZORPAY_AUTOPAY'
                ? "You'll be charged right now, and auto-pay renews the same date every month."
                : "You'll be charged from your wallet right now, and it auto-renews the same date every month."}
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleSubscribe} disabled={busy || !planId} style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} strokeWidth={2} /> {busy ? 'Starting…' : 'Subscribe'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualWorkspaceSubscriptionCard;
