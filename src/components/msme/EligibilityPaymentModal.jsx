import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

/**
 * Presentational payment modal for the MSME "start a new case" flow —
 * extracted verbatim from MsmeDashboardPage so it can be reused by any page
 * that triggers useEligibilityPayment() (currently the dashboard and
 * /msme/cases). All state/logic lives in the hook; this just renders it.
 */
const EligibilityPaymentModal = ({ isOpen, paymentConfig, actionLoading, onCancel, onPayNow }) => (
  <AnimatePresence>
    {isOpen && paymentConfig && (
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
            <ShieldCheck size={26} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>Eligibility Assessment</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            To check your eligibility across multiple lenders and receive a detailed report, a one-time assessment fee is required. This data is valid for 90 days.
          </p>

          <div style={{ background: 'var(--bg-elevated)', padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>Amount Due</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>₹{paymentConfig.amount_inr}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>One-time payment · Valid for 90 days</div>
          </div>

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
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default EligibilityPaymentModal;
