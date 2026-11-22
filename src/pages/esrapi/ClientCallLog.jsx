import React, { useState } from 'react';
import { FileSearch } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { esrApiAdmin, apiError } from '../../api/esrApiService';
import { Card, Pill } from '../whitelabel/atoms';
import { Modal, Notice, Pager, Stat, StatRow, Table, dt, num, td, useAsync, ENV_TONE } from './common';

const LIMIT = 25;
const ENDPOINTS = ['POST /v1/eligibility', 'POST /v1/eligibility/validate', 'GET /v1/lenders', 'GET /v1/schema', 'GET /v1/requests/:id', 'GET /v1/usage', 'GET /v1/health'];
const OUTCOME_TONE = { SUCCESS: 'success', FAILED: 'error', PENDING: 'neutral' };
const LBL = { fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 };
const MONO = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 };
const SIDE = { CLIENT: { label: 'Client side', tone: 'warning' }, PLATFORM: { label: 'Our side', tone: 'error' }, NONE: { label: 'No problem', tone: 'success' } };

// One API client's calls for Cred2Tech staff: which endpoint was hit, the outcome and the error code, and a diagnosis of why a failed call failed.
// No key, key name or key prefix is shown anywhere (owner rule); bodies are fetched on request through the audited detail.
export default function ClientCallLog({ clientId }) {
  const blank = { status: '', environment: '', endpoint: '', error_code: '', search: '', date_from: '', date_to: '' };
  const [f, setF] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);
  const params = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const logs = useAsync(() => esrApiAdmin.clientLogs(clientId, { ...params, limit: LIMIT, offset }), [clientId, JSON.stringify(applied), offset]);

  const apply = (e) => { e.preventDefault(); setOffset(0); setApplied(f); };
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const onlyError = (code) => { const next = { ...f, status: 'FAILED', error_code: code }; setF(next); setApplied(next); setOffset(0); };
  const clear = () => { setF(blank); setApplied(blank); setOffset(0); };
  const filtered = Object.keys(params).length > 0;
  const s = logs.data && logs.data.summary;

  return (
    <>
      {s && (
        <StatRow>
          <Stat label="Successful" value={num(s.success)} sub={filtered ? 'in this filter' : 'all time'} />
          <Stat label="Failed" value={num(s.failed)} tone={s.failed ? 'error' : undefined} sub={s.failed && s.success + s.failed ? `${Math.round((s.failed / (s.success + s.failed)) * 100)}% of finished calls` : undefined} />
          {s.running > 0 && <Stat label="Not finished" value={num(s.running)} />}
        </StatRow>
      )}
      {s && s.top_errors.length > 0 && (
        <Card title="Why calls fail" subtitle="The most common error codes. Click one to see only those calls.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {s.top_errors.map((e) => (
              <button key={e.error_code} type="button" className="btn btn-secondary btn-sm" onClick={() => onlyError(e.error_code)} title={e.reason || ''} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span style={MONO}>{e.error_code}</span><strong>{num(e.count)}</strong>
              </button>
            ))}
          </div>
        </Card>
      )}
      <Card title="Calls" subtitle="Every call made with this client's keys, newest first. Open a call to see why it failed.">
        <form onSubmit={apply} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <label style={LBL}>Outcome<select className="form-control" value={f.status} onChange={set('status')}><option value="">All</option><option value="SUCCESS">Successful</option><option value="FAILED">Failed</option></select></label>
          <label style={LBL}>Environment<select className="form-control" value={f.environment} onChange={set('environment')}><option value="">Both</option><option value="UAT">Test (UAT)</option><option value="PRODUCTION">Production</option></select></label>
          <label style={LBL}>Endpoint<select className="form-control" value={f.endpoint} onChange={set('endpoint')}><option value="">All</option>{ENDPOINTS.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
          <label style={LBL}>Error code<input className="form-control" placeholder="e.g. ip_not_allowed" value={f.error_code} onChange={set('error_code')} style={{ width: 170 }} /></label>
          <label style={LBL}>From<input type="date" className="form-control" value={f.date_from} onChange={set('date_from')} /></label>
          <label style={LBL}>To<input type="date" className="form-control" value={f.date_to} onChange={set('date_to')} /></label>
          <label style={{ ...LBL, flex: '1 1 160px' }}>Request id, IP or idempotency key<input className="form-control" value={f.search} onChange={set('search')} /></label>
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
        </form>

        {logs.loading ? <LoadingSpinner /> : logs.error ? <Notice tone="error">{apiError(logs.error, 'Could not load calls')}</Notice> : !logs.data.logs.length ? (
          <EmptyState icon={FileSearch} title="No calls found" description={filtered ? 'No call matches these filters.' : 'This client has not made any call yet.'} />
        ) : (
          <>
            <Table head={['Time', 'Endpoint', 'Outcome', 'Error code', 'Environment', 'IP address', 'Latency', 'Request id']}>
              {logs.data.logs.map((l) => (
                <tr key={l.request_id} onClick={() => setOpen(l.request_id)} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(l.request_id); }}>
                  <td style={td}>{dt(l.received_at)}</td>
                  <td style={{ ...td, ...MONO, whiteSpace: 'nowrap' }}>{l.endpoint && l.endpoint !== 'UNKNOWN' ? l.endpoint : '—'}</td>
                  <td style={td}><Pill tone={OUTCOME_TONE[l.status]}>{l.status === 'SUCCESS' ? 'Success' : l.status === 'PENDING' ? 'Running' : `Failed ${l.status_code}`}</Pill></td>
                  <td style={td}>{l.error_code ? <><span style={MONO}>{l.error_code}</span>{l.reason && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 300 }}>{l.reason}</div>}</> : '—'}</td>
                  <td style={td}><Pill tone={ENV_TONE[l.environment]}>{l.environment || '—'}</Pill></td>
                  <td style={{ ...td, ...MONO }}>{l.ip || '—'}</td>
                  <td style={td}>{l.latency_ms != null ? `${l.latency_ms} ms` : '—'}</td>
                  <td style={{ ...td, ...MONO }}>{l.request_id}</td>
                </tr>
              ))}
            </Table>
            <Pager total={logs.data.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </Card>
      {open && <DiagnoseModal clientId={clientId} requestId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const Json = ({ value }) => (
  <pre style={{ margin: 0, padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11.5, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(value, null, 2)}</pre>
);
const Label = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '14px 0 4px' }}>{children}</div>;

// A stored body as the server decoded it: { ok, json | text } or { ok: false, reason }.
function Body({ p }) {
  if (!p) return <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Not loaded.</span>;
  if (!p.ok) return <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{p.reason === 'purged' ? 'Removed after 90 days.' : p.reason === 'not_stored' ? 'Not recorded for this call (it was refused before a body was read).' : 'Could not be read.'}</span>;
  return p.json !== undefined ? <Json value={p.json} /> : <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: 'pre-wrap' }}>{p.text}</pre>;
}

