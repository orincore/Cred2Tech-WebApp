import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import MsmeFeeBreakdown from './MsmeFeeBreakdown';
import GstNumberField, { gstinError } from './GstNumberField';
import InvoiceDetailsFields, { invoiceDetailsError } from './InvoiceDetailsFields';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Payment pop-up for one additional co-applicant (Direct MSME). Same look as
 * EligibilityPaymentModal; all state and the Razorpay flow live in
 * useCoApplicantFee — pass its `coApplicantPayment` object as `payment`.
 */
const CoApplicantPaymentModal = ({ payment }) => {
  const { isOpen, quote, paying, gstin, setGstin, invoiceDetails, pay, close } = payment || {};
  const detailsError = invoiceDetails?.required ? invoiceDetailsError(invoiceDetails.name, invoiceDetails.email) : null;

  return (
    <AnimatePresence>
      {isOpen && quote && (
        <div className="modal-overlay">
          <motion.div
            className="modal-box"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ borderRadius: 0, textAlign: 'center' }}
          >
            <div style={{
              width: 52, height: 52, margin: '0 auto 16px', background: 'var(--primary-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus size={26} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>Add a Co-Applicant</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Each co-applicant is charged separately. This payment lets you add one co-applicant to this application, and a GST tax invoice is emailed to you.
            </p>

            <div style={{ background: 'var(--bg-elevated)', padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>Amount Due</div>
              <MsmeFeeBreakdown config={quote} feeLabel="Co-applicant fee" valueColor="var(--text-primary)" mutedColor="var(--text-tertiary)" />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>One co-applicant · Inclusive of 18% GST</div>
            </div>

            <div style={{ marginBottom: 24, marginTop: -8 }}>
              {invoiceDetails?.required && (
                <InvoiceDetailsFields
                  name={invoiceDetails.name}
                  email={invoiceDetails.email}
                  onNameChange={invoiceDetails.setName}
                  onEmailChange={invoiceDetails.setEmail}
                  disabled={paying}
                  labelColor="var(--text-tertiary)"
                />
              )}
              <GstNumberField value={gstin} onChange={setGstin} disabled={paying} labelColor="var(--text-tertiary)" />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
                onClick={close}
                disabled={paying}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
                onClick={pay}
                disabled={paying || !!detailsError || !!gstinError(gstin)}
              >
                {paying ? 'Processing...' : `Pay ${inr(quote.total_amount_inr)}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CoApplicantPaymentModal;
