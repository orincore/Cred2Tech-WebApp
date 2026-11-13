import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import MsmeFeeBreakdown from './MsmeFeeBreakdown';
import GstNumberField, { gstinError } from './GstNumberField';
import InvoiceDetailsFields, { invoiceDetailsError } from './InvoiceDetailsFields';

/**
 * Presentational payment modal for the MSME "start a new case" flow —
 * extracted verbatim from MsmeDashboardPage so it can be reused by any page
 * that triggers useEligibilityPayment() (currently the dashboard and
 * /msme/cases). All state/logic lives in the hook; this just renders it.
 */
const EligibilityPaymentModal = ({
  isOpen, paymentConfig, gstin = '', onGstinChange, actionLoading, onCancel, onPayNow,
  invoiceDetails = null, // { required, name, email, setName, setEmail } from useEligibilityPayment
}) => {
  const detailsRequired = !!invoiceDetails?.required;
  const detailsError = detailsRequired ? invoiceDetailsError(invoiceDetails.name, invoiceDetails.email) : null;
  return (
  <AnimatePresence>
    {isOpen && paymentConfig && (
      <div className="modal-overlay">
        <motion.div
          className="modal-box"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ borderRadius: 0, textAlign: 'center', padding: '20px 22px', maxHeight: '92vh', overflowY: 'auto' }}
        >
          {/* Compact header: icon beside the title instead of stacked above it. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 34, height: 34, flexShrink: 0, background: 'var(--primary-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={18} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Eligibility Assessment</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.45 }}>
            To check your eligibility across multiple lenders and receive a detailed report, a one-time assessment fee is required.
          </p>

          <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: 2 }}>Amount Due</div>
            <MsmeFeeBreakdown config={paymentConfig} valueColor="var(--text-primary)" mutedColor="var(--text-tertiary)" />
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>One-time payment · Inclusive of 18% GST</div>
          </div>

          {(detailsRequired || onGstinChange) && (
            <div style={{ marginBottom: 16, marginTop: -14 }}>
              {detailsRequired && (
                <InvoiceDetailsFields
                  name={invoiceDetails.name}
                  email={invoiceDetails.email}
                  onNameChange={invoiceDetails.setName}
                  onEmailChange={invoiceDetails.setEmail}
                  disabled={actionLoading}
                  labelColor="var(--text-tertiary)"
                />
              )}
              {onGstinChange && <GstNumberField value={gstin} onChange={onGstinChange} disabled={actionLoading} labelColor="var(--text-tertiary)" />}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
              onClick={onCancel}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
              onClick={onPayNow}
              disabled={actionLoading || !!detailsError || !!gstinError(gstin)}
            >
              {actionLoading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
  );
};

export default EligibilityPaymentModal;
