import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Download, Receipt, Wallet } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { esrApiPortal, apiError, saveBlob } from '../../api/esrApiService';
import { loadRazorpay, createRazorpayCheckout } from '../../utils/razorpay';
import { Card, Field, Pill } from '../whitelabel/atoms';
import { Notice, Pager, Stat, StatRow, Table, day, dt, inr, num, td, useAsync, STATUS_TONE } from './common';

// Billing. Which sections exist is decided ONLY by the server's feature flags: the prepaid sections carry `billing.balance` / `billing.top_up*`,
// the postpaid ones `billing.credit_limit` / `billing.invoices` / `billing.pay_invoice`. This file never looks at the plan itself.
export default function BillingTab({ flag, reloadFeatures }) {
  const summary = useAsync(() => esrApiPortal.billing(), []);
  const refresh = () => { summary.reload(); reloadFeatures(); };

  if (summary.loading) return <LoadingSpinner />;
  if (summary.error) return <Notice tone="error">{apiError(summary.error, 'Could not load billing')}</Notice>;
  const s = summary.data;

  return (
    <>
      {flag('billing.balance') && s.prepaid && (
        <>
          <StatRow>
            <Stat label="Prepaid balance" value={inr(s.prepaid.balance_inr)} sub="Before GST. Top-ups add the amount you enter." tone={flag('billing.low_balance_warning') ? 'warning' : undefined} />
            <Stat label="Low-balance alert" value={inr(s.prepaid.low_balance_alert_inr)} sub="We e-mail you below this" />
          </StatRow>
          {flag('billing.low_balance_warning') && <Notice tone="warning" title="Your balance is low">Top up so production calls keep running.</Notice>}
          {flag('billing.top_up') && <TopUpCard limits={s.prepaid} onDone={refresh} />}
        </>
      )}

      {flag('billing.credit_limit') && s.postpaid && (
        <>
          <StatRow>
            <Stat label="Credit available" value={inr(s.postpaid.available_inr)} sub={`${inr(s.postpaid.used_inr)} used of ${inr(s.postpaid.credit_limit_inr)}`} />
            {flag('billing.unbilled_usage') && <Stat label="Not yet invoiced" value={inr(s.postpaid.not_yet_invoiced.estimated_total_inr)} sub={`${num(s.postpaid.not_yet_invoiced.calls)} calls · incl. est. GST · invoice on ${day(s.postpaid.not_yet_invoiced.next_invoice_on)}`} />}
            <Stat label="Unpaid invoices" value={num(s.postpaid.unpaid.count)} sub={s.postpaid.unpaid.count ? inr(s.postpaid.unpaid.total_inr) : 'Nothing due'} tone={flag('billing.overdue_notice') ? 'error' : undefined} />
          </StatRow>
          {flag('billing.blocked_notice') && <Notice tone="error" title="Production calls are blocked">An invoice is overdue past its grace period. Pay it below to resume.</Notice>}
          {flag('billing.overdue_notice') && !flag('billing.blocked_notice') && <Notice tone="warning" title="You have an overdue invoice">Please pay it below. Production calls are blocked if it stays unpaid.</Notice>}
        </>
      )}

      {flag('billing.invoices') && <InvoicesCard flag={flag} onPaid={refresh} />}
      {flag('billing.top_up_history') && <TopupsCard />}
      {flag('billing.ledger') && <LedgerCard />}
    </>
  );
}

// ── Razorpay Checkout, shared by top-ups and invoice payments ───────────────────────────────────────────────────────
// The payment is captured by Razorpay before our confirm call: if confirming fails it is retried, and the message says what to do.
async function checkout({ order, description, confirm }) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = createRazorpayCheckout(Razorpay, {
      key: order.key_id, amount: order.amount, currency: order.currency || 'INR', order_id: order.order_id, description,
      handler: async (response) => {
        let lastErr;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try { resolve(await confirm({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature })); return; }
          catch (err) { lastErr = err; if (attempt < 3) await new Promise((r) => setTimeout(r, 1500)); }
        }
        reject(Object.assign(new Error(`${apiError(lastErr)} If the amount was deducted, refresh in a moment. If it still does not show, contact support with payment ID ${response.razorpay_payment_id}.`), { paid: true }));
      },
      modal: { ondismiss: () => reject(Object.assign(new Error('Payment cancelled'), { cancelled: true })) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(`Payment failed: ${r.error?.description || 'please try again'}`)));
    rzp.open();
  });
}

