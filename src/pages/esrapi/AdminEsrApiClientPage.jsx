import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Download, Plug, Receipt } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { esrApiAdmin, apiError, saveBlob } from '../../api/esrApiService';
import { Card, Field, PageFrame, Pill } from '../whitelabel/atoms';
import { Modal, Notice, Pager, Sharp, Stat, StatRow, Table, day, dt, inr, inrSigned, num, td, useAsync, ENV_TONE, STATUS_TONE } from './common';

const TABS = [{ id: 'summary', label: 'Summary' }, { id: 'access', label: 'Access' }, { id: 'pricing', label: 'Pricing' }, { id: 'money', label: 'Money' }];
const rupeesToPaise = (v) => Math.round(Number(v) * 100);

export default function AdminEsrApiClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const c = useAsync(() => esrApiAdmin.client(clientId), [clientId]);

  const back = <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/esr-api')} aria-label="Back to API clients"><ArrowLeft size={16} /></button>;
  if (c.loading) return <PageFrame icon={Plug} title="API client" back={back}><LoadingSpinner /></PageFrame>;
  if (c.error) return <PageFrame icon={Plug} title="API client" back={back}><Notice tone="error">{apiError(c.error, 'Could not load this client')}</Notice></PageFrame>;
  const d = c.data; const cl = d.client;

  return (
    <PageFrame icon={Plug} title={d.organisation.name} subtitle={`${cl.billing_mode === 'PREPAID' ? 'Prepaid' : 'Postpaid'} · ${cl.status}`} back={back} tabs={TABS} tab={tab} onTab={setTab}>
      <Sharp>
        {tab === 'summary' && <Summary d={d} reload={c.reload} />}
        {tab === 'access' && <Access d={d} reload={c.reload} />}
        {tab === 'pricing' && <PricingPanel clientId={cl.id} />}
        {tab === 'money' && <Money d={d} reload={c.reload} />}
      </Sharp>
    </PageFrame>
  );
}

// ── Summary: account facts, settings changes, plan change ─────────────────────────────────────────────────────────

function Summary({ d, reload }) {
  const cl = d.client;
  const [editing, setEditing] = useState(null);
  const [plan, setPlan] = useState(false);
  return (
    <>
      {cl.status === 'SUSPENDED' && <Notice tone="warning" title="Suspended">{cl.suspended_reason}</Notice>}
      <StatRow>
        {cl.billing_mode === 'PREPAID' ? <Stat label="Balance" value={inr(cl.balance_inr)} sub={`Alert below ${inr(cl.low_balance_alert_paise / 100)}`} /> : <Stat label="Credit used" value={inr(Math.max(0, -cl.balance_inr))} sub={`of ${inr(cl.credit_limit_inr)}`} />}
        <Stat label="Test calls left" value={num(cl.uat_credits_remaining)} sub={`of ${num(cl.uat_credits_total)}`} />
        <Stat label="Not yet invoiced" value={inr(d.unbilled_usage.taxable_inr)} sub={`${num(d.unbilled_usage.calls)} calls, before GST`} />
      </StatRow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card title="Organisation">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
            <dt>E-mail</dt><dd style={{ margin: 0 }}>{d.organisation.email}</dd>
            <dt>GSTIN</dt><dd style={{ margin: 0 }}>{d.organisation.gst_number || 'None (invoiced as unregistered)'}</dd>
            <dt>State</dt><dd style={{ margin: 0 }}>{d.organisation.state || '—'}</dd>
            <dt>Created</dt><dd style={{ margin: 0 }}>{dt(cl.created_at)}</dd>
          </dl>
        </Card>
        <Card title="Access and limits" actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Change</button>}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
            <dt>Status</dt><dd style={{ margin: 0 }}><Pill tone={STATUS_TONE[cl.status] || 'neutral'}>{cl.status}</Pill></dd>
            <dt>Test access</dt><dd style={{ margin: 0 }}>{cl.uat_enabled ? 'On' : 'Off'}{cl.uat_expires_at ? ` until ${day(cl.uat_expires_at)}` : ''}</dd>
            <dt>Production</dt><dd style={{ margin: 0 }}>{cl.prod_enabled ? 'On' : 'Off'}</dd>
            <dt>Rate limit</dt><dd style={{ margin: 0 }}>{cl.rate_limit_per_min ? `${num(cl.rate_limit_per_min)} / min` : 'Platform default'}</dd>
            {cl.billing_mode === 'POSTPAID' && <><dt>Billing</dt><dd style={{ margin: 0 }}>Day {cl.billing_day}, due in {cl.payment_due_days} days, {cl.grace_days} days grace</dd></>}
          </dl>
        </Card>
        <Card title="Billing plan" actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlan(true)}>Change plan</button>}>
          <p style={{ margin: 0, fontSize: 13 }}>{cl.billing_mode === 'PREPAID' ? 'Prepaid: the client tops up a balance and each production call is deducted.' : `Postpaid: calls are billed monthly with a credit limit of ${inr(cl.credit_limit_inr)}.`}</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Only an administrator here can change the plan; the client cannot.</p>
        </Card>
        <Card title="People">
          <Table head={['Name', 'E-mail', 'Role', 'Status']}>
            {d.users.map((u) => <tr key={u.id}><td style={td}>{u.name}</td><td style={td}>{u.email}</td><td style={td}>{u.role === 'API_CLIENT_ADMIN' ? 'Administrator' : 'Member'}</td><td style={td}>{u.status}</td></tr>)}
          </Table>
        </Card>
      </div>
      {editing && <SettingsModal cl={cl} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {plan && <PlanModal cl={cl} onClose={() => setPlan(false)} onSaved={() => { setPlan(false); reload(); }} />}
    </>
  );
}

