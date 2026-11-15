import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService, apiError, fieldErrors } from '../../api/whitelabelService';
import { Card, Field, Grid, Pill } from './atoms';

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const periodLabel = (p) => { const [y, m] = p.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
const btn = { borderRadius: 0 };
// How an API call ended, as the main-app admin ledger shows it.
const USAGE_PILL = { SUCCESS: { tone: 'success', label: 'Succeeded' }, FAILED: { tone: 'error', label: 'Failed' }, REFUNDED: { tone: 'warning', label: 'Refunded' } };

/**
 * The organisation's wallet and its optional monthly platform fee. Credits are added or deducted inside ITS OWN database (the
 * same wallet its users see), always with a reason and the admin's confirmation, and the fee is taken from that wallet.
 */
const BillingTab = ({ org, stepUp, onOrgChanged }) => {
  const [w, setW] = useState(null);
  const [fee, setFee] = useState(null);
  const [error, setError] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [form, setForm] = useState({ direction: 'CREDIT', credits: '', reason: '' });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [rows, setRows] = useState(25); // how many wallet entries to show; "Show more" raises it

  const load = useCallback(async (tid, count = rows) => {
    try {
      const [wallet, f] = await Promise.all([whitelabelService.wallet(org.id, tid, count), whitelabelService.platformFee(org.id)]);
      setW(wallet); setFee(f); setTenantId(wallet.focus_tenant_id); setError(null);
      setFeeInput((cur) => (cur === '' && f.fee_credits ? String(f.fee_credits) : cur));
    } catch (e) { setError(apiError(e, 'Could not load billing')); }
  }, [org.id, rows]);
  useEffect(() => { load(null); }, [load]);
  const showMore = () => setRows((n) => Math.min(n + 25, 100));

  const adjust = async (e) => {
    e.preventDefault(); setErrs({});
    const credits = Number(form.credits);
    if (!tenantId) { setErrs({ tenant_id: 'Choose a partner.' }); return; }
    if (!Number.isInteger(credits) || credits < 1) { setErrs({ credits: 'Enter a whole number of credits.' }); return; }
    if (form.reason.trim().length < 3) { setErrs({ reason: 'Give a reason (at least 3 characters).' }); return; }
    setBusy(true);
    try {
      const out = await stepUp.run((h) => whitelabelService.adjustWallet(org.id, { tenant_id: tenantId, direction: form.direction, credits, reason: form.reason.trim() }, h));
      toast.success(`${form.direction === 'CREDIT' ? 'Added' : 'Deducted'} ${num(credits)} credits. Balance is now ${num(out.balance)}.`);
      setForm({ direction: form.direction, credits: '', reason: '' }); await load(tenantId);
    } catch (err) { if (!err.cancelled) { setErrs(fieldErrors(err)); toast.error(apiError(err, 'Could not change the wallet')); } }
    finally { setBusy(false); }
  };

  const saveFee = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const credits = feeInput === '' ? null : Number(feeInput);
      const out = await stepUp.run((h) => whitelabelService.setPlatformFee(org.id, credits, h));
      toast.success(out.platform_fee_credits ? `Fee set. It starts in ${periodLabel(out.platform_fee_from)}.` : 'Platform fee removed');
      onOrgChanged?.({ ...org, ...out }); await load(tenantId);
    } catch (err) { if (!err.cancelled) toast.error(apiError(err, 'Could not save the fee')); }
    finally { setBusy(false); }
  };

  const chargeNow = async () => {
    setBusy(true);
    try {
      const out = await stepUp.run((h) => whitelabelService.chargePlatformFee(org.id, h));
      const paid = (out.results || []).filter((r) => r.status === 'PAID' && !r.already).length;
      toast[paid ? 'success' : 'error'](paid ? `${paid} month${paid === 1 ? '' : 's'} paid from the wallet` : 'Nothing could be taken: the wallet does not hold enough credits yet');
      await load(tenantId);
    } catch (err) { if (!err.cancelled) toast.error(apiError(err, 'Could not charge the fee')); }
    finally { setBusy(false); }
  };

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>;
  if (!w || !fee) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={26} /></div>;
  const focus = w.tenants.find((t) => t.tenant_id === tenantId);
  const th = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' };
  const td = { padding: '9px 10px', fontSize: 12.5, borderTop: '1px solid var(--outline)', color: 'var(--on-surface)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {fee.unpaid_periods.length > 0 && (
        <p role="status" style={{ margin: 0, padding: '10px 12px', fontSize: 13, background: 'var(--warning-bg)', color: 'var(--text-primary)' }}>
          Platform fee unpaid for {fee.unpaid_periods.map(periodLabel).join(', ')}: the wallet did not hold enough credits. It is retried every night; you can also add credits below or suspend the organisation.
        </p>
      )}

      <Card title="Wallet" subtitle="The organisation's own credits, the same wallet its users spend from. About 1 credit = ₹1.">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead><tr><th style={th}>Partner</th><th style={{ ...th, textAlign: 'right' }}>Balance (credits)</th><th style={th} /></tr></thead>
          <tbody>
            {w.tenants.map((t) => (
              <tr key={t.tenant_id} style={{ background: t.tenant_id === tenantId ? 'var(--bg-elevated)' : 'transparent' }}>
                <td style={td}>{t.name}{t.primary && <span style={{ marginLeft: 8 }}><Pill tone="info">Main account</Pill></span>}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{num(t.balance)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{t.tenant_id !== tenantId && <button type="button" className="btn btn-secondary btn-sm" style={btn} onClick={() => load(t.tenant_id)}>Select</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={adjust} aria-label="Add or deduct credits">
          <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>Add or deduct credits{focus ? ` · ${focus.name}` : ''}</h4>
          <Grid cols={3}>
            <Field label="Action" htmlFor="wl-adj-dir">
              <select id="wl-adj-dir" className="form-control" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="CREDIT">Add credits</option><option value="DEBIT">Deduct credits</option>
              </select>
            </Field>
            <Field label="Credits" htmlFor="wl-adj-credits" error={errs.credits}>
              <input id="wl-adj-credits" className="form-control" inputMode="numeric" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 500" />
            </Field>
            <Field label="Reason (kept in the activity log)" htmlFor="wl-adj-reason" error={errs.reason}>
              <input id="wl-adj-reason" className="form-control" maxLength={200} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Goodwill credit" />
            </Field>
          </Grid>
          {errs.tenant_id && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{errs.tenant_id}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={btn}>{busy ? <LoadingSpinner size={14} /> : (form.direction === 'CREDIT' ? 'Add credits' : 'Deduct credits')}</button>
        </form>
      </Card>

      <Card title="Wallet activity" subtitle={focus ? `${focus.name} · every charge, refund and top-up, newest first` : undefined}>
        {w.transactions.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--on-muted)' }}>No wallet activity yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Detail</th><th style={{ ...th, textAlign: 'right' }}>Credits</th><th style={{ ...th, textAlign: 'right' }}>Balance after</th></tr></thead>
              <tbody>
                {w.transactions.map((t) => {
                  const used = t.usage_status ? USAGE_PILL[t.usage_status] : null;
                  return (
                    <tr key={t.id}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(t.created_at)}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{t.is_api_refund ? `Refund · ${t.service_name || t.api_code}` : (t.service_name && t.reference_type === 'API_CALL' ? t.service_name : t.kind)}</div>
                        {t.service_name && (t.reference_type === 'API_CALL' || t.vendor) && <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{[t.is_api_refund ? null : t.kind, t.vendor].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td style={{ ...td, maxWidth: 380 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {used && <Pill tone={used.tone}>{used.label}</Pill>}
                          {t.case_id ? <span style={{ fontSize: 11.5, color: 'var(--on-muted)' }}>Case #{t.case_id}</span> : null}
                          {t.api_code && t.api_code !== t.service_name && <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--on-muted)' }}>{t.api_code}</span>}
                        </div>
                        {t.failure_reason && <div style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 3 }}>{t.failure_reason}</div>}
                        {t.call_time && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>Call made {when(t.call_time)}</div>}
                        {t.refunded_at && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>Refunded {when(t.refunded_at)}{t.refunded_amount ? ` · ${num(t.refunded_amount)} credits back` : ''}</div>}
                        {t.remarks ? <div style={{ fontSize: 11.5, color: 'var(--on-muted)', marginTop: 3 }}>{t.remarks}</div> : null}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--on-surface)' }}>{t.transaction_type === 'CREDIT' ? '+' : '−'}{num(t.amount)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{num(t.balance_after)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {w.has_more && rows < 100 && <div style={{ textAlign: 'center', marginTop: 12 }}><button type="button" className="btn btn-secondary btn-sm" style={btn} onClick={showMore}>Show more</button></div>}
          </div>
        )}
      </Card>

      <Card title="Monthly platform fee" subtitle="Optional. Taken from the organisation's own wallet once a month, never partly, never below zero. It starts next month, not retroactively.">
        <form onSubmit={saveFee} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <Field label="Fee per month (credits)" htmlFor="wl-fee" hint={fee.fee_credits ? `Current: ${num(fee.fee_credits)} credits${fee.effective_from ? ` from ${periodLabel(fee.effective_from)}` : ''}.` : 'No fee at the moment.'}>
              <input id="wl-fee" className="form-control" inputMode="numeric" value={feeInput} onChange={(e) => setFeeInput(e.target.value.replace(/\D/g, ''))} placeholder="No fee" />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ ...btn, marginBottom: 14 }}>Save fee</button>
          {fee.unpaid_periods.length > 0 && org.status === 'ACTIVE' && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={chargeNow} style={{ ...btn, marginBottom: 14 }}>Charge unpaid months now</button>}
        </form>
        {fee.charges.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead><tr><th style={th}>Month</th><th style={{ ...th, textAlign: 'right' }}>Credits</th><th style={th}>Status</th><th style={th}>Paid / last tried</th></tr></thead>
            <tbody>
              {fee.charges.map((c) => (
                <tr key={c.period}>
                  <td style={td}>{periodLabel(c.period)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{num(c.credits)}</td>
                  <td style={td}><Pill tone={c.status === 'PAID' ? 'success' : 'warning'}>{c.status === 'PAID' ? 'Paid' : 'Unpaid'}</Pill>{c.note && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3 }}>{c.note}</div>}</td>
                  <td style={td}>{when(c.paid_at || c.last_attempt_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--on-muted)' }}>
          The fee is spending credits that were already taxed when they were bought, so it creates no new invoice and no new line on the Wallet Revenue &amp; GST page. It shows in usage as the platform fee.
        </p>
      </Card>
    </div>
  );
};

export default BillingTab;
