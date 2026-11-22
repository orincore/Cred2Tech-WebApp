import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Play } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { esrApiPortal, apiError } from '../../api/esrApiService';
import { Card, Field, Pill } from '../whitelabel/atoms';
import { Notice, Table, inr, td, useAsync } from './common';

// The only two products the API assesses (the request schema's `product` enum).
const PRODUCTS = [{ id: 'HL', label: 'Home Loan (HL)' }, { id: 'LAP', label: 'Loan Against Property (LAP)' }];
const newKey = () => `playground-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const STATUS_TONE = { eligible: 'success', not_eligible: 'error', ineligible: 'error', partial: 'warning' };

// Try the API from the dashboard. It runs the request through the real pipeline (same checks, engine, billing and call log as a key would),
// using your signed-in session instead of a key. Test calls use your free test credits; production calls are billed and must be confirmed.
export default function PlaygroundTab({ flag }) {
  const docs = useAsync(() => esrApiPortal.docs(), []);
  const [environment, setEnvironment] = useState(flag('playground.uat') ? 'UAT' : 'PRODUCTION');
  const [sampleId, setSampleId] = useState('');
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [idemKey, setIdemKey] = useState(newKey);        // stable until the request changes, so a double click can never be charged twice
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);

  useEffect(() => {
    if (docs.data && !sampleId) { const s = docs.data.samples[0]; setSampleId(s.id); setText(JSON.stringify(s.request, null, 2)); }
  }, [docs.data, sampleId]);

  const parsed = useMemo(() => { try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? { ok: true, value: v } : { ok: false, error: 'The request must be a JSON object.' }; } catch (e) { return { ok: false, error: e.message }; } }, [text]);

  if (docs.loading) return <LoadingSpinner />;
  if (docs.error) return <Notice tone="error">{apiError(docs.error)}</Notice>;
  const canUat = flag('playground.uat'); const canProd = flag('playground.production');
  if (!canUat && !canProd) {
    return <Notice tone="info" title="The Playground is not available">{flag('account.read_only') ? 'Only an administrator of your account can run calls.' : 'Your test credits may be used up, or your account may not be active. See Overview.'}</Notice>;
  }

  const pick = (id) => { const s = docs.data.samples.find((x) => x.id === id); setSampleId(id); setText(JSON.stringify(s.request, null, 2)); setIdemKey(newKey()); setOut(null); };
  const run = async () => {
    setBusy(true); setOut(null);
    try {
      const body = { environment, payload: parsed.value, ...(environment === 'PRODUCTION' ? { confirm_charge: true, idempotency_key: idemKey } : {}) };
      const r = await esrApiPortal.runPlayground(body);
      setOut({ ok: true, status: r.status, data: r.data, replayed: r.headers['idempotent-replayed'] === 'true', charged: r.headers['x-credits-charged'] });
      if (environment === 'PRODUCTION') setIdemKey(newKey());
    } catch (err) {
      const d = err?.response?.data;
      setOut({ ok: false, status: err?.response?.status, data: d && d.error && typeof d.error === 'object' ? d : { error: { code: d?.code || 'error', message: d?.error || err.message } } });
    } finally { setBusy(false); }
  };

  const result = out && out.ok ? out.data : null;
  return (
    <>
      <Notice tone="info">Runs through the real API pipeline using your session. {environment === 'UAT' ? 'This uses one of your free test credits.' : 'This is a PRODUCTION call: it is billed to your account.'}</Notice>
      <Card title="Request" subtitle="Edit the JSON or start from a sample. Large requests are best sent with the API directly.">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
          <Field label="Environment" htmlFor="pg-env">
            <select id="pg-env" className="form-control" value={environment} onChange={(e) => { setEnvironment(e.target.value); setConfirm(false); setOut(null); }}>
              {canUat && <option value="UAT">Test (UAT): free test credit</option>}
              {canProd && <option value="PRODUCTION">Production: billed</option>}
            </select>
          </Field>
          <Field label="Product" hint="We assess Home Loan and Loan Against Property only" htmlFor="pg-product">
            <select id="pg-product" className="form-control" value={parsed.ok && PRODUCTS.some((p) => p.id === parsed.value.product) ? parsed.value.product : ''} disabled={!parsed.ok}
              onChange={(e) => { setText(JSON.stringify({ ...parsed.value, product: e.target.value }, null, 2)); setIdemKey(newKey()); setOut(null); }}>
              {!(parsed.ok && PRODUCTS.some((p) => p.id === parsed.value.product)) && <option value="">Select a product</option>}
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Sample" htmlFor="pg-sample">
            <select id="pg-sample" className="form-control" value={sampleId} onChange={(e) => pick(e.target.value)}>{docs.data.samples.map((s) => <option key={s.id} value={s.id}>{s.title.split(',')[0]}</option>)}</select>
          </Field>
        </div>
        <textarea aria-label="Request JSON" className="form-control" value={text} onChange={(e) => { setText(e.target.value); setIdemKey(newKey()); }} spellCheck={false}
          style={{ width: '100%', minHeight: 280, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, resize: 'vertical' }} />
        {!parsed.ok && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--error)' }}>Not valid JSON: {parsed.error}</p>}
        {environment === 'PRODUCTION' && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 0', fontSize: 13 }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I understand this call will be charged to my account (GST extra), only if it succeeds.
          </label>
        )}
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy || !parsed.ok || (environment === 'PRODUCTION' && !confirm)}><Play size={14} /> {busy ? 'Running…' : 'Run'}</button>
        </div>
      </Card>

      {out && (
        <div style={{ marginTop: 16 }}>
          <Card title={out.ok ? 'Result' : 'The API refused this request'} actions={<Pill tone={out.ok ? 'success' : 'error'}>HTTP {out.status}</Pill>}>
            {out.ok ? (
              <>
                <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                  <strong>{result.summary?.eligible_lenders ?? 0}</strong> of {result.lenders.length} lenders eligible
                  {result.summary?.best_offer ? <> · best offer <strong>{inr(result.summary.best_offer.amount, 0)}</strong>{result.summary.best_offer.lender ? ` (${result.summary.best_offer.lender})` : ''}</> : null}
                  {' · '}{out.replayed ? 'replayed from an earlier identical call (not charged again)' : `charged ${inr(Number(out.charged || 0) / 100)}`} · request <code>{result.request_id}</code>
                </p>
                <Table head={['Lender', 'Product', 'Status', 'Amount', 'ROI', 'Tenure', 'EMI']}>
                  {result.lenders.map((l, i) => (
                    <tr key={`${l.lender}${l.product}${i}`}>
                      <td style={td}>{l.lender}</td><td style={td}>{l.product}</td>
                      <td style={td}><Pill tone={STATUS_TONE[l.status] || 'neutral'}>{String(l.status).replace(/_/g, ' ')}</Pill>{l.reasons?.length ? <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', maxWidth: 360 }}>{l.reasons.map((r) => r.message || r).join(' ')}</div> : null}</td>
                      <td style={td}>{l.amount ? inr(l.amount, 0) : '—'}</td><td style={td}>{l.roi_percent ? `${l.roi_percent}%` : '—'}</td><td style={td}>{l.tenure_months ? `${l.tenure_months} mo` : '—'}</td><td style={td}>{l.emi ? inr(l.emi, 0) : '—'}</td>
                    </tr>
                  ))}
                </Table>
                <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', fontSize: 13 }}>Full response JSON</summary>
                  <pre style={{ margin: '8px 0 0', padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11.5, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre></details>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 13 }}><code>{out.data.error.code}</code>: {out.data.error.message}</p>
                {out.data.error.fields?.length > 0 && (
                  <Table head={['Where', 'Problem']}>{out.data.error.fields.map((f, i) => <tr key={i}><td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{f.path}</td><td style={td}>{f.message}</td></tr>)}</Table>
                )}
                {out.data.error.request_id && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Request <code>{out.data.error.request_id}</code>. You were not charged.</p>}
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
