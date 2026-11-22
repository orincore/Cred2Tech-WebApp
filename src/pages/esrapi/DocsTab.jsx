import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Bot, Download } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CopyButton from '../../components/ui/CopyButton';
import { esrApiPortal, apiError, saveBlob } from '../../api/esrApiService';
import { Card, Pill } from '../whitelabel/atoms';
import { Notice, Table, td, useAsync } from './common';
import { buildAgentPrompt, copyText } from './agentPrompt';

// The API reference. Everything here comes from ONE server document (OpenAPI generated from the validation schemas, sample requests, error catalogue),
// so it cannot disagree with the API. Code samples are built from the real base URL and a real sample request.

const METHOD_TONE = { get: 'info', post: 'success' };

const codeSamples = (base, sample) => {
  const body = JSON.stringify({ ...sample.request, as_of: undefined }, null, 2);
  const compact = JSON.stringify(sample.request);
  return {
    curl: `curl -X POST '${base}/eligibility' \\\n  -H 'X-API-Key: YOUR_API_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Idempotency-Key: '"$(uuidgen)" \\\n  -d @request.json\n\n# request.json: see "Sample requests" below`,
    node: `// Node 18+\nconst res = await fetch('${base}/eligibility', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': process.env.C2T_API_KEY,\n    'Content-Type': 'application/json',\n    'Idempotency-Key': crypto.randomUUID(), // reuse the SAME key when you retry this call\n  },\n  body: JSON.stringify(request),\n});\nconst result = await res.json();\nif (!res.ok) throw new Error(result.error.code + ': ' + result.error.message);\nconsole.log(result.summary);`,
    python: `import os, uuid, requests\n\nres = requests.post(\n    "${base}/eligibility",\n    headers={\n        "X-API-Key": os.environ["C2T_API_KEY"],\n        "Idempotency-Key": str(uuid.uuid4()),  # reuse the SAME key when you retry this call\n    },\n    json=request,\n    timeout=120,\n)\nresult = res.json()\nres.raise_for_status()\nprint(result["summary"])`,
    _sampleBody: body, _compact: compact,
  };
};

