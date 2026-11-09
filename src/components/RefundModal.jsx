import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, RotateCcw, AlertTriangle, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import LoadingSpinner from './ui/LoadingSpinner';
import { adminTransactionsService } from '../api/adminTransactionsService';
import { formatDateTime } from '../utils/helpers';

/**
 * Refund one Razorpay payment (wallet top-up, MSME fee or plan charge), in full or in part.
 * Every number shown comes from the backend's read-only preview, so what is displayed is exactly
 * what will happen. For a wallet top-up a partial refund takes back credits so the customer keeps
 * only what the remaining amount earns at standard price (no coupon discount or cashback).
 */

const inr = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const credits = (n) => Number(n || 0).toLocaleString('en-IN');
const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const REFUND_STATUS = {
  PENDING: { label: 'Sending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  SUBMITTED: { label: 'With Razorpay', color: 'var(--info)', bg: 'var(--info-bg)' },
  PROCESSED: { label: 'Refunded', color: 'var(--success)', bg: 'var(--success-bg)' },
  FAILED: { label: 'Failed', color: 'var(--error)', bg: 'var(--error-bg)' },
  NEEDS_REVIEW: { label: 'Needs review', color: 'var(--error)', bg: 'var(--error-bg)' },
};
const Pill = ({ status }) => {
  const s = REFUND_STATUS[status] || { label: status, color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em' }}>{s.label}</span>;
};

const label = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-muted)', marginBottom: 4 };
const field = { border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, padding: '8px 10px', outline: 'none', width: '100%', boxSizing: 'border-box' };
const Row = ({ k, v, sub, strong }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--outline)' }}>
    <div style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 600 }}>{k}{sub && <div style={{ fontSize: 10, marginTop: 2, fontWeight: 500 }}>{sub}</div>}</div>
    <div style={{ fontSize: strong ? 14 : 12, fontWeight: strong ? 800 : 700, color: 'var(--on-surface)', textAlign: 'right', whiteSpace: 'nowrap' }}>{v}</div>
  </div>
);