function DiagnoseModal({ clientId, requestId, onClose }) {
  const d = useAsync(() => esrApiAdmin.logDiagnosis(clientId, requestId), [clientId, requestId]);
  const [payloads, setPayloads] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = async (wantDiagnostic) => {
    setBusy(wantDiagnostic ? 'diagnostic' : 'payloads'); setErr('');
    try {
      const r = await esrApiAdmin.logPayloads(requestId, { diagnostic: wantDiagnostic });
      setPayloads({ request: r.request, response: r.response });
      if (wantDiagnostic) setDiagnostic(r.diagnostic || { ok: false, reason: 'not_stored' });
    } catch (e) { setErr(apiError(e, 'Could not load the stored copies')); }
    finally { setBusy(''); }
  };
  const x = d.data && d.data.diagnosis;
  const side = x && SIDE[x.who];

  return (
    <Modal title="Call details and diagnosis" onClose={onClose} width={760}>
      {d.loading ? <LoadingSpinner /> : d.error ? <Notice tone="error">{apiError(d.error, 'Could not load this call')}</Notice> : (
        <>
          <p style={{ margin: '0 0 6px', ...MONO }}>{d.data.request_id}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ ...MONO, fontSize: 12.5 }}>{d.data.endpoint && d.data.endpoint !== 'UNKNOWN' ? d.data.endpoint : 'Endpoint not recorded'}</strong>
            <Pill tone={ENV_TONE[d.data.environment]}>{d.data.environment || '—'}</Pill>
            <Pill tone={x.ok ? 'success' : 'error'}>{x.http}</Pill>
            {side && <Pill tone={side.tone}>{side.label}</Pill>}
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{dt(d.data.received_at)}</span>
          </div>

          <Notice tone={x.ok ? 'success' : x.who === 'PLATFORM' ? 'error' : 'warning'} title={x.title}>{x.cause}</Notice>
          {x.checks.length > 0 && (
            <>
              <Label>What to check</Label>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.6, listStyle: 'disc' }}>{x.checks.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
          <Label>What we know (the account as it is now)</Label>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(150px, auto) 1fr', gap: '6px 16px', fontSize: 12.5 }}>
            {x.facts.map((fa) => <React.Fragment key={fa.label}><dt style={{ color: 'var(--text-tertiary)' }}>{fa.label}</dt><dd style={{ margin: 0, wordBreak: 'break-word' }}>{fa.value}</dd></React.Fragment>)}
          </dl>

          <Label>Request and response</Label>
          {!payloads ? (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>The stored copies contain the applicant data the client sent. Viewing them is written to the audit log.</p>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => load(false)}>{busy === 'payloads' ? 'Loading…' : 'Show request and response'}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Request</div><Body p={payloads.request} />
              <div style={{ fontSize: 11.5, fontWeight: 700, margin: '10px 0 4px' }}>Response (what the client was sent)</div><Body p={payloads.response} />
            </>
          )}
          {!x.ok && x.who === 'PLATFORM' && (
            <>
              <Label>Engine diagnostic</Label>
              {!diagnostic ? (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>The engine's own copy of the input and output. It is the most sensitive record we keep; opening it is written to the audit log.</p>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => load(true)}>{busy === 'diagnostic' ? 'Loading…' : 'Load engine diagnostic'}</button>
                </>
              ) : <Body p={diagnostic} />}
            </>
          )}
          {err && <div style={{ marginTop: 10 }}><Notice tone="error">{err}</Notice></div>}
        </>
      )}
    </Modal>
  );
}
