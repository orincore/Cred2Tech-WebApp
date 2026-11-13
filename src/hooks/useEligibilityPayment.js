import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { msmeApi } from '../api/msmeService';
import { loadRazorpay, createRazorpayCheckout } from '../utils/razorpay';
import { getErrorMessage } from '../utils/helpers';
import { gstinError } from '../components/msme/GstNumberField';
import { invoiceDetailsError } from '../components/msme/InvoiceDetailsFields';

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
  // Optional GST number for the tax invoice; pre-filled with the customer's last one.
  const [gstin, setGstin] = useState('');
  // Name + email, both required while the account still has the signup
  // placeholders (payment config's details_required): the name is printed on
  // the invoice, and the invoice and Razorpay receipt are emailed.
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const detailsRequired = !!paymentConfig?.details_required;

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
      setGstin(conf.data?.saved_gstin || '');
      // Pre-fill whichever of the two the account already has for real.
      setInvoiceName(conf.data?.billing_name || '');
      setInvoiceEmail(conf.data?.billing_email || '');
      setShowPaymentModal(true);
    } catch (err) {
      toast.error('Failed to load pricing');
    } finally {
      setActionLoading(false);
    }
  };

  const initiatePayment = async () => {
    const detailsError = detailsRequired ? invoiceDetailsError(invoiceName, invoiceEmail) : null;
    if (detailsError) return toast.error(detailsError);
    if (gstinError(gstin)) return toast.error(gstinError(gstin));
    try {
      setActionLoading(true);
      const Razorpay = await loadRazorpay();
      // forceNew — never attach to the old resumable case
      const details = detailsRequired ? { name: invoiceName.trim(), email: invoiceEmail.trim() } : null;
      const orderRes = await msmeApi.createPaymentOrder(true, null, gstin.trim(), details);
      const { order_id, amount_paise, currency, key_id, customer_name, customer_email } = orderRes.data;
      // The server saved both to the profile; don't ask again.
      if (detailsRequired) {
        setPaymentConfig((c) => (c ? { ...c, details_required: false, billing_name: customer_name, billing_email: customer_email } : c));
      }

      const options = {
        key: key_id,
        amount: amount_paise,
        currency,
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
          // The account's real name/email from the server — never the signup
          // placeholders, which would make Razorpay's receipt bounce.
          name: customer_name || undefined,
          email: customer_email || undefined,
          contact: prefill?.mobile,
        },
      };

      // Name, logo and colours come from the shared Cred2Tech branding.
      const rzp = createRazorpayCheckout(Razorpay, options);
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
    gstin,
    setGstin,
    // Everything the payment modal needs for the required name + email fields.
    invoiceDetails: {
      required: detailsRequired,
      name: invoiceName,
      email: invoiceEmail,
      setName: setInvoiceName,
      setEmail: setInvoiceEmail,
    },
    startNewCase,
    initiatePayment,
    closePaymentModal: () => setShowPaymentModal(false),
  };
}
