import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Download, FileSearch } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { esrApiPortal, apiError, saveBlob } from '../../api/esrApiService';
import { Card, Pill } from '../whitelabel/atoms';
import { Modal, Notice, Pager, Table, dt, inr, td, useAsync, ENV_TONE } from './common';

const LIMIT = 25;
const STATUS_TONE_LOG = { SUCCESS: 'success', FAILED: 'error', PENDING: 'neutral' };

// The client's own calls. Personal data in a body is masked by the server before it gets here; the engine's internal working is never sent.
export default function LogsTab({ flag }) {
  const [f, setF] = useState({ status: '', environment: '', search: '', date_from: '', date_to: '' });
  const [applied, setApplied] = useState(f);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);
  const params = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const logs = useAsync(() => esrApiPortal.logs({ ...params, limit: LIMIT, offset }), [JSON.stringify(applied), offset]);

  const apply = (e) => { e.preventDefault(); setOffset(0); setApplied(f); };
  const exportCsv = async () => {
    setExporting(true);
    try { saveBlob(await esrApiPortal.exportLogs(params), `esr-api-calls-${new Date().toISOString().slice(0, 10)}.csv`); }
    catch (err) { toast.error(apiError(err, 'Could not export')); }
    finally { setExporting(false); }
  };
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Card title="Call log" subtitle="Every call to your API keys, newest first. Request and response details are kept for 90 days."
      actions={flag('logs.export') && <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={exporting} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Download size={14} /> Export CSV</button>}>
      <form onSubmit={apply} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label style={{ fontSize: 11.5 }}>Outcome<select className="form-control" value={f.status} onChange={set('status')}><option value="">All</option><option value="SUCCESS">Successful</option><option value="FAILED">Failed</option></select></label>
        {flag('uat.enabled') && flag('production.enabled') && <label style={{ fontSize: 11.5 }}>Environment<select className="form-control" value={f.environment} onChange={set('environment')}><option value="">Both</option><option value="UAT">Test (UAT)</option><option value="PRODUCTION">Production</option></select></label>}
        <label style={{ fontSize: 11.5 }}>From<input type="date" className="form-control" value={f.date_from} onChange={set('date_from')} /></label>
        <label style={{ fontSize: 11.5 }}>To<input type="date" className="form-control" value={f.date_to} onChange={set('date_to')} /></label>
        <label style={{ fontSize: 11.5, flex: '1 1 180px' }}>Request id<input className="form-control" placeholder="req_…" value={f.search} onChange={set('search')} /></label>
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
      </form>

      {logs.loading ? <LoadingSpinner /> : logs.error ? <Notice tone="error">{apiError(logs.error, 'Could not load calls')}</Notice> : !logs.data.logs.length ? (
        <EmptyState icon={FileSearch} title="No calls found" description="Calls you make with your keys will appear here." />
      ) : (
        <>
          <Table head={['Time', 'Outcome', 'Environment', 'Key', 'Latency', 'Charged', 'Request id']}>
            {logs.data.logs.map((l) => (
              <tr key={l.request_id} onClick={() => setOpen(l.request_id)} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(l.request_id); }}>
                <td style={td}>{dt(l.received_at)}</td>
                <td style={td}><Pill tone={STATUS_TONE_LOG[l.status]}>{l.status === 'SUCCESS' ? 'Success' : l.status === 'PENDING' ? 'Running' : `Failed ${l.status_code}`}</Pill>{l.error_message && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', maxWidth: 320 }}>{l.error_message}</div>}</td>
                <td style={td}><Pill tone={ENV_TONE[l.environment]}>{l.environment || '—'}</Pill></td>
                <td style={td}>{l.key_name || '—'}</td>
                <td style={td}>{l.latency_ms !== null && l.latency_ms !== undefined ? `${l.latency_ms} ms` : '—'}</td>
                <td style={td}>{l.environment === 'UAT' ? 'Free' : inr(l.charged_inr)}</td>
                <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>{l.request_id}</td>
              </tr>
            ))}
          </Table>
          <Pager total={logs.data.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
        </>
      )}
      {open && <LogDetail requestId={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

const Json = ({ value }) => (
  <pre style={{ margin: 0, padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11.5, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(value, null, 2)}</pre>
);

function LogDetail({ requestId, onClose }) {
  const d = useAsync(() => esrApiPortal.log(requestId), [requestId]);
  const part = (p, label) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      {p?.available && p.truncated ? <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{p.note}</span> : p?.available ? <Json value={p.body} /> : <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{p?.reason === 'purged' ? 'Removed after 90 days.' : 'Not recorded for this call.'}</span>}
    </div>
  );
  return (
    <Modal title="Call details" onClose={onClose} width={720}>
      {d.loading ? <LoadingSpinner /> : d.error ? <Notice tone="error">{apiError(d.error, 'Could not load this call')}</Notice> : (
        <>
          <p style={{ margin: '0 0 6px', fontSize: 12.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>{d.data.request_id}</p>
          {d.data.error_message && <Notice tone="warning">{d.data.error_message}</Notice>}
          <Notice tone="info">Personal details (names, PAN, phone numbers, account numbers) are partly hidden here for your protection.</Notice>
          {part(d.data.request, 'Request')}
          {part(d.data.response, 'Response')}
          {d.data.note && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{d.data.note}</p>}
        </>
      )}
    </Modal>
  );
}
