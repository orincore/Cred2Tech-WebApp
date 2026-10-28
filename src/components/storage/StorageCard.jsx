import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Check, Lock, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axiosInstance';
import { storageService } from '../../api/storageService';
import { loadRazorpay } from '../../utils/razorpay';
import { getErrorMessage, formatDateTime } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import ConfirmModal from '../ui/ConfirmModal';
import StorageMeter from './StorageMeter';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const LIVE = ['ACTIVE', 'PENDING', 'HALTED'];

const box = { background: 'var(--surface)', border: '1px solid var(--outline)', padding: 20, marginBottom: 16 };
const eyebrow = { fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 };

/**
 * Profile → Storage. Shows how much of the account's storage is used (5 GB free)
 * and lets the account admin buy a paid plan: 10–50 GB at ₹5 per GB per month
 * + 18% GST, auto-debited through a Razorpay mandate. Everyone in the account
 * sees usage; only the DSA_ADMIN (who pays) can change the plan.
 */
const StorageCard = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('DSA_ADMIN');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setData(await storageService.status());
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load storage');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/virtual-workspace/subscription/invoices');
      setInvoices((res.data.invoices || []).filter((i) => /^Storage/i.test(i.description || '')));
    } catch { /* invoices are a convenience — never block the card */ }
  }, [isAdmin]);

  useEffect(() => { refresh(); loadInvoices(); }, [refresh, loadInvoices]);

  if (loading) return <div style={{ padding: 40 }}><LoadingSpinner /></div>;
  if (!data) return null;

  const sub = data.subscription;
  const live = !!sub && LIVE.includes(sub.status);
  const paidUntil = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const cancelledButPaid = sub?.status === 'CANCELLED' && paidUntil && paidUntil > new Date();
  const canSubscribe = !live && !cancelledButPaid;
  const onPaidPlan = data.applies && data.limit_gb > data.free_gb;

  // ── Razorpay Checkout for a subscription (first payment, or an upgrade's prorated top-up) ──
  const openCheckout = async ({ subscriptionId, keyId, description, confirmFn, success }) => {
    const Razorpay = await loadRazorpay();
    const rzp = new Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: 'Cred2Tech Storage',
      description,
      handler: async (response) => {
        try {
          const next = await confirmFn({
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setData(next);
          toast.success(success);
          loadInvoices();
        } catch (err) {
          toast.error(getErrorMessage(err) || 'Could not confirm the payment — it will apply automatically once Razorpay confirms it.');
          refresh();
        } finally { setBusy(false); }
      },
      modal: { ondismiss: () => { setBusy(false); setTimeout(refresh, 3000); } },
      theme: { color: '#4F46E5' },
    });
    rzp.on('payment.failed', (r) => { setBusy(false); toast.error(`Payment failed: ${r.error.description}`); });
    rzp.open();
  };

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { setBusy(false); toast.error(getErrorMessage(err) || 'Something went wrong'); }
  };

  const doSubscribe = (gb) => run(async () => {
    const res = await storageService.subscribe(gb);
    await openCheckout({ subscriptionId: res.razorpay_subscription_id, keyId: res.key_id, description: `${gb} GB storage plan — ${inr(res.total_inr)}/month incl. GST`, confirmFn: storageService.confirm, success: `${gb} GB storage plan is active` });
  });

  const doUpgrade = (gb) => run(async () => {
    const res = await storageService.upgrade(gb);
    await openCheckout({ subscriptionId: res.razorpay_subscription_id, keyId: res.key_id, description: `Upgrade to ${gb} GB — ${inr(res.charge_now_total_inr)} today incl. GST`, confirmFn: storageService.confirmUpgrade, success: `Upgraded to ${gb} GB` });
  });

  const doDowngrade = (gb) => run(async () => {
    setData(await storageService.downgrade(gb));
    toast.success(`Your plan will switch to ${gb} GB at the end of this billing cycle`);
    setBusy(false);
  });

  const doCancel = () => run(async () => {
    setData(await storageService.cancel());
    toast.success('Your storage plan will end at the close of this billing cycle');
    setBusy(false);
  });

  const ask = (cfg) => setConfirm(cfg);
  const closeConfirm = () => setConfirm(null);

  const choose = (plan) => {
    const priceLine = `${inr(plan.base_inr)} + 18% GST (${inr(plan.gst_inr)}) = ${inr(plan.total_inr)} every month`;
    if (canSubscribe) {
      ask({
        title: `Subscribe to ${plan.gb} GB?`, danger: false, confirmLabel: 'Continue to payment',
        message: `${priceLine}, auto-debited from your card or UPI. You are charged now, and again each month until you cancel. Your storage limit becomes ${plan.gb} GB as soon as the payment succeeds.`,
        onConfirm: () => { closeConfirm(); doSubscribe(plan.gb); },
      });
    } else if (live && plan.gb > sub.plan_gb) {
      ask({
        title: `Upgrade to ${plan.gb} GB?`, danger: false, confirmLabel: 'Continue to payment',
        message: `You pay a prorated amount today (shown at checkout, incl. 18% GST) for the rest of this billing cycle. From ${paidUntil ? formatDateTime(paidUntil) : 'your next cycle'} you are billed ${priceLine}. Your limit becomes ${plan.gb} GB as soon as today's payment succeeds.`,
        onConfirm: () => { closeConfirm(); doUpgrade(plan.gb); },
      });
    } else if (live && plan.gb < sub.plan_gb) {
      ask({
        title: `Switch to ${plan.gb} GB?`, danger: true, confirmLabel: 'Schedule downgrade',
        message: `This takes effect at the end of the current billing cycle${paidUntil ? ` (${formatDateTime(paidUntil)})` : ''}; you keep ${sub.plan_gb} GB until then. From then you are billed ${priceLine}. It is only allowed if everything you have stored fits in ${plan.gb} GB.`,
        onConfirm: () => { closeConfirm(); doDowngrade(plan.gb); },
      });
    }
  };

  const downloadInvoice = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const res = await api.get(`/virtual-workspace/subscription/invoices/${inv.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', `${inv.invoice_number.replace(/\//g, '-')}.pdf`);
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download the invoice'); } finally { setDownloadingId(null); }
  };

  // ── what each plan card offers ──
  const cardAction = (plan) => {
    if (!isAdmin) return { text: 'Account admin only', disabled: true };
    if (live && sub.plan_gb === plan.gb) return { current: true };
    if (sub?.status === 'HALTED') return { text: 'Fix payment first', disabled: true };
    if (sub?.pending_cancellation) return { text: 'Plan is cancelling', disabled: true };
    if (canSubscribe) return { text: 'Choose plan' };
    if (cancelledButPaid) return { text: 'Available after it ends', disabled: true };
    if (plan.gb > sub.plan_gb) return { text: 'Upgrade', icon: ArrowUpCircle };
    if (sub.scheduled_plan_gb === plan.gb) return { scheduled: true };
    return { text: 'Downgrade', icon: ArrowDownCircle };
  };

  return (
    <div>
      <div style={box}>
        <div style={eyebrow}>Storage used</div>
        <StorageMeter storage={data} />
        <p style={{ fontSize: 11.5, color: 'var(--on-muted)', margin: '14px 0 0', lineHeight: 1.6 }}>
          Counts every document your account holds: files you upload plus reports pulled from GST, ITR, bank and bureau APIs. A file shared by several cases is counted once.
          1 GB = 1,024 MB.
        </p>
      </div>

      {data.applies && (
        <>
          {/* Plan status */}
          {(sub && (live || cancelledButPaid)) && (
            <div style={{ ...box, borderLeft: '3px solid var(--primary)' }}>
              <div style={eyebrow}>Your plan</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--on-surface)' }}>
                {sub.plan_gb} GB · {inr(sub.base_amount_inr)}/month <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-muted)' }}>+ 18% GST</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--on-muted)', marginTop: 6, lineHeight: 1.7 }}>
                {sub.status === 'HALTED' && <div style={{ color: 'var(--error)', fontWeight: 600 }}>Last payment failed. Your plan stays active until {formatDateTime(sub.grace_period_ends_at)}, then storage returns to {data.free_gb} GB.</div>}
                {sub.pending_cancellation && <div style={{ color: 'var(--warning)', fontWeight: 600 }}>Cancelling — ends {paidUntil ? formatDateTime(paidUntil) : 'at the end of this cycle'}. Storage then returns to {data.free_gb} GB.</div>}
                {sub.scheduled_plan_gb && !sub.pending_cancellation && <div>Switching to {sub.scheduled_plan_gb} GB on {paidUntil ? formatDateTime(paidUntil) : 'the next cycle'}.</div>}
                {live && !sub.pending_cancellation && sub.status !== 'HALTED' && paidUntil && <div>Next charge {formatDateTime(paidUntil)}.</div>}
              </div>
              {isAdmin && live && !sub.pending_cancellation && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: 0, marginTop: 12 }}
                  disabled={busy}
                  onClick={() => ask({
                    title: 'Cancel your storage plan?', danger: true, confirmLabel: 'Cancel plan',
                    message: `Auto-debit stops. You keep ${sub.plan_gb} GB until ${paidUntil ? formatDateTime(paidUntil) : 'the end of this cycle'}, then storage returns to ${data.free_gb} GB. Nothing is deleted — but if you are using more than ${data.free_gb} GB then, new pulls and uploads pause until you free up space or subscribe again.`,
                    onConfirm: () => { closeConfirm(); doCancel(); },
                  })}
                >
                  Cancel plan
                </button>
              )}
            </div>
          )}

          {/* Plans */}
          <div style={box}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={eyebrow}>Plans</div>
              <button className="btn btn-ghost btn-sm" onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><RefreshCw size={12} /> Refresh</button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--on-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
              Every account gets {data.free_gb} GB free. A paid plan is your <b>total</b> storage (it replaces the free {data.free_gb} GB), billed at {inr(data.price_per_gb_inr)} per GB per month + 18% GST, auto-debited by Razorpay.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <div style={{ border: `1px solid ${!onPaidPlan ? 'var(--primary)' : 'var(--outline)'}`, padding: 14, background: 'var(--bg)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)' }}>{data.free_gb} GB</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>Free</div>
                <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2, minHeight: 30 }}>Included with every account</div>
                {!onPaidPlan && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={14} /> Current plan</div>}
              </div>
              {data.plans.map((plan) => {
                const a = cardAction(plan);
                const Icon = a.icon;
                return (
                  <div key={plan.gb} style={{ border: `1px solid ${a.current ? 'var(--primary)' : 'var(--outline)'}`, padding: 14, background: 'var(--bg)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--on-surface)' }}>{plan.gb} GB</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>{inr(plan.base_inr)}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-muted)' }}>/month</span></div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2, minHeight: 30 }}>+ GST {inr(plan.gst_inr)} = <b>{inr(plan.total_inr)}</b> per month</div>
                    {a.current ? (
                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={14} /> Current plan</div>
                    ) : a.scheduled ? (
                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>Switching at cycle end</div>
                    ) : (
                      <button
                        className={a.disabled ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                        style={{ borderRadius: 0, marginTop: 10, width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                        disabled={a.disabled || busy}
                        onClick={() => choose(plan)}
                      >
                        {a.disabled ? <Lock size={12} /> : (Icon && <Icon size={14} />)} {a.text}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isAdmin && invoices.length > 0 && (
            <div style={box}>
              <div style={eyebrow}>Storage invoices</div>
              {invoices.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--outline)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--on-surface)' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{formatDateTime(inv.charged_at)} · {inr(inv.base_amount_inr)} + GST {inr(inv.gst_amount_inr)} = <b>{inr(inv.total_amount_inr)}</b></div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={downloadingId === inv.id} onClick={() => downloadInvoice(inv)}>
                    {downloadingId === inv.id ? 'Preparing…' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={closeConfirm}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        isLoading={busy}
      />
    </div>
  );
};

export default StorageCard;
