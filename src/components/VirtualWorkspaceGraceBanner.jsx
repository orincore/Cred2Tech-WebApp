import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Wallet, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { loadRazorpay } from '../utils/razorpay';
import { getErrorMessage } from '../utils/helpers';

const GRACE_STATUSES = ['HALTED', 'GRACE_PERIOD', 'PENDING'];
// Re-checks periodically so the banner clears itself once the tenant fixes
// payment from another tab/device, without needing a full page reload.
const POLL_MS = 5 * 60 * 1000;

// Persistent, site-wide — visible for a DSA_ADMIN whenever their tenant's
// Virtual Workspace subscription is failing to auto-charge, per the
// confirmed placement ("under account" = the top banner, not tucked away
// on a settings page they might not visit during the 5-day grace window).
const VirtualWorkspaceGraceBanner = () => {
  const { user, hasRole } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const isDsaAdmin = hasRole('DSA_ADMIN');

  const fetchStatus = useCallback(async () => {
    if (!isDsaAdmin) return;
    try {
      const res = await api.get('/virtual-workspace/subscription');
      setStatus(res.data);
    } catch {
      // Non-fatal — banner just stays hidden if this fails.
    }
  }, [isDsaAdmin]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!isDsaAdmin || !status?.subscription || !GRACE_STATUSES.includes(status.subscription.status)) {
    return null;
  }

  const { subscription, wallet_balance, grace_period_days } = status;
  const daysRemaining = subscription.grace_period_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.grace_period_ends_at) - new Date()) / (24 * 60 * 60 * 1000)))
    : grace_period_days;
  const canPayFromWallet = wallet_balance >= subscription.effective_amount_credits;

  const handleUpdatePayment = async () => {
    setBusy(true);
    try {
      const Razorpay = await loadRazorpay();
      const options = {
        key: status.key_id,
        subscription_id: subscription.razorpay_subscription_id,
        name: 'Cred2Tech Virtual Workspace',
        description: 'Monthly subscription — retry payment',
        handler: async (response) => {
          try {
            await api.post('/virtual-workspace/subscription/confirm', {
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment updated — Virtual Workspace is active again');
            fetchStatus();
          } catch (err) {
            toast.error(getErrorMessage(err) || 'Failed to confirm payment');
          }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#4F46E5' },
      };
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to open payment retry');
    } finally {
      setBusy(false);
    }
  };

  const handlePayFromWallet = async () => {
    setBusy(true);
    try {
      await api.post('/virtual-workspace/subscription/pay-grace-from-wallet');
      toast.success('Paid from wallet credits — Virtual Workspace is active again');
      fetchStatus();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to pay from wallet credits');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: 'var(--error-bg)', borderBottom: '1px solid var(--error)',
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontWeight: 600 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>
          Your Virtual Workspace subscription payment failed. Fix it within {daysRemaining} day{daysRemaining === 1 ? '' : 's'} to avoid losing access.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {canPayFromWallet && (
          <button
            onClick={handlePayFromWallet}
            disabled={busy}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 0 }}
          >
            <Wallet size={13} /> Pay ₹{subscription.effective_amount_credits} from Wallet ({wallet_balance} cr)
          </button>
        )}
        <button
          onClick={handleUpdatePayment}
          disabled={busy}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 0 }}
        >
          <CreditCard size={13} /> Update Payment Method
        </button>
      </div>
    </div>
  );
};

export default VirtualWorkspaceGraceBanner;