const Code = ({ text }) => (
  <div style={{ position: 'relative' }}>
    <pre style={{ margin: 0, padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 12, overflow: 'auto', maxHeight: 360, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</pre>
    <div style={{ position: 'absolute', top: 6, right: 6 }}><CopyButton text={text} label="Copied" size={14} /></div>
  </div>
);

export default function DocsTab() {
  const docs = useAsync(() => esrApiPortal.docs(), []);
  const [lang, setLang] = useState('curl');
  const [sampleId, setSampleId] = useState(null);
  const d = docs.data;
  const sample = useMemo(() => (d ? d.samples.find((s) => s.id === sampleId) || d.samples[0] : null), [d, sampleId]);

  if (docs.loading) return <LoadingSpinner />;
  if (docs.error) return <Notice tone="error">{apiError(docs.error, 'Could not load the documentation')}</Notice>;
  const code = codeSamples(d.api_base, sample);
  const download = async () => { try { saveBlob(await esrApiPortal.postman(), 'cred2tech-esr-api.postman_collection.json'); } catch (err) { toast.error(apiError(err)); } };
  const downloadSpec = () => saveBlob(new Blob([JSON.stringify(d.openapi, null, 2)], { type: 'application/json' }), 'cred2tech-esr-api.openapi.json');
  const copyPrompt = async () => {
    if (await copyText(buildAgentPrompt(d))) toast.success('Prompt copied. Paste it into your AI coding agent (Claude Code, Cursor, Copilot…).', { duration: 6000 });
    else toast.error('Could not copy. Your browser blocked clipboard access.');
  };
  const reqSchema = d.openapi.components.schemas.EligibilityRequest;

  return (
    <>
      <Notice tone="info" title="Set this up with an AI coding agent">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 320px' }}>Copy a ready-made prompt that tells your AI agent (Claude Code, Cursor, Copilot, ChatGPT…) exactly how to integrate this API into your project: authentication, retries, idempotency, error handling and tests. It never contains your key.</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={copyPrompt} data-testid="copy-agent-prompt"><Bot size={14} /> Copy AI setup prompt</button>
        </div>
      </Notice>
      <Card title="Cred2Tech ESR API" subtitle={`Version ${d.openapi.info.version}`}
        actions={<><button type="button" className="btn btn-secondary btn-sm" onClick={downloadSpec}><Download size={14} /> OpenAPI JSON</button><button type="button" className="btn btn-secondary btn-sm" onClick={download}><Download size={14} /> Postman collection</button></>}>
        {d.openapi.info.description.split('\n').filter(Boolean).map((p) => (
          <p key={p} style={{ margin: '0 0 8px', fontSize: 13 }}>{p.split('`').map((part, i) => (i % 2 ? <code key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 5px', fontSize: 12 }}>{part}</code> : part))}</p>
        ))}
        <p style={{ margin: '10px 0 4px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Base URL</p>
        <Code text={d.api_base} />
      </Card>

      <div style={{ height: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {d.guide.map((g) => (
          <Card key={g.id} title={g.title}><p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{g.body.split('`').map((part, i) => (i % 2 ? <code key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 5px', fontSize: 12 }}>{part}</code> : part))}</p></Card>
        ))}
      </div>

      <div style={{ height: 16 }} />
      <Card title="Endpoints">
        <Table head={['', 'Path', 'What it does']}>
          {Object.entries(d.openapi.paths).flatMap(([p, methods]) => Object.entries(methods).map(([m, op]) => (
            <tr key={`${m}${p}`}><td style={td}><Pill tone={METHOD_TONE[m] || 'neutral'}>{m.toUpperCase()}</Pill></td><td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{p}</td><td style={td}>{op.summary || op.description}</td></tr>
          )))}
        </Table>
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Make your first call" actions={<div style={{ display: 'flex', gap: 6 }}>{['curl', 'node', 'python'].map((l) => <button key={l} type="button" className={`btn btn-sm ${lang === l ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang(l)}>{l === 'node' ? 'Node.js' : l === 'curl' ? 'cURL' : 'Python'}</button>)}</div>}>
        <Code text={code[lang]} />
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Sample requests" subtitle="Each is a complete request the API accepts. Try one in the Playground.">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {d.samples.map((s) => <button key={s.id} type="button" className={`btn btn-sm ${sample.id === s.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSampleId(s.id)}>{s.title.split(',')[0]}</button>)}
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13 }}>{sample.title}</p>
        <Code text={code._sampleBody} />
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Request fields" subtitle="Generated from the same schema the API validates against. We assess two products only: Home Loan (HL) and Loan Against Property (LAP).">
        <Table head={['Field', 'Type', 'Required']}>
          {Object.entries(reqSchema.properties || {}).map(([k, v]) => (
            <tr key={k}><td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{k}</td><td style={td}>{v.enum ? v.enum.map((x) => `"${x}"`).join(' | ') : Array.isArray(v.type) ? v.type.join(' | ') : v.type || 'object'}{v.description ? <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{v.description}</div> : null}</td><td style={td}>{(reqSchema.required || []).includes(k) ? 'Yes' : 'No'}</td></tr>
          ))}
        </Table>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>The full schema, including every nested field, is in the Postman collection and at <code>GET /v1/schema</code>.</p>
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Errors" subtitle="Every error has the shape { error: { code, message, request_id, fields? } }. Quote the request_id when you contact us.">
        <Table head={['HTTP', 'Code', 'Meaning', 'Retry the same request?']}>
          {d.errors.map((e) => <tr key={e.code}><td style={td}>{e.status}</td><td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{e.code}</td><td style={td}>{e.meaning}</td><td style={td}>{e.retry ? 'Yes, after fixing the cause or waiting' : 'No'}</td></tr>)}
        </Table>
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Changelog">
        {d.changelog.map((c) => (
          <div key={c.version} style={{ marginBottom: 8 }}><strong>{c.version}</strong> <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{c.date}</span><ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>{c.notes.map((n) => <li key={n}>{n}</li>)}</ul></div>
        ))}
      </Card>
    </>
  );
}