const RefundModal = ({ row, onClose, onDone }) => {
  const source = row.source;
  const id = Number(String(row.id).replace(/^[A-Z]+-/, ''));

  const [facts, setFacts] = useState(null);          // preview without a plan: paid / refunded / history
  const [factsError, setFactsError] = useState(null);
  const [mode, setMode] = useState('PARTIAL');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [speed, setSpeed] = useState('normal');
  // Razorpay pays a refund from its available balance. When that is short the admin must knowingly try
  // anyway (e.g. they keep a reserve balance Razorpay's API does not report); a refusal is reversed safely.
  const [allowLowBalance, setAllowLowBalance] = useState(false);
  const [preview, setPreview] = useState(null);      // preview with a plan for the current input
  const [previewLoading, setPreviewLoading] = useState(false);
  const [stage, setStage] = useState('form');        // form | confirm | done
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // One idempotency key per distinct request: a double click or a retry after a dropped connection
  // returns the same refund; changing the amount or mode starts a new request with a new key.
  const keyRef = useRef(newKey());
  useEffect(() => { keyRef.current = newKey(); setAllowLowBalance(false); }, [mode, amount]);

  const loadFacts = useCallback(async () => {
    try {
      const data = await adminTransactionsService.refundPreview({ source, id });
      setFacts(data); setFactsError(null);
    } catch (err) {
      setFactsError(err.response?.data?.error || 'Could not load this payment');
    }
  }, [source, id]);
  useEffect(() => { loadFacts(); }, [loadFacts]);

  // Live preview as the admin types (debounced); stale answers are ignored.
  const seq = useRef(0);
  useEffect(() => {
    if (!facts?.eligible || facts.blocked_reason === 'REFUNDED_OUTSIDE_SYSTEM') return undefined;
    const partialAmount = Number(amount);
    if (mode === 'PARTIAL' && !(partialAmount > 0)) { setPreview(null); return undefined; }
    const mine = ++seq.current;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await adminTransactionsService.refundPreview({ source, id, full: mode === 'FULL', amountInr: mode === 'PARTIAL' ? partialAmount : undefined });
        if (mine === seq.current) setPreview(data);
      } catch (err) {
        if (mine === seq.current) setPreview({ blocked_reason: 'ERROR', blocked_message: err.response?.data?.error || 'Could not work out this refund', plan: null, warnings: [] });
      } finally {
        if (mine === seq.current) setPreviewLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [mode, amount, facts, source, id]);

  const plan = preview?.plan;
  const blocked = preview?.blocked_reason;
  const refundable = facts?.refundable_paise || 0;
  const hasHistory = (facts?.history || []).length > 0;
  const canRefund = facts?.eligible && refundable > 0 && facts?.blocked_reason !== 'REFUNDED_OUTSIDE_SYSTEM';
  const funding = preview?.funding;
  const fundingShort = funding?.state === 'SHORT';
  const valid = canRefund && plan && !blocked && !previewLoading && reason.trim().length >= 5 && (!fundingShort || allowLowBalance);

  const submit = async () => {
    setSubmitting(true); setSubmitError(null);
    try {
      const out = await adminTransactionsService.issueRefund({
        source, id, mode, amountInr: mode === 'PARTIAL' ? Number(amount) : undefined,
        reason: reason.trim(), idempotencyKey: keyRef.current, speed, allowLowBalance: fundingShort && allowLowBalance,
      });
      setResult(out.refund); setStage('done'); onDone?.();
      loadFacts();
    } catch (err) {
      const data = err.response?.data;
      setSubmitError(data?.error || 'The refund could not be issued. Nothing was changed.');
      setStage('form');
      if (data?.code === 'INSUFFICIENT_CREDITS' || data?.code === 'EXCEEDS_REFUNDABLE') loadFacts();
    } finally {
      setSubmitting(false);
    }
  };

  const recheck = async (refundId) => {
    setBusyId(refundId);
    try { await adminTransactionsService.recheckRefund(refundId); await loadFacts(); onDone?.(); toast.success('Checked with Razorpay'); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not check with Razorpay'); }
    finally { setBusyId(null); }
  };
  const downloadNote = async (refundId) => {
    setBusyId(refundId);
    try { await adminTransactionsService.downloadCreditNote(refundId); }
    catch { toast.error('Could not download the credit note'); }
    finally { setBusyId(null); }
  };

  const useMax = () => { setMode('PARTIAL'); setAmount((Math.floor(preview.max_refundable_paise) / 100).toFixed(2)); };

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={18} color="var(--warning)" /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Refund payment</h2>
              <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{row.type_label} · {row.tenant?.name || row.user?.name || '—'}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={submitting} aria-label="Close"><X size={18} /></button>
        </div>

        {!facts && !factsError && <div style={{ padding: 40 }}><LoadingSpinner /></div>}
        {factsError && <div style={{ padding: 12, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontWeight: 700 }}>{factsError}</div>}

        {facts && (
          <>
            <div style={{ border: '1px solid var(--outline)', padding: '4px 12px', marginBottom: 14 }}>
              <Row k="Paid by customer (incl. GST)" v={inr(facts.paid_paise)} sub={row.razorpay_payment_id} />
              {facts.refunded_paise > 0 && <Row k="Already refunded" v={inr(facts.refunded_paise)} />}
              <Row k="Left to refund" v={inr(refundable)} strong />
              {facts.has_credits && <Row k="Credits this top-up gave" v={credits(facts.credits_granted)} sub={facts.credits_debited_so_far ? `${credits(facts.credits_debited_so_far)} already taken back` : null} />}
            </div>

            {!facts.eligible && <div style={{ padding: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>{facts.ineligible_reason}</div>}
            {facts.blocked_reason === 'REFUNDED_OUTSIDE_SYSTEM' && <div style={{ padding: 10, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontWeight: 700, marginBottom: 14 }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {facts.blocked_message}</div>}

            {/* ─── the refund form ─── */}
            {canRefund && stage === 'form' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[['FULL', facts.refunded_paise > 0 ? `Refund the remaining ${inr(refundable)}` : `Full refund ${inr(refundable)}`], ['PARTIAL', 'Partial refund']].map(([m, text]) => (
                    <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', borderRadius: 0, border: `1px solid ${mode === m ? 'var(--primary)' : 'var(--outline)'}`, background: mode === m ? 'var(--primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--on-surface)' }}>{text}</button>
                  ))}
                </div>

                {mode === 'PARTIAL' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={label}>Amount to refund (₹, GST included)</div>
                    <input type="number" min="1" step="0.01" inputMode="decimal" placeholder={`up to ${(refundable / 100).toFixed(2)}`} value={amount} onChange={(e) => setAmount(e.target.value)} style={field} />
                  </div>
                )}

                {/* what will happen */}
                <div style={{ border: '1px solid var(--outline)', background: 'var(--bg-elevated)', padding: '4px 12px', marginBottom: 12, minHeight: 44 }}>
                  {previewLoading && <div style={{ padding: 10, fontSize: 12, color: 'var(--on-muted)' }}>Working it out…</div>}
                  {!previewLoading && !plan && !blocked && <div style={{ padding: 10, fontSize: 12, color: 'var(--on-muted)' }}>Enter an amount to see exactly what will happen.</div>}
                  {!previewLoading && plan && plan.refund_paise != null && (
                    <>
                      <Row k="Refunded to the customer" v={inr(plan.refund_paise)} strong sub="Back to the original payment method, usually 5–7 working days" />
                      <Row k="Of which taxable value" v={inr(plan.taxable_paise)} />
                      <Row k="Of which GST reversed" v={inr(plan.gst_paise)} sub={facts.supply === 'INTRA' ? `CGST ${inr(plan.cgst_paise)} + SGST ${inr(plan.sgst_paise)}` : `IGST ${inr(plan.igst_paise)}`} />
                      {funding && funding.state !== 'UNKNOWN' && (
                        <Row
                          k="Razorpay balance available"
                          v={<span style={{ color: fundingShort ? 'var(--error)' : 'var(--success)' }}>{inr(funding.available_paise)}</span>}
                          sub={fundingShort ? `Short by ${inr(funding.shortfall_paise)} — Razorpay pays refunds from this balance` : 'Covers this refund'}
                        />
                      )}
                      {facts.has_credits && (
                        <>
                          <Row k="Credits taken back from the wallet" v={credits(plan.credits_debit)} strong sub={plan.is_final ? 'Everything this top-up still holds' : `Customer keeps ${credits(plan.credits_retained)} credits (the remaining amount at standard price)`} />
                          <Row k="Wallet balance after" v={`${credits(preview.wallet_balance)} → ${credits(plan.wallet_balance_after)}`} />
                        </>
                      )}
                    </>
                  )}
                  {!previewLoading && fundingShort && (
                    <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--error)', fontWeight: 700, lineHeight: 1.5 }}>
                      <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {funding.message}
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, fontWeight: 600, color: 'var(--on-surface)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={allowLowBalance} onChange={(e) => setAllowLowBalance(e.target.checked)} style={{ marginTop: 2 }} />
                        <span>Try anyway — my Razorpay account has a reserve balance. If Razorpay refuses, nothing is refunded and any credits are put back.</span>
                      </label>
                    </div>
                  )}
                  {!previewLoading && (preview?.warnings || []).map((w) => <div key={w} style={{ padding: '8px 0', fontSize: 11, color: 'var(--warning)', fontWeight: 600, lineHeight: 1.5 }}>{w}</div>)}
                  {!previewLoading && blocked && (
                    <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--error)', fontWeight: 700, lineHeight: 1.5 }}>
                      <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {preview.blocked_message}
                      {blocked === 'INSUFFICIENT_CREDITS' && (
                        <div style={{ marginTop: 6, fontWeight: 600 }}>
                          Credits needed: {credits(plan?.credits_debit)}, wallet has {credits(preview.wallet_balance)}.{' '}
                          {preview.max_refundable_paise > 0
                            ? <>You can refund up to <b>{inr(Math.floor(preview.max_refundable_paise))}</b> right now. <button type="button" onClick={useMax} style={{ border: 0, background: 'none', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Use this amount</button></>
                            : 'No refund is possible until the wallet balance covers the credits.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={label}>Reason (required, kept on the audit record)</div>
                  <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer requested a refund — duplicate recharge" style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={label}>Refund speed</div>
                  <select value={speed} onChange={(e) => setSpeed(e.target.value)} style={field}>
                    <option value="normal">Normal (5–7 working days, no extra fee)</option>
                    <option value="optimum">Optimum (faster where the bank supports it; Razorpay may charge a fee)</option>
                  </select>
                </div>

                {submitError && <div style={{ padding: 10, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{submitError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ borderRadius: 0 }} onClick={onClose}>Cancel</button>
                  <button className="btn btn-primary" style={{ borderRadius: 0 }} disabled={!valid} onClick={() => setStage('confirm')}>Review refund</button>
                </div>
              </>
            )}

            {/* ─── confirm ─── */}
            {canRefund && stage === 'confirm' && plan && (
              <div>
                <div style={{ padding: 12, background: 'var(--error-bg)', color: 'var(--on-surface)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                  <b>Refund {inr(plan.refund_paise)}</b> to this customer via Razorpay
                  {facts.has_credits && plan.credits_debit > 0 && <> and take back <b>{credits(plan.credits_debit)} credits</b> from their wallet</>}.
                  {' '}This cannot be undone.
                </div>
                {submitError && <div style={{ padding: 10, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{submitError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ borderRadius: 0 }} disabled={submitting} onClick={() => setStage('form')}>Back</button>
                  <button className="btn btn-danger" style={{ borderRadius: 0 }} disabled={submitting} onClick={submit}>{submitting ? 'Refunding…' : `Yes, refund ${inr(plan.refund_paise)}`}</button>
                </div>
              </div>
            )}

            {/* ─── result ─── */}
            {stage === 'done' && result && (
              <div>
                <div style={{ padding: 12, marginBottom: 14, fontSize: 13, lineHeight: 1.6, fontWeight: 600,
                  background: result.status === 'FAILED' || result.status === 'NEEDS_REVIEW' ? 'var(--error-bg)' : 'var(--success-bg)',
                  color: result.status === 'FAILED' || result.status === 'NEEDS_REVIEW' ? 'var(--error)' : 'var(--success)' }}>
                  {result.status === 'FAILED' && <><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> The refund did not go through: {result.failure_reason} Nothing was refunded and any credits were put back.</>}
                  {result.status === 'NEEDS_REVIEW' && <><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Razorpay did not answer, so we do not know if the refund went through. Nothing is lost: the credits stay reserved and the system is settling it from Razorpay's records. Use “Check with Razorpay” below.</>}
                  {(result.status === 'SUBMITTED' || result.status === 'PENDING') && <><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Refund of {inr(result.amount_inr * 100)} sent to Razorpay{result.credits_debited ? ` and ${credits(result.credits_debited)} credits taken back` : ''}. The credit note is issued and emailed to the customer once Razorpay processes it.</>}
                  {result.status === 'PROCESSED' && <><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Refund of {inr(result.amount_inr * 100)} processed{result.credit_note_number ? `. Credit note ${result.credit_note_number} issued` : ''}.</>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" style={{ borderRadius: 0 }} onClick={onClose}>Close</button></div>
              </div>
            )}

            {/* ─── previous refunds on this payment ─── */}
            {hasHistory && (
              <div style={{ marginTop: 18 }}>
                <div style={label}>Refunds on this payment</div>
                {facts.history.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--outline)', fontSize: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>{inr(h.amount_paise)} <span style={{ fontWeight: 500, color: 'var(--on-muted)' }}>· {h.kind === 'FULL' ? 'full' : 'partial'}{h.credits_debited ? ` · ${credits(h.credits_debited)} credits taken back` : ''}</span></div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)' }}>{formatDateTime(h.created_at)}{h.credit_note_number ? ` · ${h.credit_note_number}` : ''}</div>
                    </div>
                    <Pill status={h.status} />
                    {['PENDING', 'NEEDS_REVIEW', 'SUBMITTED'].includes(h.status) && (
                      <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={busyId === h.id} onClick={() => recheck(h.id)} title="Check the real state with Razorpay now"><RefreshCw size={11} /> Check</button>
                    )}
                    {h.credit_note_number && (
                      <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={busyId === h.id} onClick={() => downloadNote(h.id)} title="Download credit note"><Download size={11} /> Credit note</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RefundModal;
