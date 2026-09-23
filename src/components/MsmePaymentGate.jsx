import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CreditCard } from 'lucide-react';
import { msmeApi } from '../api/msmeService';
import { useMsmeAuth } from '../context/MsmeAuthContext';
import { loadRazorpay } from '../utils/razorpay';
import { getErrorMessage } from '../utils/helpers';
import LoadingSpinner from './ui/LoadingSpinner';

// Wraps the MSME self-service onboarding: children render only once the
// one-time assessment fee is PAID. Payment order + signature verification
// happen server-side; the Razorpay key_id comes from the order response.
const MsmePaymentGate = ({ children }) => {
  const { user } = useMsmeAuth();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    loadGate();
  }, []);

  const loadGate = async () => {
    try {
      setLoading(true);
      const res = await msmeApi.getDashboard();
      setPaymentStatus(res.data.paymentStatus);
      if (res.data.paymentStatus !== 'PAID') {
        const configRes = await msmeApi.getPaymentConfig();
        setPaymentConfig(configRes.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load MSME dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Preview-only — never reserves a redemption slot (dryRun on the backend),
  // safe to call as many times as the user edits the code.
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoChecking(true);
    setPromoError('');
    try {
      const configRes = await msmeApi.getPaymentConfig(promoCode.trim());
      if (configRes.data.promo_valid === false) {
        setPromoError(configRes.data.promo_error || 'This promo code is not valid');
        // Reload the un-discounted config so the price shown resets.
        const base = await msmeApi.getPaymentConfig();
        setPaymentConfig(base.data);
      } else {
        setPaymentConfig(configRes.data);
      }
    } catch (err) {
      setPromoError(getErrorMessage(err) || 'Failed to check promo code');
    } finally {
      setPromoChecking(false);
    }
  };

  const clearPromo = async () => {
    setPromoCode('');
    setPromoError('');
    const base = await msmeApi.getPaymentConfig();
    setPaymentConfig(base.data);
  };

  const handlePayment = async () => {
    try {
      setActionLoading(true);
      const Razorpay = await loadRazorpay();
      const appliedPromo = promoCode.trim() && !promoError ? promoCode.trim() : null;
      const res = await msmeApi.createPaymentOrder(false, appliedPromo);
      const { order_id, amount_paise, currency, key_id } = res.data;

      const options = {
        key: key_id,
        amount: amount_paise,
        currency: currency,
        name: 'Cred2Tech MSME Assessment',
        description: 'Multi-Lender Eligibility Check',
        order_id: order_id,
        handler: async function (response) {
          const verifyData = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          // Razorpay has already captured the payment by the time this handler
          // fires, so a failed verify call here must not be reported as a plain
          // "failed" — retry transient network blips before surfacing the
          // backend's actual error, otherwise a momentary blip after a real
          // charge reads to the user as a lost payment.
          let lastErr;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await msmeApi.verifyPayment(verifyData);
              toast.success('Payment successful!');
              setPaymentStatus('PAID');
              return;
            } catch (err) {
              lastErr = err;
              if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          }
          toast.error(
            `${getErrorMessage(lastErr)} If the amount was deducted, refresh in a moment — if it still doesn't reflect, contact support with payment ID ${response.razorpay_payment_id}.`,
            { duration: 8000 }
          );
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: '#4F46E5' },
      };
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        toast.error(`Payment Failed: ${response.error.description}`);
        setActionLoading(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to initiate payment');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (paymentStatus === 'PAID') {
    return <>{children}</>;
  }

  return (
    <div className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--outline)',
            padding: 40,
            textAlign: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 64, height: 64, margin: '0 auto 20px',
              background: 'var(--primary-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CreditCard size={30} color="var(--primary)" />
          </motion.div>
          <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: 'var(--on-surface)' }}>Start Your Application</h3>
          <p style={{ color: 'var(--on-muted)', marginBottom: 30, lineHeight: 1.6, fontSize: 14 }}>
            To unlock the multi-lender eligibility check and start your application, a one-time assessment fee is required.
          </p>

          {paymentConfig && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'var(--surface-low)',
                border: '1px solid var(--outline)',
                padding: 24,
                maxWidth: 300,
                margin: '0 auto 30px',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Assessment Fee</div>
              {paymentConfig.promo_valid && paymentConfig.discounted_amount_inr != null ? (
                <>
                  <div style={{ fontSize: 15, color: 'var(--on-muted)', textDecoration: 'line-through' }}>₹{paymentConfig.amount_inr}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success)' }}>₹{paymentConfig.discounted_amount_inr}</div>
                  <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>You save ₹{paymentConfig.discount_amount_inr}</div>
                </>
              ) : (
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--on-surface)' }}>₹{paymentConfig.amount_inr}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 8 }}>One-time payment. Valid for 90 days.</div>
            </motion.div>
          )}

          <div style={{ maxWidth: 300, margin: '0 auto 20px', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                placeholder="Promo code (optional)"
                disabled={promoChecking || actionLoading}
                className="form-control"
                style={{ flex: 1, borderRadius: 0, textTransform: 'uppercase' }}
              />
              {paymentConfig?.promo_valid ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearPromo} style={{ borderRadius: 0 }}>Remove</button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || promoChecking}
                  style={{ borderRadius: 0, whiteSpace: 'nowrap' }}
                >
                  {promoChecking ? 'Checking…' : 'Apply'}
                </button>
              )}
            </div>
            {promoError && <p style={{ color: 'var(--error)', fontSize: 11, marginTop: 6 }}>{promoError}</p>}
            {paymentConfig?.promo_valid && <p style={{ color: 'var(--success)', fontSize: 11, marginTop: 6 }}>Promo code applied!</p>}
          </div>

          <button
            onClick={handlePayment}
            disabled={actionLoading || !paymentConfig}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', borderRadius: 0 }}
          >
            {actionLoading ? 'Processing...' : `Pay ₹${paymentConfig?.discounted_amount_inr ?? paymentConfig?.amount_inr ?? '...'} to Continue`}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default MsmePaymentGate;
