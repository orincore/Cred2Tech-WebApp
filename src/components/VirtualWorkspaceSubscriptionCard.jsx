import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { LayoutGrid, Wallet, CreditCard, Tag } from 'lucide-react';
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
const VirtualWorkspaceSubscriptionCard = () => {
  const { hasRole } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY_AUTOPAY');
  const [promoCode, setPromoCode] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/virtual-workspace/subscription');
      setStatus(res.data);
    } catch {
      // Non-fatal — card just shows nothing actionable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!hasRole('DSA_ADMIN') || loading || !status) return null;

  const { subscription, wallet_balance, monthly_price_credits, billing_enabled } = status;

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const res = await api.post('/virtual-workspace/subscription/subscribe', {
        payment_method: paymentMethod,
        promo_code: promoCode.trim() || null,
      });

      if (res.data.payment_method === 'WALLET_CREDITS') {
        toast.success('Subscribed — paid from wallet credits');
        await fetchStatus();
        return;
      }

      // RAZORPAY_AUTOPAY — open Checkout against the created subscription.
      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: res.data.key_id,
        subscription_id: res.data.razorpay_subscription_id,
        name: 'Cred2Tech Virtual Workspace',
        description: 'Monthly subscription',
        handler: async (response) => {
          try {
            await api.post('/virtual-workspace/subscription/confirm', {
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Subscribed to Virtual Workspace');
            fetchStatus();
          } catch (err) {
            toast.error(getErrorMessage(err) || 'Failed to confirm subscription');
          }
        },
        theme: { color: '#4F46E5' },
      });
      rzp.on('payment.failed', (response) => toast.error(`Payment failed: ${response.error.description}`));
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start subscription');
    } finally {
      setBusy(false);
    }
  };

  const activeLike = subscription && ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'GRACE_PERIOD'].includes(subscription.status);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', marginTop: 24 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <LayoutGrid size={16} color="var(--primary)" />
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace Subscription</h3>
          <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>
            {billing_enabled ? `₹${monthly_price_credits}/month — auto-renews` : `Free until 2027-09-30 — ₹${monthly_price_credits}/month afterward`}
          </p>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {activeLike ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '3px 10px',
                background: subscription.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--error-bg)',
                color: subscription.status === 'ACTIVE' ? 'var(--success)' : 'var(--error)',
              }}>
                {STATUS_LABEL[subscription.status] || subscription.status}
              </span>
              <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                {subscription.payment_method === 'WALLET_CREDITS' ? 'Paid from wallet credits' : 'Auto-pay via Razorpay'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: 0 }}>
              ₹{subscription.effective_amount_credits}/month
              {subscription.current_period_end && ` — next charge ${formatDateTime(subscription.current_period_end)}`}
            </p>
          </div>
        ) : (
          <>
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
            <button className="btn btn-primary btn-sm" onClick={handleSubscribe} disabled={busy} style={{ borderRadius: 0 }}>
              {busy ? 'Starting…' : `Subscribe — ₹${monthly_price_credits}/month`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualWorkspaceSubscriptionCard;
