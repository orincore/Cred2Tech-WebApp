import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Download, Plug, Plus } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { esrApiAdmin, apiError, saveBlob } from '../../api/esrApiService';
import { Card, Field, PageFrame, Pill } from '../whitelabel/atoms';
import { INDIAN_STATES } from '../whitelabel/OrgDetailsForm';
import CustomSelect from '../../components/CustomSelect';
import { Modal, Notice, Pager, Sharp, Stat, StatRow, Table, dt, inr, num, td, useAsync, STATUS_TONE } from './common';
import { PricingPanel } from './AdminEsrApiClientPage';

const TABS = [{ id: 'clients', label: 'Clients' }, { id: 'pricing', label: 'Pricing' }, { id: 'invoices', label: 'Invoices' }, { id: 'topups', label: 'Top-ups' }];
const LIMIT = 25;

// Super Admin console for the ESR Public API: clients, prices, invoices and top-ups across every API client.
export default function AdminEsrApiPage() {
  const [tab, setTab] = useState('clients');
  return (
    <PageFrame icon={Plug} title="ESR API" subtitle="API clients, prices, invoices and top-ups" tabs={TABS} tab={tab} onTab={setTab}>
      <Sharp>
        {tab === 'clients' && <ClientsPanel />}
        {tab === 'pricing' && <PricingPanel clientId={null} />}
        {tab === 'invoices' && <InvoicesPanel />}
        {tab === 'topups' && <TopupsPanel />}
      </Sharp>
    </PageFrame>
  );
}

function ClientsPanel() {
  const navigate = useNavigate();
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [mode, setMode] = useState(''); const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const overview = useAsync(() => esrApiAdmin.overview(), []);
  const list = useAsync(() => esrApiAdmin.clients({ q: q || undefined, status: status || undefined, billing_mode: mode || undefined, limit: LIMIT, offset }), [q, status, mode, offset]);

  const o = overview.data;
  return (
    <>
      {o && (
        <>
          <StatRow>
            <Stat label="Clients" value={num(Object.values(o.clients.by_status).reduce((a, b) => a + b, 0))} sub={Object.entries(o.clients.by_status).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')} />
            <Stat label="Prepaid balances held" value={inr(o.money.prepaid_float_inr)} sub="Money owed back to clients" />
            <Stat label="Postpaid owed" value={inr(o.money.postpaid_owed_inr)} sub={`${num(o.money.postpaid_accounts_owing)} account(s) · ${inr(o.money.unbilled_postpaid_usage_inr)} not yet invoiced`} />
            <Stat label="Unpaid invoices" value={inr(o.money.unpaid_invoices_total_inr)} sub={`${num(o.money.unpaid_invoices)} invoice(s), ${num(o.money.overdue_invoices)} overdue`} tone={o.money.overdue_invoices ? 'error' : undefined} />
            <Stat label="Production calls this month" value={num(o.this_month.production_calls)} sub={`${inr(o.this_month.production_charged_inr)} charged · ${num(o.this_month.uat_calls)} test calls`} />
          </StatRow>
          {o.needs_attention.production_clients_without_a_price.length > 0 && (
            <Notice tone="warning" title="Production clients with no price">
              Their calls are currently free: {o.needs_attention.production_clients_without_a_price.map((c) => c.organisation).join(', ')}. Set a price on the Pricing tab{o.needs_attention.platform_default_price_set ? '' : ' (or a platform default)'}.
            </Notice>
          )}
        </>
      )}
      <Card title="API clients" actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={14} /> New client</button>}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="form-control" style={{ flex: '1 1 200px' }} placeholder="Search name or e-mail" value={q} onChange={(e) => { setOffset(0); setQ(e.target.value); }} aria-label="Search" />
          <select className="form-control" style={{ width: 'auto' }} value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }} aria-label="Status"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option><option value="CLOSED">Closed</option></select>
          <select className="form-control" style={{ width: 'auto' }} value={mode} onChange={(e) => { setOffset(0); setMode(e.target.value); }} aria-label="Billing"><option value="">Any plan</option><option value="PREPAID">Prepaid</option><option value="POSTPAID">Postpaid</option></select>
        </div>
        {list.loading ? <LoadingSpinner /> : list.error ? <Notice tone="error">{apiError(list.error)}</Notice> : !list.data.clients.length ? (
          <EmptyState icon={Plug} title="No API clients" description="Create the first client to give an organisation API access." />
        ) : (
          <>
            <Table head={['Organisation', 'Status', 'Plan', 'Balance / credit', 'Calls this month', 'Charged']}>
              {list.data.clients.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/admin/esr-api/${c.id}`)} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/admin/esr-api/${c.id}`); }}>
                  <td style={td}><strong>{c.organisation}</strong><div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.email}</div></td>
                  <td style={td}><Pill tone={STATUS_TONE[c.status] || 'neutral'}>{c.status}</Pill></td>
                  <td style={td}>{c.billing_mode === 'PREPAID' ? 'Prepaid' : 'Postpaid'}</td>
                  <td style={td}>{c.billing_mode === 'PREPAID' ? inr(c.balance_inr) : `${inr(Math.max(0, -c.balance_inr))} of ${inr(c.credit_limit_inr)} used`}</td>
                  <td style={td}>{num(c.prod_calls_mtd)} <span style={{ color: 'var(--text-tertiary)' }}>(+{num(c.uat_calls_mtd)} test)</span></td>
                  <td style={td}>{inr(c.prod_charged_mtd_inr)}</td>
                </tr>
              ))}
            </Table>
            <Pager total={list.data.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
      {creating && <NewClientModal onClose={() => setCreating(false)} onCreated={(r) => { setCreating(false); toast.success('Client created. Their first administrator was e-mailed a link to set a password.'); navigate(`/admin/esr-api/${r.client.id}`); }} />}
    </>
  );
}

function NewClientModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name: '', email: '', mobile: '', gst_number: '', state: '', city: '', pincode: '', address_line: '', admin_name: '', admin_email: '', admin_mobile: '', billing_mode: 'PREPAID', credit_limit_inr: '', uat_credits_total: '50', prod_enabled: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (!f.state) { toast.error('Select the state.'); setBusy(false); return; }
      const body = { name: f.name, email: f.email, mobile: f.mobile, gst_number: f.gst_number || undefined, state: f.state, city: f.city, pincode: f.pincode, address_line: f.address_line, admin_name: f.admin_name, admin_email: f.admin_email, admin_mobile: f.admin_mobile, billing_mode: f.billing_mode, uat_credits_total: Number(f.uat_credits_total) || 0, prod_enabled: f.prod_enabled };
      if (f.billing_mode === 'POSTPAID') body.credit_limit_paise = Math.round(Number(f.credit_limit_inr || 0) * 100);
      onCreated(await esrApiAdmin.createClient(body));
    } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="New API client" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <Field label="Organisation name" required htmlFor="nc-name"><input id="nc-name" className="form-control" value={f.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Organisation e-mail" required htmlFor="nc-email"><input id="nc-email" type="email" className="form-control" value={f.email} onChange={set('email')} required /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 14 }}>
          <Field label="Organisation phone" required hint="10-digit mobile; payment opens with it filled in" htmlFor="nc-mobile"><input id="nc-mobile" type="tel" className="form-control" value={f.mobile} onChange={set('mobile')} required /></Field>
          <Field label="GSTIN" hint="Blank = invoiced as unregistered (B2C)" htmlFor="nc-gst"><input id="nc-gst" className="form-control" value={f.gst_number} onChange={set('gst_number')} maxLength={15} style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="State" required hint="Decides CGST+SGST or IGST" htmlFor="nc-state">
            <CustomSelect id="nc-state" name="state" className="form-control" searchable searchPlaceholder="Search state" placeholder="Select a state" style={{ width: '100%' }}
              value={f.state} onChange={(e) => setF((s) => ({ ...s, state: e.target.value }))}>
              <option value="">Select a state</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </CustomSelect>
          </Field>
          <Field label="City" required htmlFor="nc-city"><input id="nc-city" className="form-control" value={f.city} onChange={set('city')} required /></Field>
          <Field label="PIN code" required htmlFor="nc-pin"><input id="nc-pin" className="form-control" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, '') }))} required /></Field>
          <Field label="Address" required htmlFor="nc-addr"><input id="nc-addr" className="form-control" value={f.address_line} onChange={set('address_line')} required minLength={5} /></Field>
          <Field label="First administrator" required htmlFor="nc-an"><input id="nc-an" className="form-control" value={f.admin_name} onChange={set('admin_name')} required /></Field>
          <Field label="Administrator e-mail" required htmlFor="nc-ae"><input id="nc-ae" type="email" className="form-control" value={f.admin_email} onChange={set('admin_email')} required /></Field>
          <Field label="Administrator mobile" required htmlFor="nc-am"><input id="nc-am" type="tel" className="form-control" value={f.admin_mobile} onChange={set('admin_mobile')} required /></Field>
          <Field label="Billing plan" htmlFor="nc-mode"><select id="nc-mode" className="form-control" value={f.billing_mode} onChange={set('billing_mode')}><option value="PREPAID">Prepaid (balance)</option><option value="POSTPAID">Postpaid (monthly invoice)</option></select></Field>
          {f.billing_mode === 'POSTPAID' && <Field label="Credit limit (₹)" htmlFor="nc-limit"><input id="nc-limit" className="form-control" inputMode="numeric" value={f.credit_limit_inr} onChange={set('credit_limit_inr')} /></Field>}
          <Field label="Free test (UAT) calls" htmlFor="nc-uat"><input id="nc-uat" className="form-control" inputMode="numeric" value={f.uat_credits_total} onChange={set('uat_credits_total')} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 14 }}><input type="checkbox" checked={f.prod_enabled} onChange={set('prod_enabled')} /> Allow production access now</label>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>The plan cannot be changed by the client later; only an administrator here can change it.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Create client</button>
        </div>
      </form>
    </Modal>
  );
}

function InvoicesPanel() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(''); const [offset, setOffset] = useState(0);
  const inv = useAsync(() => esrApiAdmin.invoices({ status: status || undefined, limit: LIMIT, offset }), [status, offset]);
  const pdf = async (i) => { try { saveBlob(await esrApiAdmin.invoicePdf(i.id), `${i.invoice_number.replace(/\//g, '-')}.pdf`); } catch (err) { toast.error(apiError(err)); } };
  return (
    <Card title="Postpaid invoices" subtitle={inv.data ? `Page total: ${inr(inv.data.totals.total_inr)} (taxable ${inr(inv.data.totals.taxable_inr)} + GST ${inr(inv.data.totals.gst_inr)})` : undefined}
      actions={<select className="form-control" style={{ width: 'auto' }} value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }} aria-label="Status"><option value="">All</option><option value="ISSUED">Unpaid</option><option value="PAID">Paid</option></select>}>
      {inv.loading ? <LoadingSpinner /> : inv.error ? <Notice tone="error">{apiError(inv.error)}</Notice> : !inv.data.invoices.length ? <EmptyState title="No invoices" description="Invoices are generated monthly for postpaid clients." /> : (
        <>
          <Table head={['Invoice', 'Client', 'Period', 'Due', 'Total', 'Status', '']}>
            {inv.data.invoices.map((i) => (
              <tr key={i.id}>
                <td style={td}>{i.invoice_number}</td>
                <td style={td}><button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/esr-api/${i.client_id}`)}>{i.organisation}</button></td>
                <td style={td}>{i.period}</td><td style={td}>{dt(i.due_date)}</td><td style={td}>{inr(i.total_inr)}</td>
                <td style={td}><Pill tone={STATUS_TONE[i.status] || 'neutral'}>{i.status === 'ISSUED' ? 'Unpaid' : i.status}</Pill></td>
                <td style={td}><button type="button" className="btn btn-ghost btn-sm" onClick={() => pdf(i)}><Download size={13} /> PDF</button></td>
              </tr>
            ))}
          </Table>
          <Pager total={inv.data.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
        </>
      )}
    </Card>
  );
}

function TopupsPanel() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('CREDITED'); const [offset, setOffset] = useState(0);
  const t = useAsync(() => esrApiAdmin.topups({ status: status || undefined, limit: LIMIT, offset }), [status, offset]);
  return (
    <Card title="Prepaid top-ups" actions={<select className="form-control" style={{ width: 'auto' }} value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }} aria-label="Status"><option value="CREDITED">Credited</option><option value="">All</option><option value="FAILED">Failed</option></select>}>
      {t.loading ? <LoadingSpinner /> : t.error ? <Notice tone="error">{apiError(t.error)}</Notice> : !t.data.topups.length ? <EmptyState title="No top-ups" description="Nothing here yet." /> : (
        <>
          <Table head={['Date', 'Client', 'Added', 'GST', 'Paid', 'Status', 'Invoice']}>
            {t.data.topups.map((x) => (
              <tr key={x.id}>
                <td style={td}>{dt(x.credited_at || x.created_at)}</td>
                <td style={td}><button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/esr-api/${x.client_id}`)}>{x.organisation}</button></td>
                <td style={td}>{inr(x.taxable_inr)}</td><td style={td}>{inr(x.gst_inr)}</td><td style={td}>{inr(x.total_inr)}</td>
                <td style={td}><Pill tone={STATUS_TONE[x.status] || 'neutral'}>{x.status}</Pill></td><td style={td}>{x.invoice_number || '—'}</td>
              </tr>
            ))}
          </Table>
          <Pager total={t.data.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
        </>
      )}
    </Card>
  );
}
