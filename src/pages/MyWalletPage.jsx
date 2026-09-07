import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Search, SlidersHorizontal,
  FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown, Plus, X,
  Download, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { getErrorMessage } from '../utils/helpers';
import { walletService } from '../api/walletService';
import { loadRazorpay } from '../utils/razorpay';
import { useAuth } from '../context/AuthContext';
import PageTour from '../components/tour/PageTour';

const WALLET_TOUR_STEPS = [
  { target: '[data-tour="wallet-stats"]', title: 'Your credit balance', description: 'Your current wallet balance, plus how many credits were added and used in the selected date range.' },
  { target: '[data-tour="wallet-recharge"]', title: 'Recharge your wallet', description: 'Top up your credits here any time. Pay by card, UPI, or netbanking, or redeem a promo code, and a GST invoice is generated automatically.' },
  { target: '[data-tour="wallet-tabs"]', title: 'Browse your wallet', description: 'Switch between your Transaction History, your Recharge History with downloadable invoices, and (if you manage a team) Employee Credits.' },
  { target: '[data-tour="wallet-filters"]', title: 'Search & filter', description: 'Search your transactions, filter by credit/debit and date range, or export the whole log to Excel.' },
];

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const PAGE_SIZE = 25;
const GST_RATE = 0.18;

const TYPE_OPTIONS = [
  { value: 'CREDIT', label: 'Credits (added)' },
  { value: 'DEBIT', label: 'Debits (used)' },
];

const compactField = {
  border: '1px solid var(--outline)',
  borderRadius: 0,
  background: 'var(--surface)',
  color: 'var(--on-surface)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  outline: 'none',
};

const toDateInput = (d) => d.toISOString().slice(0, 10);

// "Weekly" -> last 7 days, "Yearly" -> 1 Jan of this year through today —
// both computed client-side into a plain date_from/date_to pair, same
// contract the custom range picker below already sends.
const PRESETS = [
  {
    key: 'week',
    label: 'Last 7 Days',
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return [toDateInput(from), toDateInput(to)];
    },
  },
  {
    key: 'year',
    label: 'This Year',
    range: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), 0, 1);
      return [toDateInput(from), toDateInput(to)];
    },
  },
];

// Clean, underscore-free labels for the "Type" badge — reference_type comes
// straight off the wallet_transactions enum (API_CALL, RAZORPAY_TOPUP, ...),
// which reads as raw code in a customer-facing log otherwise.
const REFERENCE_TYPE_LABEL = {
  API_CALL: 'Debit',
  RAZORPAY_TOPUP: 'Credits Recharge',
  ADMIN_TOPUP: 'Admin Topup',
  REFUND: 'Refund',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
  EMPLOYEE_ALLOCATION: 'Employee Allocation',
  EMPLOYEE_REVOCATION: 'Employee Revocation',
};
const referenceTypeLabel = (type) => REFERENCE_TYPE_LABEL[type] || type;

// Falls back for an api_code the backend couldn't resolve a customer/case for
// (older rows, or a call that never carried one) — still underscore-free.
const API_CODE_FALLBACK_LABEL = {
  GST_FETCH: 'GST Fetch',
  BUREAU_OBLIGATIONS: 'Bureau Obligations',
  ITR_ANALYTICS: 'ITR Analytics',
};

// The Reference column for an API-call debit: GST_FETCH / BUREAU_OBLIGATIONS /
// ITR_ANALYTICS etc. are internal api_codes, meaningless to a DSA reading
// their own usage log on their own — shown as "<Service> — <Customer> ·
// Case <id>" so it's clear BOTH which service ran AND who it ran for. The
// customer/case half comes from the backend (customer_name/case_id),
// attached by joining the api_usage_log the deduction was logged against;
// it's appended to, never a replacement for, the service name below.
const transactionReferenceLabel = (t) => {
  if (t.remarks) return t.remarks;
  if (t.api_code) {
    const service = API_CODE_FALLBACK_LABEL[t.api_code] || t.api_code.replace(/_/g, ' ');
    const who = t.customer_name ? `${t.customer_name}${t.case_id ? ` · Case ${t.case_id}` : ''}` : null;
    return who ? `${service} — ${who}` : service;
  }
  return '—';
};