function SettingsModal({ cl, onClose, onSaved }) {
  const [f, setF] = useState({ status: cl.status, uat_enabled: cl.uat_enabled, prod_enabled: cl.prod_enabled, uat_credits_total: String(cl.uat_credits_total), rate_limit_per_min: cl.rate_limit_per_min ?? '', billing_day: String(cl.billing_day), payment_due_days: String(cl.payment_due_days), grace_days: String(cl.grace_days), credit_limit_inr: String(cl.credit_limit_inr), low_balance_alert_inr: String(cl.low_balance_alert_paise / 100), billing_email: cl.billing_email || '' });
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const settings = { status: f.status, uat_enabled: f.uat_enabled, prod_enabled: f.prod_enabled, uat_credits_total: Number(f.uat_credits_total), rate_limit_per_min: f.rate_limit_per_min === '' ? null : Number(f.rate_limit_per_min), low_balance_alert_paise: rupeesToPaise(f.low_balance_alert_inr), billing_email: f.billing_email || null };
      if (cl.billing_mode === 'POSTPAID') Object.assign(settings, { billing_day: Number(f.billing_day), payment_due_days: Number(f.payment_due_days), grace_days: Number(f.grace_days), credit_limit_paise: rupeesToPaise(f.credit_limit_inr) });
      await esrApiAdmin.updateSettings(cl.id, settings, reason); toast.success('Saved'); onSaved();
    } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="Access and limits" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 14 }}>
          <Field label="Status" htmlFor="s-status"><select id="s-status" className="form-control" value={f.status} onChange={set('status')}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended (blocks all calls)</option><option value="CLOSED">Closed (permanent)</option></select></Field>
          <Field label="Free test calls (total)" htmlFor="s-uat"><input id="s-uat" className="form-control" inputMode="numeric" value={f.uat_credits_total} onChange={set('uat_credits_total')} /></Field>
          <Field label="Rate limit per minute" hint="Blank = platform default" htmlFor="s-rate"><input id="s-rate" className="form-control" inputMode="numeric" value={f.rate_limit_per_min} onChange={set('rate_limit_per_min')} /></Field>
          <Field label="Low-balance alert (₹)" htmlFor="s-low"><input id="s-low" className="form-control" inputMode="decimal" value={f.low_balance_alert_inr} onChange={set('low_balance_alert_inr')} /></Field>
          {cl.billing_mode === 'POSTPAID' && (
            <>
              <Field label="Credit limit (₹)" htmlFor="s-limit"><input id="s-limit" className="form-control" inputMode="decimal" value={f.credit_limit_inr} onChange={set('credit_limit_inr')} /></Field>
              <Field label="Invoice day of month" htmlFor="s-bd"><input id="s-bd" className="form-control" inputMode="numeric" value={f.billing_day} onChange={set('billing_day')} /></Field>
              <Field label="Days to pay" htmlFor="s-due"><input id="s-due" className="form-control" inputMode="numeric" value={f.payment_due_days} onChange={set('payment_due_days')} /></Field>
              <Field label="Grace days after due" htmlFor="s-grace"><input id="s-grace" className="form-control" inputMode="numeric" value={f.grace_days} onChange={set('grace_days')} /></Field>
            </>
          )}
          <Field label="Billing e-mail (extra)" htmlFor="s-be"><input id="s-be" type="email" className="form-control" value={f.billing_email} onChange={set('billing_email')} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
          <label><input type="checkbox" checked={f.uat_enabled} onChange={set('uat_enabled')} /> Test access</label>
          <label><input type="checkbox" checked={f.prod_enabled} onChange={set('prod_enabled')} /> Production access</label>
        </div>
        <Field label="Reason for the change" required hint="At least 5 characters. Kept in the audit log." htmlFor="s-reason"><input id="s-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || reason.trim().length < 5}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function PlanModal({ cl, onClose, onSaved }) {
  const to = cl.billing_mode === 'PREPAID' ? 'POSTPAID' : 'PREPAID';
  const [limit, setLimit] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiAdmin.changeBillingMode(cl.id, { mode: to, reason, ...(to === 'POSTPAID' ? { credit_limit_paise: rupeesToPaise(limit || 0) } : {}) }); toast.success('Plan changed'); onSaved(); }
    catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Change to ${to === 'POSTPAID' ? 'postpaid' : 'prepaid'}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0, fontSize: 13 }}>{to === 'POSTPAID' ? 'Any remaining prepaid balance must be refunded or used first. The client will be invoiced monthly.' : 'All postpaid invoices must be settled first. The client will top up a balance instead.'} The change is refused if money is still owed either way.</p>
        {to === 'POSTPAID' && <Field label="Credit limit (₹)" required htmlFor="p-limit"><input id="p-limit" className="form-control" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>}
        <Field label="Reason" required htmlFor="p-reason"><input id="p-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || reason.trim().length < 5 || (to === 'POSTPAID' && !(Number(limit) > 0))}>Change plan</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Keys and IP addresses ─────────────────────────────────────────────────────────────────────────────────────────

