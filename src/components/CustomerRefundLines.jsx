import React from 'react';
import { Download } from 'lucide-react';
import { formatDateTime } from '../utils/helpers';

/**
 * The refunds of one payment, as a CUSTOMER sees them under that payment in their own history
 * (recharges, plan payments, MSME fees). The backend sends only what a customer may see: amount,
 * full/partial, "in progress" or "refunded", credits adjusted and the credit note — never the
 * admin's reason, who issued it, or gateway ids. Renders nothing when there are no refunds.
 *
 * `onDownload(refund)` fetches that refund's credit note; `busyId` disables its button meanwhile.
 */
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CustomerRefundLines = ({ refunds, onDownload, busyId = null, align = 'left' }) => {
  if (!refunds || refunds.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {refunds.map((r) => {
        const done = r.status === 'REFUNDED';
        return (
          <div key={r.id} style={{ textAlign: align, borderLeft: align === 'left' ? `3px solid ${done ? 'var(--success)' : 'var(--warning)'}` : 'none', borderRight: align === 'right' ? `3px solid ${done ? 'var(--success)' : 'var(--warning)'}` : 'none', padding: '1px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: done ? 'var(--success)' : 'var(--warning)' }}>
              {done ? `Refunded ${inr(r.amount_inr)}` : `Refund of ${inr(r.amount_inr)} in progress`}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--on-muted)', marginTop: 2, lineHeight: 1.5 }}>
              {r.kind === 'FULL' ? 'Full refund' : 'Partial refund'}
              {r.credits_adjusted > 0 ? ` · ${Number(r.credits_adjusted).toLocaleString('en-IN')} credits adjusted` : ''}
              {' · '}{formatDateTime(r.processed_at || r.created_at)}
              {!done && ' · reaches your account in 5–7 working days'}
            </div>
            {r.credit_note_number && onDownload && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 0, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                disabled={busyId === r.id}
                onClick={(e) => { e.stopPropagation(); onDownload(r); }}
              >
                <Download size={11} /> {busyId === r.id ? 'Preparing…' : `Credit note ${r.credit_note_number}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CustomerRefundLines;
