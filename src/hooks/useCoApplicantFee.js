import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { msmeApi } from '../api/msmeService';
import { loadRazorpay, createRazorpayCheckout } from '../utils/razorpay';
import { getErrorMessage } from '../utils/helpers';
import { gstinError } from '../components/msme/GstNumberField';
import { invoiceDetailsError } from '../components/msme/InvoiceDetailsFields';

/**
 * Direct-MSME co-applicant fee (₹400 + GST per co-applicant). One payment = one
 * co-applicant. The server is the gate: a co-applicant is only saved when a paid,
 * unused slot exists for the case (402 otherwise). This hook decides, when the
 * customer clicks "+ Add Co-Applicant", whether a paid slot is already waiting or
 * the payment pop-up must open first.
 *
 * requestCoApplicantSlot(pendingNewRows, onReady, { mobile }):
 *   - a co-applicant row not saved yet already holds the waiting slot, so another
 *     one cannot be started until it is saved (one slot at a time);
 *   - a paid, unused slot -> onReady() straight away;
 *   - otherwise the payment pop-up opens, and onReady() runs once the payment is
 *     verified.
 */
export function useCoApplicantFee({ caseId } = {}) {
  const [quote, setQuote] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [gstin, setGstin] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const onReadyRef = useRef(null);
  // The customer's own mobile, to pre-fill Razorpay Checkout's contact field.
  const mobileRef = useRef(null);

  const detailsRequired = !!quote?.details_required;

  const requestCoApplicantSlot = async (pendingNewRows, onReady, { mobile = null } = {}) => {
    mobileRef.current = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : null;
    if (!caseId) {
      toast.error('Please complete your business details first.');
      return;
    }
    if (pendingNewRows > 0) {
      toast.error('Please save the co-applicant you have already added before adding another one.');
      return;
    }
    setChecking(true);
    try {
      const { data } = await msmeApi.getCoApplicantFee(caseId);
      setQuote(data);
      if (data.available_slots > 0) {
        onReady();
        return;
      }
      setGstin(data.saved_gstin || '');
      setInvoiceName(data.billing_name || '');
      setInvoiceEmail(data.billing_email || '');
      onReadyRef.current = onReady;
      setIsOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not load the co-applicant fee. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const finish = () => {
    setIsOpen(false);
    setPaying(false);
    const cb = onReadyRef.current;
    onReadyRef.current = null;
    if (cb) cb();
  };

  const pay = async () => {
    const detailsError = detailsRequired ? invoiceDetailsError(invoiceName, invoiceEmail) : null;
    if (detailsError) return toast.error(detailsError);
    if (gstinError(gstin)) return toast.error(gstinError(gstin));
    setPaying(true);
    try {
      const Razorpay = await loadRazorpay();
      const details = detailsRequired ? { name: invoiceName.trim(), email: invoiceEmail.trim() } : null;
      let orderRes;
      try {
        orderRes = await msmeApi.createCoApplicantOrder(caseId, gstin.trim(), details);
      } catch (err) {
        // Already paid for one that is not used yet: no second charge, just continue.
        if (err?.response?.data?.code === 'CO_APPLICANT_SLOT_AVAILABLE') {
          toast.success('Your co-applicant payment is already done. You can add the co-applicant now.');
          finish();
          return;
        }
        throw err;
      }
      const { order_id, amount_paise, currency, key_id, customer_name, customer_email } = orderRes.data;

      const rzp = createRazorpayCheckout(Razorpay, {
        key: key_id,
        amount: amount_paise,
        currency,
        order_id,
        description: 'Additional Co-Applicant',
        handler: async (response) => {
          const verifyData = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          // Razorpay has already captured the payment here: retry transient
          // failures before reporting, so a network blip never reads as lost money.
          let lastErr;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              await msmeApi.verifyPayment(verifyData);
              toast.success('Payment successful! You can now add your co-applicant. Your invoice has been emailed to you.');
              finish();
              return;
            } catch (err) {
              lastErr = err;
              if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
            }
          }
          toast.error(
            `${getErrorMessage(lastErr)} If the amount was deducted, try adding the co-applicant again in a moment — if it still fails, contact support with payment ID ${response.razorpay_payment_id}.`,
            { duration: 8000 }
          );
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
        prefill: { name: customer_name || undefined, email: customer_email || undefined, contact: mobileRef.current || undefined },
      });
      rzp.on('payment.failed', (r) => {
        toast.error(`Payment failed: ${r.error.description}`);
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start the payment');
      setPaying(false);
    }
  };

  return {
    requestCoApplicantSlot,
    checkingCoApplicantSlot: checking,
    coApplicantPayment: {
      isOpen,
      quote,
      paying,
      gstin,
      setGstin,
      invoiceDetails: {
        required: detailsRequired,
        name: invoiceName,
        email: invoiceEmail,
        setName: setInvoiceName,
        setEmail: setInvoiceEmail,
      },
      pay,
      close: () => { if (!paying) { setIsOpen(false); onReadyRef.current = null; } },
    },
  };
}
