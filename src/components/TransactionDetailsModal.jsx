import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { X, RotateCcw, Download, AlertTriangle } from 'lucide-react';
import LoadingSpinner from './ui/LoadingSpinner';
import CopyButton from './ui/CopyButton';
import { adminTransactionsService } from '../api/adminTransactionsService';
import { formatDateTime } from '../utils/helpers';

/**
 * Complete details of one transaction (the admin Transactions page's "tap a row" view): the payment,
 * the amount and GST breakdown, who paid, the invoice, promo, the full timeline, Razorpay webhooks, the
 * wallet entries it produced and every refund on it. All of it comes from one backend call; raw
 * gateway payloads, signatures and tokens are never sent.
 */

const money = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const count = (n) => Number(n || 0).toLocaleString('en-IN');

const STATUS_STYLE = {
  SUCCESS: { color: 'var(--success)', bg: 'var(--success-bg)' },
  PENDING: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)' },
  REVIEW: { color: 'var(--info)', bg: 'var(--info-bg)' },
  CANCELLED: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};
const REFUND_STATUS = {
  PENDING: { label: 'Sending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  SUBMITTED: { label: 'With Razorpay', color: 'var(--info)', bg: 'var(--info-bg)' },
  PROCESSED: { label: 'Refunded', color: 'var(--success)', bg: 'var(--success-bg)' },
  FAILED: { label: 'Failed', color: 'var(--error)', bg: 'var(--error-bg)' },
  NEEDS_REVIEW: { label: 'Needs review', color: 'var(--error)', bg: 'var(--error-bg)' },
};
const TONE = { success: 'var(--success)', error: 'var(--error)', neutral: 'var(--on-muted)' };

const Pill = ({ style, children }) => <span style={{ background: style.bg, color: style.color, padding: '2px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em' }}>{children}</span>;
const Section = ({ title, children }) => (
  <div style={{ marginTop: 16 }}>
    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-muted)', marginBottom: 4 }}>{title}</div>
    <div style={{ border: '1px solid var(--outline)', padding: '2px 12px' }}>{children}</div>
  </div>
);
// One label/value line. Rows with no value are skipped so a section only shows what exists.
const Line = ({ k, v, copy, mono, strong }) => {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--outline)', fontSize: 12 }}>
      <div style={{ color: 'var(--on-muted)', fontWeight: 600, flexShrink: 0 }}>{k}</div>
      <div style={{ color: 'var(--on-surface)', fontWeight: strong ? 800 : 600, textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit', overflowWrap: 'anywhere' }}>
        {v}{copy && <CopyButton text={copy === true ? v : copy} label="Copied" style={{ marginLeft: 6 }} />}
      </div>
    </div>
  );
};
const when = (d) => (d ? formatDateTime(d) : null);

const TransactionDetailsModal = ({ row, onClose, onRefund }) => {
  const source = row.source;
  const id = Number(String(row.id).replace(/^[A-Z]+-/, ''));
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { setD(await adminTransactionsService.details({ source, id })); setError(null); }
    catch (err) { setError(err.response?.data?.error || 'Could not load this transaction'); }
  }, [source, id]);
  useEffect(() => { load(); }, [load]);

  const downloadNote = async (refundId) => {
    setBusyId(refundId);
    try { await adminTransactionsService.downloadCreditNote(refundId); } catch { toast.error('Could not download the credit note'); } finally { setBusyId(null); }
  };

  const st = STATUS_STYLE[d?.status || row.status] || STATUS_STYLE.CANCELLED;
  const canRefund = !!row.refund && (row.refund.refundable || row.refund.count > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{row.type_label}</h2>
            <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace' }}>{d?.ref || row.id}</span>
              <Pill style={st}>{d?.status || row.status}</Pill>
              {d?.raw_status && d.raw_status !== d.status && <span>({d.raw_status})</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canRefund && (
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => onRefund(row)}>
                <RotateCcw size={12} /> {row.refund.refundable ? 'Refund' : 'Refund details'}
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        {!d && !error && <div style={{ padding: 40 }}><LoadingSpinner /></div>}
        {error && <div style={{ padding: 12, marginTop: 14, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontWeight: 700 }}>{error}</div>}

        {d && (
          <>
            <Section title="Amount">
              <Line k="Total charged (incl. GST)" v={money(d.amounts.total)} strong />
              {d.amounts.gst_recorded ? (
                <>
                  <Line k="Taxable value" v={money(d.amounts.taxable)} />
                  <Line k={`GST${d.amounts.gst_rate ? ` (${Math.round(d.amounts.gst_rate * 100)}%)` : ''}`} v={money(d.amounts.gst)} />
                </>
              ) : <Line k="GST" v="Not recorded on this payment" />}
              {d.amounts.face_value != null && <Line k="Credits value before any coupon" v={money(d.amounts.face_value)} />}
              {d.amounts.discount > 0 && <Line k="Coupon discount" v={`− ${money(d.amounts.discount)}`} />}
              {d.amounts.credits != null && <Line k="Credits given" v={count(d.amounts.credits)} />}
              {d.amounts.promo_bonus_credits > 0 && <Line k="Of which cashback bonus" v={count(d.amounts.promo_bonus_credits)} />}
              {d.amounts.base_price != null && <Line k="Plan price (base)" v={money(d.amounts.base_price)} />}
            </Section>

            {d.tax && (
              <Section title="GST on the invoice">
                {d.tax.split_recorded ? (
                  <>
                    <Line k="Place of supply" v={`${d.tax.place_of_supply || '—'} (${d.tax.place_of_supply_code})`} />
                    {d.tax.cgst > 0 || d.tax.sgst > 0
                      ? (<><Line k="CGST (9%)" v={money(d.tax.cgst)} /><Line k="SGST (9%)" v={money(d.tax.sgst)} /></>)
                      : <Line k="IGST (18%)" v={money(d.tax.igst)} />}
                    <Line k="How the state was decided" v={{ GSTIN: 'From the buyer\'s GSTIN', STATE: 'From the registered state', PINCODE: 'From the pincode', SUPPLIER_DEFAULT: 'Not on file — defaulted to Karnataka' }[d.tax.place_of_supply_basis] || d.tax.place_of_supply_basis} />
                    <Line k="Heads corrected on" v={when(d.tax.corrected_at)} />
                  </>
                ) : <Line k="Heads" v="Issued before CGST / SGST / IGST were shown (one undivided GST line)" />}
              </Section>
            )}

            <Section title="Payment">
              <Line k="Razorpay order" v={d.payment.order_id} copy mono />
              <Line k="Razorpay payment" v={d.payment.payment_id} copy mono />
              <Line k="Razorpay subscription" v={d.payment.subscription_id} copy mono />
              <Line k="Currency" v={d.payment.currency} />
              <Line k="What for" v={d.payment.description || d.payment.purpose} />
              <Line k="Case" v={d.payment.case_id ? `#${d.payment.case_id}` : null} />
              <Line k="Period" v={d.payment.period_start && d.payment.period_end ? `${when(d.payment.period_start)} → ${when(d.payment.period_end)}` : null} />
              {d.payment.failure_code && <Line k="Failure code" v={d.payment.failure_code} mono />}
              {d.payment.failure_reason && <Line k="Failure reason" v={<span style={{ color: 'var(--error)' }}>{d.payment.failure_reason}</span>} />}
            </Section>

            <Section title="Customer">
              {d.parties.tenant && <Line k="Tenant" v={<Link to={`/tenants/${d.parties.tenant.id}`} onClick={onClose} style={{ color: 'var(--primary)', fontWeight: 700 }}>{d.parties.tenant.name}</Link>} />}
              <Line k="State" v={d.parties.tenant?.state} />
              <Line k="Tenant GSTIN" v={d.parties.tenant?.gst_number} mono />
              {d.parties.user && (<><Line k="Paid by" v={d.parties.user.name} /><Line k="Email" v={d.parties.user.email} copy /><Line k="Mobile" v={d.parties.user.mobile} /></>)}
              <Line k="Buyer GSTIN" v={d.parties.buyer_gstin} mono />
            </Section>

            {d.invoice && (d.invoice.number || d.invoice.buyer) && (
              <Section title="Tax invoice">
                <Line k="Invoice number" v={d.invoice.number} copy mono />
                <Line k="Issued" v={when(d.invoice.generated_at)} />
                <Line k="Emailed to customer" v={d.invoice.emailed_at ? when(d.invoice.emailed_at) : (d.invoice.number ? 'Not yet' : null)} />
                <Line k="Billed to" v={d.invoice.buyer?.name} />
                <Line k="Billing address" v={[d.invoice.buyer?.city, d.invoice.buyer?.state, d.invoice.buyer?.pincode].filter(Boolean).join(', ') || null} />
              </Section>
            )}

            {d.promo && (
              <Section title="Promo code">
                <Line k="Code" v={d.promo.code} mono strong />
                <Line k="Type" v={`${d.promo.benefit_type}${d.promo.discount_type ? ` · ${d.promo.discount_type}` : ''}${d.promo.discount_value != null ? ` ${d.promo.discount_value}` : ''}`} />
                <Line k="Discount given" v={d.promo.discount_inr ? money(d.promo.discount_inr) : null} />
                <Line k="Bonus credits" v={d.promo.bonus_credits ? count(d.promo.bonus_credits) : null} />
                <Line k="Description" v={d.promo.description} />
              </Section>
            )}

            {d.subscription && (
              <Section title="Subscription">
                <Line k="Plan" v={d.subscription.plan} strong />
                <Line k="Status" v={d.subscription.status} />
                <Line k="Paid by" v={String(d.subscription.payment_method || '').replace(/_/g, ' ')} />
                <Line k="Current period" v={d.subscription.period_start && d.subscription.period_end ? `${when(d.subscription.period_start)} → ${when(d.subscription.period_end)}` : null} />
                <Line k="Grace period ends" v={when(d.subscription.grace_period_ends_at)} />
                <Line k="Halted" v={when(d.subscription.halted_at)} />
                <Line k="Cancellation pending" v={d.subscription.pending_cancellation ? 'Yes' : null} />
                <Line k="Cancelled" v={when(d.subscription.cancelled_at)} />
                {(d.subscription.recent_charges || []).map((c) => <Line key={c.id} k={`${c.invoice_number} · ${when(c.charged_at)}`} v={money(c.total_inr)} />)}
              </Section>
            )}

            {d.refunds.length > 0 && (
              <Section title={`Refunds (${d.refunds.length})`}>
                {d.refunds.map((r) => (
                  <div key={r.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--outline)', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b>{money(r.amount_inr)}</b>
                      <Pill style={REFUND_STATUS[r.status] || STATUS_STYLE.CANCELLED}>{(REFUND_STATUS[r.status] || {}).label || r.status}</Pill>
                      <span style={{ color: 'var(--on-muted)' }}>{r.kind === 'FULL' ? 'full' : 'partial'}{r.credits_debited ? ` · ${count(r.credits_debited)} credits taken back` : ''}</span>
                      {r.credit_note_number && (
                        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, marginLeft: 'auto' }} disabled={busyId === r.id} onClick={() => downloadNote(r.id)}>
                          <Download size={11} /> {r.credit_note_number}
                        </button>
                      )}
                    </div>
                    <div style={{ color: 'var(--on-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {when(r.created_at)} by {r.requested_by || 'an admin'} · “{r.reason}”
                      {r.razorpay_refund_id && <> · <span style={{ fontFamily: 'monospace' }}>{r.razorpay_refund_id}</span></>}
                      {r.failure_reason && <div style={{ color: 'var(--error)' }}><AlertTriangle size={11} style={{ verticalAlign: -1 }} /> {r.failure_reason}</div>}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            <Section title="Timeline">
              {d.timeline.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--outline)', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[t.tone] || TONE.neutral, marginTop: 4, flexShrink: 0 }} />
                  <span style={{ color: 'var(--on-muted)', width: 150, flexShrink: 0 }}>{formatDateTime(t.at)}</span>
                  <span style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{t.label}</span>
                </div>
              ))}
            </Section>

            {d.wallet_entries.length > 0 && (
              <Section title="Wallet entries from this payment">
                {d.wallet_entries.map((e) => (
                  <Line key={e.id} k={`${e.transaction_type === 'CREDIT' ? '+' : '−'}${count(e.amount)} · ${e.remarks || String(e.reference_type).replace(/_/g, ' ')}`} v={`balance ${count(e.balance_after)} · ${when(e.created_at)}`} />
                ))}
              </Section>
            )}

            {d.webhook_events.length > 0 && (
              <Section title="Razorpay webhook events">
                {d.webhook_events.map((e) => <Line key={e.id} k={e.event_type} v={`${when(e.received_at)}${e.processed ? '' : ' · not processed'}`} mono />)}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionDetailsModal;