function Access({ d, reload }) {
  const id = d.client.id;
  const [ip, setIp] = useState({ environment: 'UAT', cidr: '', label: '' });
  const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast.success(ok); reload(); return r; } catch (err) { toast.error(apiError(err)); return null; } };
  return (
    <>
      <Card title="API keys" subtitle="Keys belong to the client. They are created, rotated and revoked by the client's own administrators and are never shown here.">
        <p style={{ margin: 0, fontSize: 13 }} data-testid="admin-key-counts">
          Live keys: <strong>{d.key_counts.UAT}</strong> test, <strong>{d.key_counts.PRODUCTION}</strong> production.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>To stop all of this client's access immediately, suspend the account (Summary, Access and limits).</p>
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Allowed IP addresses" subtitle="A new address is active as soon as it is added.">
        <Table head={['Address', 'Environment', 'Label', '']}>
          {d.ips.map((i) => <tr key={i.id}><td style={{ ...td, fontFamily: 'ui-monospace, monospace' }}>{i.cidr}</td><td style={td}><Pill tone={ENV_TONE[i.environment]}>{i.environment}</Pill></td><td style={td}>{i.label || '—'}</td><td style={td}><button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => esrApiAdmin.removeIp(id, i.id), 'Removed')}>Remove</button></td></tr>)}
        </Table>
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (await run(() => esrApiAdmin.addIp(id, ip), 'Added')) setIp({ ...ip, cidr: '', label: '' }); }}>
          <input className="form-control" style={{ flex: '1 1 160px' }} placeholder="203.0.113.0/24" value={ip.cidr} onChange={(e) => setIp({ ...ip, cidr: e.target.value })} aria-label="IP address or range" />
          <input className="form-control" style={{ flex: '1 1 120px' }} placeholder="Label" value={ip.label} onChange={(e) => setIp({ ...ip, label: e.target.value })} aria-label="Label" />
          <select className="form-control" style={{ width: 'auto' }} value={ip.environment} onChange={(e) => setIp({ ...ip, environment: e.target.value })} aria-label="IP environment"><option value="UAT">Test</option><option value="PRODUCTION">Production</option></select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!ip.cidr.trim()}>Add</button>
        </form>
      </Card>
    </>
  );
}