function TopUpCard({ limits, onDone }) {
  const [amount, setAmount] = useState('1000');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= limits.top_up_min_inr && n <= limits.top_up_max_inr;
  const gst = valid ? Math.round(n * limits.gst_percent) / 100 : 0;

  const pay = async (e) => {
    e.preventDefault(); if (!valid) return; setBusy(true);
    try {
      const order = await esrApiPortal.createTopup(n);
      await checkout({ order, description: 'ESR API prepaid balance', confirm: (body) => esrApiPortal.confirmTopup({ topup_id: order.topup_id, ...body }) });
      toast.success(`${inr(n)} added to your balance`);
      onDone();
    } catch (err) { if (!err.cancelled) toast.error(err.message || apiError(err), { duration: err.paid ? 9000 : 4000 }); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Add balance" subtitle={`The amount you enter is added to your balance. GST (${limits.gst_percent}%) is charged on top. Between ${inr(limits.top_up_min_inr, 0)} and ${inr(limits.top_up_max_inr, 0)}.`}>
      <form onSubmit={pay} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Amount to add (₹)" htmlFor="topup-amount" error={amount && !valid ? `Enter a whole number from ${limits.top_up_min_inr} to ${limits.top_up_max_inr}.` : undefined}>
          <input id="topup-amount" className="form-control" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} style={{ width: 160 }} />
        </Field>
        <div style={{ paddingBottom: 14, fontSize: 13 }}>{valid && <>+ GST {inr(gst)} = <strong>{inr(n + gst)}</strong> to pay</>}</div>
        <div style={{ paddingBottom: 14 }}><button type="submit" className="btn btn-primary btn-sm" disabled={!valid || busy}>{busy ? 'Opening payment…' : 'Pay now'}</button></div>
      </form>
    </Card>
  );
}

const pdfName = (n) => `${String(n).replace(/\//g, '-')}.pdf`;

function InvoicesCard({ flag, onPaid }) {
  const [offset, setOffset] = useState(0);
  const [paying, setPaying] = useState(null);
  const inv = useAsync(() => esrApiPortal.invoices({ limit: 12, offset }), [offset]);

  const download = async (i) => { try { saveBlob(await esrApiPortal.invoicePdf(i.id), pdfName(i.invoice_number)); } catch (err) { toast.error(apiError(err, 'Could not download')); } };
  const pay = async (i) => {
    setPaying(i.id);
    try {
      const order = await esrApiPortal.payInvoice(i.id);
      await checkout({ order, description: `Invoice ${i.invoice_number}`, confirm: (body) => esrApiPortal.confirmInvoicePayment(i.id, body) });
      toast.success(`Invoice ${i.invoice_number} paid`); inv.reload(); onPaid();
    } catch (err) { if (!err.cancelled) toast.error(err.message || apiError(err), { duration: err.paid ? 9000 : 4000 }); }
    finally { setPaying(null); }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Card title="Invoices" subtitle="Monthly GST invoices for your production calls.">
        {inv.loading ? <LoadingSpinner /> : inv.error ? <Notice tone="error">{apiError(inv.error)}</Notice> : !inv.data.invoices.length ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Your first invoice is issued after your first billing month." />
        ) : (
          <>
            <Table head={['Invoice', 'Period', 'Due', 'Total (incl. GST)', 'Status', '']}>
              {inv.data.invoices.map((i) => (
                <tr key={i.id}>
                  <td style={td}>{i.invoice_number}</td><td style={td}>{i.period}</td><td style={td}>{day(i.due_date)}</td><td style={td}>{inr(i.total_inr)}</td>
                  <td style={td}><Pill tone={STATUS_TONE[i.status] || 'neutral'}>{i.status === 'ISSUED' ? 'Unpaid' : i.status === 'PAID' ? 'Paid' : i.status}</Pill></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(i)}><Download size={13} /> PDF</button>
                    {flag('billing.pay_invoice') && i.status === 'ISSUED' && <button type="button" className="btn btn-primary btn-sm" disabled={paying === i.id} onClick={() => pay(i)}>{paying === i.id ? 'Opening…' : 'Pay'}</button>}
                  </td>
                </tr>
              ))}
            </Table>
            <Pager total={inv.data.total} limit={12} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
    </div>
  );
}

