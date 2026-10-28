import React from 'react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Eligibility-fee price as the customer will actually be charged: fee, any
 * promo discount, 18% GST (charged on the discounted fee), and the total.
 * `config` is the /direct-customer/payment/config response.
 */
export const feeTotal = (config) => {
  if (!config) return null;
  return config.promo_valid && config.discounted_total_amount_inr != null
    ? config.discounted_total_amount_inr
    : config.total_amount_inr;
};

const MsmeFeeBreakdown = ({ config, valueColor = 'var(--on-surface)', mutedColor = 'var(--on-muted)' }) => {
  if (!config) return null;
  const promo = config.promo_valid && config.discounted_amount_inr != null;
  const fee = promo ? config.discounted_amount_inr : config.amount_inr;
  const gst = promo ? config.discounted_gst_amount_inr : config.gst_amount_inr;
  const total = feeTotal(config);
  const row = { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: mutedColor, marginTop: 6 };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={row}>
        <span>Assessment fee</span>
        <span style={{ color: valueColor, fontWeight: 600 }}>
          {promo && <span style={{ textDecoration: 'line-through', marginRight: 8, color: mutedColor, fontWeight: 400 }}>{inr(config.amount_inr)}</span>}
          {inr(fee)}
        </span>
      </div>
      {promo && (
        <div style={{ ...row, color: 'var(--success)' }}>
          <span>Promo discount</span><span>−{inr(config.discount_amount_inr)}</span>
        </div>
      )}
      <div style={row}>
        <span>GST ({Math.round((config.gst_rate || 0.18) * 100)}%)</span>
        <span style={{ color: valueColor, fontWeight: 600 }}>{inr(gst)}</span>
      </div>
      <div style={{ ...row, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', color: valueColor, fontSize: 15, fontWeight: 800 }}>
        <span>Total payable</span><span>{inr(total)}</span>
      </div>
    </div>
  );
};

export default MsmeFeeBreakdown;