// ── Pricing (per client, or the platform default when clientId is null) ───────────────────────────────────────────

export function PricingPanel({ clientId }) {
  const list = useAsync(() => esrApiAdmin.pricing(clientId ? { client_id: clientId } : {}), [clientId]);
  const [f, setF] = useState({ price: '', free: '0', reason: '', slabs: [] });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setSlab = (i, k, v) => setF((s) => ({ ...s, slabs: s.slabs.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  const body = () => {
    const slabs = f.slabs.length ? f.slabs.map((s, i) => ({ up_to: i === f.slabs.length - 1 ? null : Number(s.up_to), price_paise: rupeesToPaise(s.price) })) : null;
    return { client_id: clientId || undefined, price_per_call_paise: rupeesToPaise(f.price || 0), free_calls_per_month: Number(f.free) || 0, slabs, reason: f.reason };
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiAdmin.addPricing(body()); toast.success('Price saved. It applies to calls from now on.'); setF({ price: '', free: '0', reason: '', slabs: [] }); list.reload(); }
    catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <Notice tone="info">Prices are <strong>before GST</strong>. A new price applies to calls from now on; earlier calls keep the price they were charged at. {clientId ? 'A client price overrides the platform default.' : 'This is the platform default, used for any client without their own price. With no price set, calls are free.'}</Notice>
      <Card title="Set a new price">
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 14 }}>
            <Field label="Price per call (₹)" htmlFor="pr-price"><input id="pr-price" className="form-control" inputMode="decimal" value={f.price} onChange={set('price')} disabled={f.slabs.length > 0} /></Field>
            <Field label="Free calls per month" htmlFor="pr-free"><input id="pr-free" className="form-control" inputMode="numeric" value={f.free} onChange={set('free')} /></Field>
          </div>
          {f.slabs.map((s, i) => {
            const last = i === f.slabs.length - 1;
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <span style={{ width: 70 }}>Slab {i + 1}</span>
                {last ? <span style={{ width: 150 }}>and above</span> : <input className="form-control" style={{ width: 150 }} placeholder="up to call #" inputMode="numeric" value={s.up_to} onChange={(e) => setSlab(i, 'up_to', e.target.value)} aria-label={`Slab ${i + 1} up to`} />}
                <input className="form-control" style={{ width: 150 }} placeholder="₹ per call" inputMode="decimal" value={s.price} onChange={(e) => setSlab(i, 'price', e.target.value)} aria-label={`Slab ${i + 1} price`} />
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setF((s) => ({ ...s, slabs: [...s.slabs, { up_to: '', price: '' }] }))}>Add volume slab</button>
            {f.slabs.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((s) => ({ ...s, slabs: [] }))}>Remove slabs</button>}
          </div>
          <Field label="Reason" required htmlFor="pr-reason"><input id="pr-reason" className="form-control" value={f.reason} onChange={set('reason')} /></Field>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || f.reason.trim().length < 5}>Save price</button>
        </form>
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Price history">
        {list.loading ? <LoadingSpinner /> : list.error ? <Notice tone="error">{apiError(list.error)}</Notice> : !list.data.pricing.length ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No price set.</p> : (
          <Table head={['From', 'Per call', 'Free / month', 'Slabs', '']}>
            {list.data.pricing.map((p) => (
              <tr key={p.id}><td style={td}>{dt(p.effective_from)}</td><td style={td}>{inr(p.price_per_call_paise / 100)}</td><td style={td}>{num(p.free_calls_per_month)}</td>
                <td style={td}>{p.slabs ? p.slabs.map((s, i) => <div key={i}>{s.up_to ? `up to ${num(s.up_to)}` : 'above'}: {inr(s.price_paise / 100)}</div>) : '—'}</td>
                <td style={td}>{p.id === list.data.current_id && <Pill tone="success">Current</Pill>}</td></tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

// ── Money: ledger, adjustments, invoices, top-ups and refunds ─────────────────────────────────────────────────────

function Money({ d, reload }) {
  const id = d.client.id;
  const [offset, setOffset] = useState(0);
  const ledger = useAsync(() => esrApiAdmin.ledger(id, { limit: 25, offset }), [id, offset]);
  const [adjusting, setAdjusting] = useState(false);
  const [payInv, setPayInv] = useState(null);
  const [billing, setBilling] = useState(false);          // the "Generate bill" confirmation
  const [adjustInv, setAdjustInv] = useState(null);       // the invoice being adjusted
  const [refund, setRefund] = useState(null);
  const [month, setMonth] = useState('');
  const refreshAll = () => { ledger.reload(); reload(); };
  const pdf = async (fn, name) => { try { saveBlob(await fn(), `${String(name).replace(/\//g, '-')}.pdf`); } catch (err) { toast.error(apiError(err)); } };

  return (
    <>
      <Card title="Balance adjustments" subtitle="A manual credit or debit, with a reason. Always recorded in the ledger and audit log."
        actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdjusting(true)}>Adjust balance</button>}>
        {ledger.loading ? <LoadingSpinner /> : ledger.error ? <Notice tone="error">{apiError(ledger.error)}</Notice> : (
          <>
            <Table head={['Date', 'Type', 'Amount', 'Balance after', 'Note', '']}>
              {ledger.data.entries.map((e) => (
                <tr key={e.id}><td style={td}>{dt(e.created_at)}</td><td style={td}>{e.entry_type}</td><td style={{ ...td, color: e.amount_inr < 0 ? 'var(--error)' : 'var(--success)' }}>{inr(e.amount_inr)}</td><td style={td}>{inr(e.balance_after_inr)}</td><td style={td}>{e.remarks || '—'}</td>
                  <td style={td}>{e.reference === 'ADMIN_CREDIT' && <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { const reason = window.prompt('Reason for reversing this adjustment'); if (!reason) return; try { await esrApiAdmin.reverseAdjustment(id, e.id, reason); toast.success('Reversed'); refreshAll(); } catch (err) { toast.error(apiError(err)); } }}>Reverse</button>}</td></tr>
              ))}
            </Table>
            <Pager total={ledger.data.total} limit={25} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
      <div style={{ height: 16 }} />
      {d.client.billing_mode === 'POSTPAID' && (
        <Card title="Invoices" subtitle="Bill the unpaid calls whenever you like. The client is e-mailed the invoice and can pay it from their dashboard straight away."
          actions={(
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setBilling(true)} data-testid="generate-bill"><Receipt size={14} /> Generate bill</button>
              <form style={{ display: 'flex', gap: 6 }} onSubmit={async (e) => { e.preventDefault(); try { await esrApiAdmin.generateInvoice(id, month); toast.success('Invoice generated'); setMonth(''); reload(); } catch (err) { toast.error(apiError(err)); } }}><input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Invoice month" /><button type="submit" className="btn btn-secondary btn-sm" disabled={!month}>Generate month</button></form>
            </>
          )}>
          <Table head={['Invoice', 'Period', 'Total (incl. GST)', 'Status', '']}>
            {d.invoices.map((i) => (
              <tr key={i.id}>
                <td style={td}>{i.invoice_number}{i.bill_kind === 'ON_DEMAND' && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Bill on request</div>}</td>
                <td style={td}>{i.period || day(i.period_start)}</td>
                <td style={td}>{inr(i.total_paise / 100)}{i.revision > 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Revised {i.revision}×, adjustment {inrSigned(i.adjustment_paise / 100)} before GST</div>}</td>
                <td style={td}><Pill tone={STATUS_TONE[i.status] || 'neutral'}>{i.status === 'ISSUED' ? 'Unpaid' : i.status}</Pill></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => pdf(() => esrApiAdmin.invoicePdf(i.id), i.invoice_number)}><Download size={13} /> PDF</button>
                  {i.status === 'ISSUED' && <><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdjustInv(i)} data-testid="adjust-bill">Adjust bill</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPayInv(i)}>Record payment</button><button type="button" className="btn btn-ghost btn-sm" onClick={async () => { try { await esrApiAdmin.resendInvoice(i.id); toast.success('Invoice e-mailed again'); } catch (err) { toast.error(apiError(err)); } }}>Resend</button></>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {d.client.billing_mode === 'PREPAID' && (
        <Card title="Top-ups" subtitle="Only balance the client has not spent can be refunded. The GST part goes back with a credit note.">
          <Table head={['Date', 'Added', 'Paid (incl. GST)', 'Status', 'Invoice', '']}>
            {d.topups.map((t) => (
              <tr key={t.id}><td style={td}>{dt(t.credited_at || t.created_at)}</td><td style={td}>{inr(t.taxable_paise / 100)}</td><td style={td}>{inr(t.total_paise / 100)}</td><td style={td}><Pill tone={STATUS_TONE[t.status] || 'neutral'}>{t.status}</Pill></td><td style={td}>{t.invoice_number || '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.invoice_number && <button type="button" className="btn btn-ghost btn-sm" onClick={() => pdf(() => esrApiAdmin.topupPdf(t.id), t.invoice_number)}><Download size={13} /> PDF</button>}
                  {t.status === 'CREDITED' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRefund(t)}>Refund</button>}</td></tr>
            ))}
          </Table>
        </Card>
      )}
      {adjusting && <AdjustModal id={id} onClose={() => setAdjusting(false)} onDone={() => { setAdjusting(false); refreshAll(); }} />}
      {payInv && <RecordPaymentModal invoice={payInv} onClose={() => setPayInv(null)} onDone={() => { setPayInv(null); reload(); }} />}
      {billing && <GenerateBillModal d={d} onClose={() => setBilling(false)} onDone={() => { setBilling(false); refreshAll(); }} />}
      {adjustInv && <AdjustBillModal invoice={adjustInv} onClose={() => setAdjustInv(null)} onDone={() => { setAdjustInv(null); refreshAll(); }} />}
      {refund && <RefundModal topup={refund} onClose={() => setRefund(null)} onDone={() => { setRefund(null); refreshAll(); }} />}
    </>
  );
}

function AdjustModal({ id, onClose, onDone }) {
  const [amount, setAmount] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);     // a double click applies once
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiAdmin.adjust(id, { amount_paise: rupeesToPaise(amount), reason, client_request_id: requestId }); toast.success('Balance adjusted'); onDone(); }
    catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="Adjust balance" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Amount (₹)" required hint="Positive adds balance; negative takes it away. Before GST." htmlFor="a-amt"><input id="a-amt" className="form-control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Reason" required htmlFor="a-reason"><input id="a-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !Number(amount) || reason.trim().length < 5}>Apply</button>
        </div>
      </form>
    </Modal>
  );
}

// "Generate bill": invoice every unpaid production call so far. The server bills calls older than two minutes; a call still settling goes on the next bill.
function GenerateBillModal({ d, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const u = d.unbilled_usage;
  const gst = Math.round(u.taxable_inr * 100 * 0.18) / 100;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await esrApiAdmin.generateUnbilledInvoice(d.client.id);
      if (r.status === 'CREATED') { toast.success(`Bill ${r.invoice.invoice_number} created for ${inr(Number(r.invoice.total_paise) / 100)}. The client was e-mailed and can pay it from their dashboard.`, { duration: 7000 }); onDone(); }
      else { toast('Nothing to bill yet. Calls from the last couple of minutes are billed next time.'); onClose(); }
    } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="Generate bill" onClose={onClose}>
      <p style={{ marginTop: 0, fontSize: 13 }}>This creates one GST invoice for every production call that has not been billed yet, <strong>up to now</strong>.</p>
      {u.calls > 0 ? (
        <dl style={{ margin: '0 0 12px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13 }}>
          <dt style={{ color: 'var(--text-tertiary)' }}>Unbilled calls</dt><dd style={{ margin: 0 }}>{num(u.calls)}</dd>
          <dt style={{ color: 'var(--text-tertiary)' }}>Amount before GST</dt><dd style={{ margin: 0 }}>{inr(u.taxable_inr)}</dd>
          <dt style={{ color: 'var(--text-tertiary)' }}>GST (18%)</dt><dd style={{ margin: 0 }}>{inr(gst)}</dd>
          <dt style={{ color: 'var(--text-tertiary)' }}>Client will pay</dt><dd style={{ margin: 0 }}><strong>{inr(u.taxable_inr + gst)}</strong></dd>
        </dl>
      ) : <Notice tone="info">There are no unbilled calls right now.</Notice>}
      <Notice tone="info">The invoice is e-mailed to the client and appears on their Billing page with a Pay button. Its due date follows this client's payment terms. You can adjust the amount afterwards, while it is unpaid.</Notice>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || u.calls === 0} data-testid="confirm-generate-bill">{busy ? 'Creating…' : 'Create and send bill'}</button>
      </div>
    </Modal>
  );
}

// "Adjust bill": change what the client pays on an UNPAID invoice. The amount is before GST (negative reduces, positive adds); GST is worked out again on the server.
function AdjustBillModal({ invoice, onClose, onDone }) {
  const [amount, setAmount] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const calls = Number(invoice.calls_taxable_paise); const already = Number(invoice.adjustment_paise);
  const delta = Math.round(Number(amount) * 100);
  const valid = Number.isFinite(delta) && delta !== 0 && Math.abs(delta) <= 100000000;
  const newTaxable = calls + already + (valid ? delta : 0);
  const newGst = Math.round(newTaxable * 0.18);
  const tooLow = valid && newTaxable < 100;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await esrApiAdmin.adjustInvoice(invoice.id, { amount_paise: delta, reason });
      toast.success(`Invoice ${invoice.invoice_number} revised. The client was e-mailed the new amount.`, { duration: 6000 }); onDone();
    } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Adjust bill ${invoice.invoice_number}`} onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <dl style={{ margin: '0 0 12px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13 }}>
          <dt style={{ color: 'var(--text-tertiary)' }}>Calls come to</dt><dd style={{ margin: 0 }}>{inr(calls / 100)} before GST</dd>
          <dt style={{ color: 'var(--text-tertiary)' }}>Adjusted so far</dt><dd style={{ margin: 0 }}>{inr(already / 100)}</dd>
          <dt style={{ color: 'var(--text-tertiary)' }}>Client currently pays</dt><dd style={{ margin: 0 }}>{inr(Number(invoice.total_paise) / 100)} incl. GST</dd>
        </dl>
        <Field label="Adjustment before GST (₹)" required hint="Negative reduces the bill (e.g. -250 for a discount); positive adds to it." htmlFor="ab-amt">
          <input id="ab-amt" className="form-control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="-250" />
        </Field>
        {valid && (
          <Notice tone={tooLow ? 'error' : 'info'} title={tooLow ? 'Too much to take off' : 'New bill'}>
            {tooLow ? 'The invoice must stay at least ₹1.00 before GST.' : <>Before GST <strong>{inr(newTaxable / 100)}</strong> + GST {inr(newGst / 100)} = client pays <strong>{inr((newTaxable + newGst) / 100)}</strong>.</>}
          </Notice>
        )}
        <Field label="Reason" required hint="The client is e-mailed this reason with the revised invoice." htmlFor="ab-reason">
          <input id="ab-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
        <Notice tone="warning">The client's revised invoice replaces the earlier one and is e-mailed to them. If they have already started a payment, this is refused. Only unpaid invoices can be adjusted.</Notice>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !valid || tooLow || reason.trim().length < 5} data-testid="confirm-adjust-bill">Revise and send</button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ invoice, onClose, onDone }) {
  const [reference, setReference] = useState(''); const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiAdmin.recordPayment(invoice.id, { reference, amount_paise: invoice.total_paise, paid_at: paidAt }); toast.success('Payment recorded'); onDone(); }
    catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Record bank transfer for ${invoice.invoice_number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0, fontSize: 13 }}>The full amount, <strong>{inr(invoice.total_paise / 100)}</strong>, is recorded as received.</p>
        <Field label="Bank reference (UTR)" required htmlFor="rp-ref"><input id="rp-ref" className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} autoFocus /></Field>
        <Field label="Date received" htmlFor="rp-date"><input id="rp-date" type="date" className="form-control" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || reference.trim().length < 3}>Record payment</button>
        </div>
      </form>
    </Modal>
  );
}

// Refund of an API top-up through the same refund pipeline as every other payment; the server enforces "unspent balance only".
function RefundModal({ topup, onClose, onDone }) {
  const [mode, setMode] = useState('FULL'); const [amount, setAmount] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => `api-refund-${topup.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const preview = useAsync(() => esrApiAdmin.refundPreview(topup.id, mode === 'FULL' ? { full: true } : { amount_inr: Number(amount) || undefined }), [mode, amount]);
  const p = preview.data;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiAdmin.refund({ id: topup.id, mode, ...(mode === 'PARTIAL' ? { amount_inr: Number(amount) } : {}), reason, idempotency_key: key }); toast.success('Refund submitted to Razorpay'); onDone(); }
    catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  const blocked = p && (p.blocked_reason || !p.eligible);
  return (
    <Modal title="Refund unspent balance" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0, fontSize: 13 }}>Top-up of <strong>{inr(topup.total_paise / 100)}</strong> ({inr(topup.taxable_paise / 100)} + GST). The money goes back to the client's original payment method and a credit note is issued.</p>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
          <label><input type="radio" checked={mode === 'FULL'} onChange={() => setMode('FULL')} /> Everything still refundable</label>
          <label><input type="radio" checked={mode === 'PARTIAL'} onChange={() => setMode('PARTIAL')} /> A part</label>
        </div>
        {mode === 'PARTIAL' && <Field label="Amount to refund (₹, GST included)" htmlFor="rf-amt"><input id="rf-amt" className="form-control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
        {p && p.api_balance_paise !== undefined && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Unspent balance: {inr(Number(p.api_balance_paise) / 100)}. Most that can be refunded now: {inr(p.api_max_refundable_paise / 100)} (GST included).</p>}
        {p && p.plan && !blocked && <Notice tone="info">Refund {inr(p.plan.refund_paise / 100)}: {inr(p.plan.taxable_paise / 100)} leaves the balance, {inr(p.plan.gst_paise / 100)} GST reversed.</Notice>}
        {blocked && <Notice tone="warning">{p.blocked_message || p.ineligible_reason}</Notice>}
        {p?.funding?.message && <Notice tone="warning">{p.funding.message}</Notice>}
        <Field label="Reason" required htmlFor="rf-reason"><input id="rf-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger btn-sm" disabled={busy || !p || blocked || reason.trim().length < 5 || (mode === 'PARTIAL' && !(Number(amount) > 0))}>Refund</button>
        </div>
      </form>
    </Modal>
  );
}
