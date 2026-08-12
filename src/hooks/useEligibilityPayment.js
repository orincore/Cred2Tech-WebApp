import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { msmeApi } from '../api/msmeService';
import { loadRazorpay } from '../utils/razorpay';
import { getErrorMessage } from '../utils/helpers';

/**
 * Shared "start a NEW case" flow for the MSME portal — extracted from
 * MsmeDashboardPage so MsmeCasesPage's "New Case" button can trigger the
 * exact same payment gate instead of duplicating the Razorpay wiring.
 *
 * Deliberately always lands on a blank onboarding form (no ?caseId=) —
 * never resumes whatever case is currently in progress, even if that case's
 * own payment happens to be settled (that money is earmarked for that case,
 * not free to skip the gateway for a second one). The one thing allowed to
 * skip payment is a genuinely unclaimed payment — `hasUnclaimedPayment` from
 * msmeApi.getDashboard() — money paid but not yet attached to any case.
 *
 * @param {{ prefill?: { name?: string, email?: string, mobile?: string } }} [opts]
 */
export function useEligibilityPayment({ prefill } = {}) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);

  const goToOnboarding = () => navigate('/msme/onboarding');

  // hasUnclaimedPayment comes from whatever already fetched it (dashboard or
  // cases list) — this hook doesn't own that fetch, so the same server
  // response isn't requested twice on one page.
  const startNewCase = async (hasUnclaimedPayment) => {
    if (hasUnclaimedPayment) {
      goToOnboarding();
      return;
    }
    setActionLoading(true);
    try {
      const conf = await msmeApi.getPaymentConfig();
      setPaymentConfig(conf.data);
      setShowPaymentModal(true);
    } catch (err) {
      toast.error('Failed to load pricing');
    } finally {
      setActionLoading(false);
    }
  };

  const initiatePayment = async () => {
    try {
      setActionLoading(true);
      const Razorpay = await loadRazorpay();
      const orderRes = await msmeApi.createPaymentOrder(true); // forceNew — never attach to the old resumable case
      const { order_id, amount_paise, currency, key_id } = orderRes.data;

      const options = {
        key: key_id,
        amount: amount_paise,
        currency,
        name: 'Cred2Tech',
        description: 'Eligibility Assessment Fee',
        order_id,
        handler: async function (response) {
          const verifyData = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          // Razorpay has already captured the payment by the time this handler
          // fires, so a failed verify call here must not be reported as a plain
          // "failed" — retry transient network blips before surfacing the
          // backend's actual error.
          let lastErr;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await msmeApi.verifyPayment(verifyData);
              toast.success('Payment successful!');
              setShowPaymentModal(false);
              setActionLoading(false);
              // Always a fresh case — createPaymentOrder(forceNew) never
              // linked this payment to a pre-existing case.
              goToOnboarding();
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
          setActionLoading(false);
        },
        prefill: {
          name: prefill?.name,
          email: prefill?.email,
          contact: prefill?.mobile,
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
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    showPaymentModal,
    paymentConfig,
    startNewCase,
    initiatePayment,
    closePaymentModal: () => setShowPaymentModal(false),
  };
}