function TopupsCard() {
  const [offset, setOffset] = useState(0);
  const t = useAsync(() => esrApiPortal.topups({ limit: 10, offset }), [offset]);
  const download = async (x) => { try { saveBlob(await esrApiPortal.topupPdf(x.id), pdfName(x.invoice_number)); } catch (err) { toast.error(apiError(err, 'Could not download')); } };
  return (
    <div style={{ marginTop: 16 }}>
      <Card title="Top-up history">
        {t.loading ? <LoadingSpinner /> : t.error ? <Notice tone="error">{apiError(t.error)}</Notice> : !t.data.topups.length ? (
          <EmptyState icon={Wallet} title="No top-ups yet" description="Balance you add will be listed here with its tax invoice." />
        ) : (
          <>
            <Table head={['Date', 'Added to balance', 'GST', 'Paid', 'Status', 'Invoice']}>
              {t.data.topups.map((x) => (
                <tr key={x.id}>
                  <td style={td}>{dt(x.credited_at || x.created_at)}</td><td style={td}>{inr(x.taxable_inr)}</td><td style={td}>{inr(x.gst_inr)}</td><td style={td}>{inr(x.total_inr)}</td>
                  <td style={td}><Pill tone={STATUS_TONE[x.status] || 'neutral'}>{x.status}</Pill></td>
                  <td style={td}>{x.invoice_number ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(x)}><Download size={13} /> {x.invoice_number}</button> : '—'}</td>
                </tr>
              ))}
            </Table>
            <Pager total={t.data.total} limit={10} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
    </div>
  );
}

const ENTRY_LABEL = { TOPUP: 'Top-up', CHARGE: 'API call', REFUND: 'Refund', ADJUSTMENT: 'Adjustment', PAYMENT: 'Invoice payment' };

function LedgerCard() {
  const [offset, setOffset] = useState(0);
  const l = useAsync(() => esrApiPortal.ledger({ limit: 25, offset }), [offset]);
  return (
    <div style={{ marginTop: 16 }}>
      <Card title="Account statement" subtitle="Every change to your balance, newest first. Amounts are before GST.">
        {l.loading ? <LoadingSpinner /> : l.error ? <Notice tone="error">{apiError(l.error)}</Notice> : !l.data.entries.length ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No entries yet.</p>
        ) : (
          <>
            <Table head={['Date', 'Type', 'Amount', 'Balance after', 'Note']}>
              {l.data.entries.map((e) => (
                <tr key={e.id}>
                  <td style={td}>{dt(e.created_at)}</td><td style={td}>{ENTRY_LABEL[e.entry_type] || e.entry_type}</td>
                  <td style={{ ...td, color: e.amount_inr < 0 ? 'var(--error)' : 'var(--success)' }}>{e.amount_inr > 0 ? '+' : ''}{inr(e.amount_inr)}</td>
                  <td style={td}>{inr(e.balance_after_inr)}</td><td style={td}>{e.remarks || '—'}</td>
                </tr>
              ))}
            </Table>
            <Pager total={l.data.total} limit={25} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
    </div>
  );
}