const formatCredits = (n) => `${Number(n || 0).toLocaleString('en-IN')}`;
const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TOPUP_STATUS_STYLE = {
  CREDITED: { color: 'var(--success)', bg: 'var(--success-bg)', icon: CheckCircle2, label: 'Credited' },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)', icon: XCircle, label: 'Failed' },
  CANCELLED: { color: 'var(--error)', bg: 'var(--error-bg)', icon: XCircle, label: 'Cancelled' },
};
const topupStatusStyle = (status) => TOPUP_STATUS_STYLE[status] || { color: 'var(--warning)', bg: 'var(--warning-bg)', icon: Clock, label: status === 'INITIATED' || status === 'CREATED' ? 'Pending' : (status === 'VERIFIED' ? 'Processing' : status) };

// ─── Recharge modal ─────────────────────────────────────────────────────────
const RechargeModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [preview, setPreview] = useState(null); // { credits_to_add, bonus_credits, gst_amount_inr, total_amount_inr, discount_amount_inr, discounted_amount_inr, promo_bonus_credits, promo_benefit_type, ... }
  const [previewLoading, setPreviewLoading] = useState(false);
  // FREEBIE codes replace the whole amount-entry flow below with a fixed,
  // server-defined credit grant — freebieAmount is never derived from
  // anything the DSA typed, only from getPromoInfo's server response, so
  // there's nothing client-side to tamper with (see redeemFreebie).
  const [freebieAmount, setFreebieAmount] = useState(null);
  const [redeemingFreebie, setRedeemingFreebie] = useState(false);

  const base = Number(amount) || 0;
  const isFreebieMode = promoApplied && freebieAmount != null;
  // Fallback figures (no bonus/promo) shown instantly while the live
  // preview call is in flight, or if it hasn't fired yet — same GST math
  // the backend uses, so there's never a flash of a wrong number.
  const gst = Math.round(base * GST_RATE * 100) / 100;
  const total = base + gst;

  // Re-fetches the preview (volume-discount bonus + promo discount/cashback,
  // both computed server-side) whenever the amount changes, and whenever a
  // successfully-applied DISCOUNT/CASHBACK promo code is present — debounced
  // so typing a 4-digit amount doesn't fire a request per keystroke. Never
  // runs in freebie mode — there's no amount for a FREEBIE code to preview
  // against.
  useEffect(() => {
    if (isFreebieMode) return;
    if (!base || base <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await walletService.getTopupPreview(base, promoApplied ? promoCode.trim() : null);
        if (cancelled) return;
        setPreview(data);
        if (promoApplied && data.promo_valid === false) {
          setPromoError(data.promo_error || 'This promo code is not valid');
          setPromoApplied(false);
        }
      } catch (err) {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [base, promoApplied, isFreebieMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Applying is amount-independent — a FREEBIE code needs no amount typed
  // at all, so this checks the code's benefit_type FIRST (getPromoInfo,
  // no reservation, no amount) before deciding whether to enter freebie
  // mode or fall back to the normal amount-aware preview flow.
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoChecking(true);
    setPromoError('');
    try {
      const info = await walletService.getPromoInfo(promoCode.trim());
      if (info.valid === false) {
        setPromoError(info.error || 'This promo code is not valid');
        return;
      }
      if (info.benefit_type === 'FREEBIE') {
        setFreebieAmount(info.free_credits_amount);
        setPromoApplied(true);
        setPreview(null);
        return;
      }
      // DISCOUNT / CASHBACK — same as before: needs a real amount to show
      // a meaningful preview against.
      setFreebieAmount(null);
      if (!base) {
        // Still mark it applied so the amount-effect above picks it up the
        // moment an amount is typed — nothing to preview yet either way.
        setPromoApplied(true);
        return;
      }
      const data = await walletService.getTopupPreview(base, promoCode.trim());
      if (data.promo_valid === false) {
        setPromoError(data.promo_error || 'This promo code is not valid');
        setPromoApplied(false);
        setPreview(data);
      } else {
        setPromoApplied(true);
        setPreview(data);
      }
    } catch (err) {
      setPromoError(getErrorMessage(err) || 'Failed to check promo code');
    } finally {
      setPromoChecking(false);
    }
  };

  const clearPromo = () => {
    setPromoApplied(false);
    setPromoCode('');
    setPromoError('');
    setFreebieAmount(null);
    setPreview(null);
  };

  // FREEBIE: no amount, no Razorpay — the server resolves the exact credit
  // amount from the code itself (never from anything typed here) and
  // credits the wallet directly in one call.
  const handleRedeemFreebie = async () => {
    setRedeemingFreebie(true);
    try {
      const result = await walletService.redeemFreebiePromo(promoCode.trim());
      toast.success(result.message || `${result.credits_added.toLocaleString('en-IN')} free credits added to your wallet!`);
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to redeem promo code');
    } finally {
      setRedeemingFreebie(false);
    }
  };

  // credits_to_add already folds in any volume-discount bonus tier; the
  // amount actually charged is preview.total_amount_inr (net of any promo
  // discount) once the preview has loaded, falling back to the plain
  // no-bonus/no-promo GST math above until it does.
  const creditsToReceive = preview?.credits_to_add ?? base;
  const volumeBonusCredits = preview?.volume_bonus_credits ?? preview?.bonus_credits ?? 0;
  const cashbackBonusCredits = preview?.promo_bonus_credits || 0;
  const amountPayable = preview?.total_amount_inr ?? total;

  const handleRecharge = async () => {
    if (!base || base <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const order = await walletService.createTopupOrder(base, promoApplied ? promoCode.trim() : null);
      const Razorpay = await loadRazorpay();

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Cred2Tech',
        description: `Wallet Recharge — ${order.credits_to_add.toLocaleString('en-IN')} credits`,
        order_id: order.order_id,
        handler: async (response) => {
          const verifyData = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            topup_id: order.topup_id,
          };
          let lastErr;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const result = await walletService.verifyTopupCheckout(verifyData);
              if (result.status === 'CREDITED' || result.status === 'ALREADY_CREDITED' || result.status === 'ALREADY_CREDITED_IN_LEDGER') {
                // order.credits_to_add is the real, backend-computed figure
                // (base + volume-discount bonus) — never the raw entered
                // amount, so this can't under-report a bonus that was
                // actually credited.
                toast.success(`Wallet recharged with ${order.credits_to_add.toLocaleString('en-IN')} credits!`);
                setSubmitting(false);
                onSuccess();
                return;
              }
              toast(result.message || 'Payment received — credits will reflect shortly.', { icon: '⏳' });
              setSubmitting(false);
              onSuccess();
              return;
            } catch (err) {
              lastErr = err;
              if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
            }
          }
          toast.error(
            `${getErrorMessage(lastErr)} If the amount was deducted, refresh in a moment — if it still doesn't reflect, contact support with payment ID ${response.razorpay_payment_id}.`,
            { duration: 8000 }
          );
          setSubmitting(false);
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: '#4F46E5' },
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment Failed: ${response.error.description}`);
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to initiate recharge');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420, borderRadius: 0, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Recharge Wallet</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--on-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', marginBottom: 6, display: 'block' }}>Credits to purchase (₹1 = 1 credit)</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isFreebieMode}
            style={{ ...compactField, width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '10px 12px', opacity: isFreebieMode ? 0.5 : 1 }}
            autoFocus
          />
          {isFreebieMode && (
            <p style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6, marginBottom: 0 }}>
              This code grants a fixed amount of free credits — no purchase amount needed.
            </p>
          )}

          {!isFreebieMode && volumeBonusCredits > 0 && (
            <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 8, marginBottom: 0, fontWeight: 700 }}>
              🎉 Volume bonus applied — you'll receive {volumeBonusCredits.toLocaleString('en-IN')} extra credits free.
            </p>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', marginBottom: 6, display: 'block' }}>Promo code (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); if (promoApplied) { setPromoApplied(false); setFreebieAmount(null); } }}
                placeholder="e.g. WELCOME10"
                disabled={promoChecking || submitting || redeemingFreebie}
                className="form-control"
                style={{ ...compactField, flex: 1, textTransform: 'uppercase' }}
              />
              {promoApplied ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearPromo} disabled={redeemingFreebie} style={{ borderRadius: 0 }}>Remove</button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || promoChecking}
                  style={{ borderRadius: 0, whiteSpace: 'nowrap' }}
                >
                  {promoChecking ? 'Checking…' : 'Apply'}
                </button>
              )}
            </div>
            {promoError && <p style={{ color: 'var(--error)', fontSize: 11, marginTop: 6 }}>{promoError}</p>}
            {promoApplied && !isFreebieMode && preview?.promo_valid && preview.promo_benefit_type === 'CASHBACK' && (
              <p style={{ color: 'var(--success)', fontSize: 11, marginTop: 6 }}>🎉 Cashback applied — {cashbackBonusCredits.toLocaleString('en-IN')} extra credits on top of your recharge!</p>
            )}
            {promoApplied && !isFreebieMode && preview?.promo_valid && preview.promo_benefit_type !== 'CASHBACK' && (
              <p style={{ color: 'var(--success)', fontSize: 11, marginTop: 6 }}>Promo code applied - you save ₹{Number(preview.discount_amount_inr || 0).toLocaleString('en-IN')}!</p>
            )}
          </div>

          {isFreebieMode ? (
            <div style={{ marginTop: 16, background: 'var(--success-bg, var(--bg))', border: '1px solid var(--success)', padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--on-muted)', marginBottom: 4 }}>This code grants you</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{freebieAmount.toLocaleString('en-IN')} credits</div>
              <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 4 }}>completely free — no payment required</div>
            </div>
          ) : base > 0 && (
            <div style={{ marginTop: 16, background: 'var(--bg)', border: '1px solid var(--outline)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--on-muted)', marginBottom: 6 }}>
                <span>Credits value</span><span>{formatINR(base)}</span>
              </div>
              {promoApplied && preview?.discount_amount_inr > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)', marginBottom: 6 }}>
                  <span>Promo discount</span><span>−{formatINR(preview.discount_amount_inr)}</span>
                </div>
              )}
              {promoApplied && cashbackBonusCredits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)', marginBottom: 6 }}>
                  <span>Promo cashback bonus</span><span>+{cashbackBonusCredits.toLocaleString('en-IN')} credits</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--on-muted)', marginBottom: 6 }}>
                <span>GST (18%)</span><span>{formatINR(preview?.gst_amount_inr ?? gst)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: 'var(--on-surface)' }}>
                <span>Amount payable</span><span>{previewLoading ? '…' : formatINR(amountPayable)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--outline)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                <span>Credits you'll receive</span><span>{creditsToReceive.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {!isFreebieMode && (
            <p style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 12, marginBottom: 0 }}>
              A GST tax invoice will be emailed to you and available for download from Recharge History once payment is confirmed.
            </p>
          )}

          {isFreebieMode ? (
            <button
              onClick={handleRedeemFreebie}
              disabled={redeemingFreebie}
              style={{
                width: '100%', marginTop: 16, padding: '12px', background: 'var(--success)', color: '#fff',
                border: 'none', fontSize: 14, fontWeight: 700, cursor: redeemingFreebie ? 'not-allowed' : 'pointer',
                opacity: redeemingFreebie ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {redeemingFreebie ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {redeemingFreebie ? 'Redeeming…' : `Redeem ${freebieAmount.toLocaleString('en-IN')} Free Credits`}
            </button>
          ) : (
            <button
              onClick={handleRecharge}
              disabled={submitting || !base || previewLoading}
              style={{
                width: '100%', marginTop: 16, padding: '12px', background: 'var(--primary)', color: '#fff',
                border: 'none', fontSize: 14, fontWeight: 700, cursor: submitting || !base ? 'not-allowed' : 'pointer',
                opacity: submitting || !base ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {submitting ? 'Processing…' : `Pay ${base > 0 ? formatINR(amountPayable) : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AllocationModal = ({ type, employee, onClose, onSuccess }) => {
  const [credits, setCredits] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wallet = employee?.EmployeeWallet?.[0] || { allocated_balance: 0 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const creditsNum = Number(credits);
    if (!creditsNum || creditsNum <= 0) {
      toast.error('Enter a valid credits amount');
      return;
    }
    setSubmitting(true);
    try {
      if (type === 'ALLOCATE') {
        await walletService.allocateEmployeeCredits(employee.id, creditsNum, note);
      } else {
        await walletService.revokeEmployeeCredits(employee.id, creditsNum, note);
      }
      toast.success(`Credits ${type === 'ALLOCATE' ? 'allocated' : 'revoked'} successfully`);
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420, borderRadius: 0, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
            {type === 'ALLOCATE' ? 'Allocate' : 'Revoke'} Credits: {employee?.name}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--on-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', marginBottom: 6, display: 'block' }}>Credits Amount</label>
            <input
              type="number" min="1" required autoFocus
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              style={{ ...compactField, width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '10px 12px' }}
            />
            {type === 'REVOKE' && (
              <p style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6 }}>
                Maximum allowed: {formatCredits(wallet.allocated_balance)}
              </p>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', marginTop: 16, marginBottom: 6, display: 'block' }}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...compactField, width: '100%', boxSizing: 'border-box' }}
            />

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', marginTop: 20, padding: '12px', background: 'var(--primary)', color: '#fff',
                border: 'none', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {submitting ? 'Processing…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MyWalletPage = () => {
  const { isMobile } = useResponsive();
  const { hasRole } = useAuth();
  const canManageEmployeeCredits = hasRole('DSA_ADMIN');
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'recharges' | 'employees'
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  // Recharge History tab state
  const [topups, setTopups] = useState([]);
  const [topupsTotal, setTopupsTotal] = useState(0);
  const [topupsPage, setTopupsPage] = useState(1);
  const [topupsLoading, setTopupsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [allocationModal, setAllocationModal] = useState(null); // { type: 'ALLOCATE'|'REVOKE', employee }

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(() => ({
    search, type, date_from: dateFrom, date_to: dateTo,
  }), [search, type, dateFrom, dateTo]);

  // Any filter change invalidates the current page — jumping back to page 1
  // avoids landing on a now out-of-range page.
  useEffect(() => { setPage(1); }, [filters]);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const result = await walletService.getBalance();
      setBalance(result.balance);
    } catch (err) {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await walletService.getTransactions({ ...filters, page, limit: PAGE_SIZE });
      setRows(result.transactions || []);
      setTotal(result.total || 0);
      setSummary(result.summary || null);
    } catch (err) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const fetchTopups = useCallback(async () => {
    setTopupsLoading(true);
    try {
      const result = await walletService.getTopups({ page: topupsPage, limit: PAGE_SIZE });
      setTopups(result.topups || []);
      setTopupsTotal(result.total || 0);
    } catch (err) {
      toast.error('Failed to load recharge history');
    } finally {
      setTopupsLoading(false);
    }
  }, [topupsPage]);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const result = await walletService.getEmployees();
      setEmployees(result || []);
    } catch (err) {
      toast.error('Failed to load employee wallets');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { if (activeTab === 'recharges') fetchTopups(); }, [activeTab, fetchTopups]);
  useEffect(() => { if (activeTab === 'employees' && canManageEmployeeCredits) fetchEmployees(); }, [activeTab, canManageEmployeeCredits, fetchEmployees]);

  const applyPreset = (preset) => {
    const [from, to] = preset.range();
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset.key);
  };

  const activeFilterCount = [type, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setType('');
    setDateFrom(''); setDateTo(''); setActivePreset(null);
  };

  const handleDateInputChange = (setter) => (e) => {
    setter(e.target.value);
    setActivePreset(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await walletService.exportTransactions(filters);
      toast.success('Excel export downloaded');
    } catch (err) {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  const handleRechargeSuccess = () => {
    setShowRechargeModal(false);
    fetchBalance();
    fetchTransactions();
    if (activeTab === 'recharges') fetchTopups();
  };

  const handleAllocationSuccess = () => {
    setAllocationModal(null);
    fetchEmployees();
  };

  const handleDownloadInvoice = async (topup) => {
    setDownloadingId(topup.id);
    try {
      await walletService.downloadInvoice(topup.id, topup.invoice_number);
    } catch (err) {
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = [
    {
      key: 'created_at', label: 'Date & Time', width: '20%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(t.created_at)}</span>,
    },
    {
      key: 'type', label: 'Type', width: '16%', padding: '16px 12px',
      render: (t) => (
        <span className="badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
          background: t.transaction_type === 'CREDIT' ? 'var(--success-bg)' : 'var(--error-bg)',
        }}>
          {t.transaction_type === 'CREDIT' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
          {referenceTypeLabel(t.reference_type)}
        </span>
      ),
    },
    {
      key: 'amount', label: 'Amount', align: 'right', width: '14%', padding: '16px 12px',
      render: (t) => (
        <span style={{ fontSize: 14, fontWeight: 800, color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
          {t.transaction_type === 'CREDIT' ? '+' : '-'}{formatCredits(t.amount)}
        </span>
      ),
    },
    {
      key: 'reference', label: 'Reference', width: '30%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 12, color: 'var(--on-surface)' }}>{transactionReferenceLabel(t)}</span>,
    },
    {
      key: 'balance_after', label: 'Balance After', align: 'right', width: '20%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{formatCredits(t.balance_after)}</span>,
    },
  ];

  const topupColumns = [
    {
      key: 'created_at', label: 'Date', width: '16%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(t.created_at)}</span>,
    },
    {
      key: 'status', label: 'Status', width: '13%', padding: '16px 12px',
      render: (t) => {
        const s = topupStatusStyle(t.status);
        const Icon = s.icon;
        return (
          <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: s.color, background: s.bg }}>
            <Icon size={12} /> {s.label}
          </span>
        );
      },
    },
    {
      key: 'credits', label: 'Credits', align: 'right', width: '13%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)' }}>+{formatCredits(t.credits_to_add)}</span>,
    },
    {
      key: 'gst', label: 'GST', align: 'right', width: '15%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>{t.gst_amount_inr != null ? formatINR(t.gst_amount_inr) : '—'}</span>,
    },
    {
      key: 'total', label: 'Amount Paid', align: 'right', width: '15%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatINR(t.amount_inr)}</span>,
    },
    {
      key: 'invoice', label: 'Invoice', width: '18%', padding: '16px 12px',
      render: (t) => t.status === 'CREDITED' ? (
        <button
          onClick={() => handleDownloadInvoice(t)}
          disabled={downloadingId === t.id}
          style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: downloadingId === t.id ? 'not-allowed' : 'pointer' }}
        >
          {downloadingId === t.id ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={12} />}
          {t.invoice_number || 'Download'}
        </button>
      ) : <span style={{ fontSize: 11, color: 'var(--on-muted)' }}>—</span>,
    },
  ];

  const employeeColumns = [
    {
      key: 'employee', label: 'Employee', width: '30%', padding: '16px 12px',
      render: (emp) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{emp.name}</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>{emp.email}</div>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role', width: '16%', padding: '16px 12px',
      render: (emp) => <Badge type="role" value={emp.role?.name} />,
    },
    {
      key: 'allocated', label: 'Allocated Balance', align: 'right', width: '18%', padding: '16px 12px',
      render: (emp) => <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{formatCredits(emp.EmployeeWallet?.[0]?.allocated_balance || 0)}</span>,
    },
    {
      key: 'consumed', label: 'Consumed', align: 'right', width: '16%', padding: '16px 12px',
      render: (emp) => <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{formatCredits(emp.EmployeeWallet?.[0]?.consumed_credits || 0)}</span>,
    },
    {
      key: 'actions', label: 'Actions', align: 'right', width: '20%', padding: '16px 12px',
      render: (emp) => {
        const allocatedBalance = emp.EmployeeWallet?.[0]?.allocated_balance || 0;
        return (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => setAllocationModal({ type: 'ALLOCATE', employee: emp })}>Allocate</button>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={allocatedBalance === 0} onClick={() => setAllocationModal({ type: 'REVOKE', employee: emp })}>Revoke</button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader title="My Wallet" subtitle="Your credit balance, recharges, and transaction history" compact={isMobile} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Summary stat cards + Recharge button ─── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 16, marginBottom: 16, alignItems: 'stretch' }}>
          <div data-tour="wallet-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: isMobile ? 8 : 16, flex: 1 }}>
            <StatCard title="Current Balance" value={balanceLoading ? '—' : (balance !== null ? formatCredits(balance) : '—')} icon={Wallet} color="var(--primary)" loading={balanceLoading} />
            <StatCard title="Credited (in range)" value={summary ? `+${formatCredits(summary.total_credit)}` : '—'} icon={TrendingUp} color="var(--success)" loading={!summary} />
            <StatCard title="Used (in range)" value={summary ? `-${formatCredits(summary.total_debit)}` : '—'} icon={TrendingDown} color="var(--error)" loading={!summary} />
          </div>
          <button
            data-tour="wallet-recharge"
            onClick={() => setShowRechargeModal(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 24px', background: 'var(--primary)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: isMobile ? '100%' : 160,
            }}
          >
            <Plus size={16} /> Recharge Wallet
          </button>
        </div>

        {/* ─── Tabs ─── */}
        <div data-tour="wallet-tabs" style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '1px solid var(--outline)' }}>
          {[
            { key: 'transactions', label: 'Transaction History' },
            { key: 'recharges', label: 'Recharge History' },
            ...(canManageEmployeeCredits ? [{ key: 'employees', label: 'Employee Credits' }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${activeTab === tab.key ? 'var(--primary)' : 'transparent'}`,
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--on-muted)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'transactions' ? (
          <>
            <div className="card" style={{ padding: 0, borderRadius: 0, borderTop: 'none' }}>
              {/* ─── Filter toolbar ─── */}
              <div data-tour="wallet-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
                <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140, maxWidth: 260 }}>
                  <Search size={13} color="var(--on-muted)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search remarks, API…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }}
                  />
                </div>

                {isMobile && (
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', background: 'transparent',
                      border: `1px solid ${activeFilterCount > 0 ? 'var(--primary)' : 'var(--outline)'}`,
                      color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--on-surface)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 0,
                    }}
                  >
                    <SlidersHorizontal size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </button>
                )}

                {(!isMobile || showFilters) && (
                  <>
                    <select style={{ ...compactField, maxWidth: 170 }} value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="">All types</option>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <div style={{ display: 'flex', gap: 4 }}>
                      {PRESETS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => applyPreset(p)}
                          style={{
                            ...compactField,
                            cursor: 'pointer',
                            border: `1px solid ${activePreset === p.key ? 'var(--primary)' : 'var(--outline)'}`,
                            color: activePreset === p.key ? 'var(--primary)' : 'var(--on-surface)',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <input type="date" value={dateFrom} onChange={handleDateInputChange(setDateFrom)} style={{ ...compactField, maxWidth: 140 }} title="From date" />
                    <input type="date" value={dateTo} onChange={handleDateInputChange(setDateTo)} style={{ ...compactField, maxWidth: 140 }} title="To date" />

                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                        Clear ({activeFilterCount})
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={handleExport}
                  disabled={exporting}
                  style={{ ...compactField, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: exporting ? 'not-allowed' : 'pointer', border: '1px solid var(--outline)' }}
                >
                  {exporting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={13} />} Export Excel
                </button>
              </div>

              {/* ─── Table / mobile card list ─── */}
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
              ) : rows.length === 0 ? (
                <EmptyState icon={Wallet} title="No transactions found" description="No wallet credit/debit history matches the applied filters." />
              ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
                  {rows.map((t) => (
                    <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <span className="badge" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
                            background: t.transaction_type === 'CREDIT' ? 'var(--success-bg)' : 'var(--error-bg)',
                          }}>
                            {t.transaction_type === 'CREDIT' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                            {referenceTypeLabel(t.reference_type)}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6 }}>{formatDateTime(t.created_at)}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)', flexShrink: 0 }}>
                          {t.transaction_type === 'CREDIT' ? '+' : '-'}{formatCredits(t.amount)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transactionReferenceLabel(t)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', flexShrink: 0 }}>Bal: {formatCredits(t.balance_after)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <DataTable columns={columns} data={rows} rowKey="id" />
              )}
            </div>

            {!loading && total > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
                <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        ) : activeTab === 'recharges' ? (
          <>
            <div className="card" style={{ padding: 0, borderRadius: 0, borderTop: 'none' }}>
              {topupsLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
              ) : topups.length === 0 ? (
                <EmptyState icon={Wallet} title="No recharges yet" description="Your wallet recharge history and GST invoices will appear here." />
              ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
                  {topups.map((t) => {
                    const s = topupStatusStyle(t.status);
                    const Icon = s.icon;
                    return (
                      <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: s.color, background: s.bg }}>
                              <Icon size={12} /> {s.label}
                            </span>
                            <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6 }}>{formatDateTime(t.created_at)}</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', flexShrink: 0 }}>+{formatCredits(t.credits_to_add)}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                          <span style={{ fontSize: 12, color: 'var(--on-surface)' }}>Paid {formatINR(t.amount_inr)}</span>
                          {t.status === 'CREDITED' && (
                            <button onClick={() => handleDownloadInvoice(t)} disabled={downloadingId === t.id} style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                              <Download size={12} /> Invoice
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <DataTable columns={topupColumns} data={topups} rowKey="id" />
              )}
            </div>

            {!topupsLoading && topupsTotal > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={topupsPage === 1} onClick={() => setTopupsPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Page {topupsPage} of {Math.ceil(topupsTotal / PAGE_SIZE)} · {topupsTotal} total</span>
                <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={topupsPage * PAGE_SIZE >= topupsTotal} onClick={() => setTopupsPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        ) : (
          <div className="card" style={{ padding: 0, borderRadius: 0, borderTop: 'none' }}>
            <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--outline)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Employee Wallet Allocation</h3>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '4px 0 0' }}>Allocate or revoke credits for your DSA team members</p>
            </div>
            {employeesLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
            ) : employees.length === 0 ? (
              <EmptyState icon={Wallet} title="No team members found" description="Add DSA team members from Team Management to allocate credits to them." />
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
                {employees.map((emp) => {
                  const wallet = emp.EmployeeWallet?.[0] || { allocated_balance: 0, consumed_credits: 0 };
                  return (
                    <div key={emp.id} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{emp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>{emp.email}</div>
                          <div style={{ marginTop: 6 }}><Badge type="role" value={emp.role?.name} /></div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>{formatCredits(wallet.allocated_balance)}</div>
                          <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>Consumed: {formatCredits(wallet.consumed_credits)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, flex: 1 }} onClick={() => setAllocationModal({ type: 'ALLOCATE', employee: emp })}>Allocate</button>
                        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, flex: 1 }} disabled={wallet.allocated_balance === 0} onClick={() => setAllocationModal({ type: 'REVOKE', employee: emp })}>Revoke</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DataTable columns={employeeColumns} data={employees} rowKey="id" />
            )}
          </div>
        )}
      </div>

      {showRechargeModal && (
        <RechargeModal onClose={() => setShowRechargeModal(false)} onSuccess={handleRechargeSuccess} />
      )}

      {allocationModal && (
        <AllocationModal
          type={allocationModal.type}
          employee={allocationModal.employee}
          onClose={() => setAllocationModal(null)}
          onSuccess={handleAllocationSuccess}
        />
      )}
      <PageTour pageKey="wallet" steps={WALLET_TOUR_STEPS} />
    </div>
  );
};

export default MyWalletPage;
