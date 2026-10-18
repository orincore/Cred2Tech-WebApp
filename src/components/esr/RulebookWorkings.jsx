import React, { useMemo, useState } from 'react';
import { methodLabel } from '../../utils/methodLabel';
import { Calculator, ChevronUp, ChevronDown, CheckCircle2, XCircle, IndianRupee, TrendingUp, Clock, TrendingDown, Home, Percent } from 'lucide-react';
import { IS_DEV_BUILD } from '../../utils/devBuild';

const money = value => value == null ? '—' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const percent = value => value == null ? '—' : `${(Number(value) * 100).toFixed(2)}%`;
const readable = value => {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (Array.isArray(value)) return value.map(readable).join('; ');
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${readable(v)}`).join('; ');
  return String(value);
};

function Messages({ messages, label, severity = 'info' }) {
  if (!messages?.length) return null;
  const color = severity === 'error' ? 'var(--error)' : severity === 'warning' ? 'var(--warning)' : 'var(--text-secondary)';
  const icon = severity === 'error' ? '✕' : severity === 'warning' ? '⚠' : '•';
  return <div style={{ marginTop: 10 }}>
    {label && <strong style={{ fontSize: 12 }}>{label}</strong>}
    <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0', fontSize: 12, lineHeight: 1.6 }}>
      {messages.filter(Boolean).map((m, i) => <li key={`${m.code || ''}-${i}`} style={{ color, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span aria-hidden="true" style={{ flexShrink: 0 }}>{icon}</span>
        <div><span>{typeof m === 'string' ? m : m.message}</span>
          {m.affects?.length > 0 && <div style={{ color: 'var(--text-tertiary)' }}>Applies to: {m.affects.join(', ')}</div>}
        </div>
      </li>)}
    </ul>
  </div>;
}

function Trace({ trace }) {
  return <ol style={{ paddingLeft: 22, fontSize: 12, lineHeight: 1.6 }}>
    {(trace || []).map((step, i) => <li key={i} style={{ marginBottom: 10 }}>
      <strong>{step.step}</strong>
      {step.formula && <div>{step.formula}</div>}
      {step.values && <div style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{readable(step.values)}</div>}
      {step.result != null && <div>Result: <strong>{readable(step.result)}</strong></div>}
      {step.note && <div style={{ color: 'var(--text-secondary)' }}>{step.note}</div>}
    </li>)}
  </ol>;
}

function Metrics({ result }) {
  const fields = [
    ['Final eligible amount', result.eligible ? money(result.amount) : 'Not eligible'],
    ...(!result.eligible && result.amount > 0 ? [['Indicative amount only', money(result.amount)]] : []),
    ['Income-based amount', money(result.income_based)], ['Monthly EMI capacity', money(result.emi)],
    ['ROI', result.roi == null ? '—' : `${result.roi}%`], ['Tenure', result.tenure_months == null ? '—' : `${result.tenure_months} months`],
    ['FOIR', percent(result.foir)], ['LTV', percent(result.ltv)], ['Limiting factor', readable(result.binding_cap)]
  ];
  return <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '12px 0' }}>
    {fields.map(([label, value]) => <div key={label}><dt style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{value}</dd></div>)}
  </dl>;
}

export function RulebookDiagnostics({ report }) {
  const output = report?.raw_payload?.engine_result;
  if (!output) return report ? <div className="card" style={{ padding: 16, marginBottom: 20 }}>
    This saved report uses the previous calculation engine. Click Refresh Results to calculate with the new eligibility engine.
  </div> : null;
  return <section aria-label="Eligibility assessment details" className="card" style={{ padding: 16, marginBottom: 20 }}>
    <strong>Eligibility assessment · ESR v{report.version_number}</strong>
    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Assessed {output.as_of} · Engine {output.engine_version}</div>
    {output.summary && <div style={{ marginTop: 10, fontSize: 13 }}>
      <strong>{output.summary.eligible_lenders} eligible lenders</strong>
      {output.summary.best_offer && <div style={{ marginTop: 4 }}>
        Best offer: {money(output.summary.best_offer.amount)} · {output.summary.best_offer.lender}
        {' · '}{methodLabel(output.lenders?.find(l => l.lender === output.summary.best_offer.lender)
          ?.schemes?.find(s => s.scheme === output.summary.best_offer.scheme)?.label || output.summary.best_offer.scheme)}
      </div>}
    </div>}
    {output.partial && <p role="alert">Some configurations could not be evaluated. Review the errors below.</p>}
    {output.provisional && <p role="alert">Provisional results: verify estimated or missing loan EMIs before treating these amounts as final.</p>}
    <Messages label="Inputs to complete" severity="warning" messages={[...(output.input_issues || []), ...(output.data_gaps || [])]} />
    <Messages label="Source notes" messages={output.adapter_notes} />
    <Messages label="Rulebook errors" severity="error" messages={output.invalid_rulebooks?.map(r => ({ message: `${r.lender || r.file}: ${r.errors.join('; ')}` }))} />
    <Messages label="Rulebook warnings" severity="warning" messages={output.rulebook_warnings} />
    <Messages label="Unavailable lenders / products" messages={output.not_offered?.map(r => ({ message: `${r.lender}: ${r.reason}` }))} />
  </section>;
}

export default function RulebookWorkings({ lender, initiallyOpen = false, initialScheme = null }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [selected, setSelected] = useState(initialScheme);
  const schemes = useMemo(() => [...(lender.schemes || [])].sort((a, b) =>
    Number(b.scheme === lender.best_scheme) - Number(a.scheme === lender.best_scheme)
    || Number(b.eligible) - Number(a.eligible) || b.amount - a.amount), [lender]);
  const s = schemes.find(item => item.scheme === selected) || schemes[0];
  if (!s) return null;
  const compactMoney = value => value == null ? '—' : Number(value) >= 10000000
    ? `₹${(Number(value) / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}Cr`
    : Number(value) >= 100000 ? `₹${(Number(value) / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L` : money(value);
  const rate = s.roi_range || [s.roi, s.roi];
  const tiles = [
    { label: 'Loan Amount', value: compactMoney(s.eligible ? s.amount : 0), Icon: IndianRupee, color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'ROI', value: rate[0] == null ? '—' : `${rate[0]}%${rate[1] != null && rate[1] !== rate[0] ? `–${rate[1]}%` : ''}`, Icon: TrendingUp, color: 'var(--info)', bg: 'var(--info-bg)' },
    { label: 'Tenure', value: s.tenure_months == null ? '—' : `${Number((s.tenure_months / 12).toFixed(1))} Years`, Icon: Clock, color: 'var(--role-cred2tech)', bg: 'var(--role-cred2tech-bg)' },
    { label: 'FOIR', value: s.foir == null ? '—' : `${(s.foir * 100).toFixed(1)}%`, Icon: TrendingDown, color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'LTV', value: s.ltv == null ? '—' : `${(s.ltv * 100).toFixed(0)}%`, Icon: Home, color: 'var(--role-admin)', bg: 'var(--role-admin-bg)' },
    { label: 'PF', value: s.pf_min == null && s.pf_max == null ? '—' : `${percent(s.pf_min)}–${percent(s.pf_max)}`, Icon: Percent, color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ];
  return <div style={{ marginTop: 12 }}>
    <button className="btn btn-secondary btn-sm" onClick={() => setOpen(value => !value)} aria-expanded={open}
      style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 0 }}>
      <Calculator size={12} />{open ? 'Hide Calculation' : 'View Calculation'}{open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
    {open && <div style={{ marginTop: 10, border: '1px solid var(--border)' }}>
      <div className="scheme-tabs" role="tablist" aria-label="Lender schemes" style={{ display: 'flex', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {schemes.map(item => <button key={item.scheme} role="tab" aria-selected={item.scheme === s.scheme} onClick={() => setSelected(item.scheme)}
          style={{ flex: '0 0 auto', padding: '8px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            whiteSpace: 'nowrap', background: item.scheme === s.scheme ? 'var(--primary)' : 'transparent', color: item.scheme === s.scheme ? '#fff' : 'var(--text-secondary)' }}>
          {methodLabel(item.label)}{item.eligible ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        </button>)}
      </div>
      <div role="tabpanel" aria-label={methodLabel(s.label)} style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 6 }}>
          {tiles.map(({ label, value, Icon, color, bg }) => <div key={label} style={{ background: bg, padding: '7px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 3, textTransform: 'uppercase' }}><Icon size={10} />{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
          </div>)}
        </div>
        {!s.eligible && s.reasons?.length > 0 && <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--error-bg)', border: '1px solid var(--error)' }}>
          <Messages label="Why this scheme is not eligible" severity="error" messages={s.reasons} />
        </div>}
        <Messages label="Warnings" severity="warning" messages={s.warnings} />
        {IS_DEV_BUILD && <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, padding: '6px 0' }}>Detailed calculation workings</summary>
          <Metrics result={s} />
          {s.scenario && <div style={{ fontSize: 12 }}>Selected: {s.scenario}</div>}
          <Trace trace={s.trace} />
          {(s.scenario_details || []).map((scenario, index) => <details key={index} style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12 }}>{scenario.scenario}{scenario.chosen ? ' · Selected' : ''} · {scenario.eligible ? money(scenario.amount) : 'Not eligible'}</summary>
            <Metrics result={scenario} /><Messages label="Reasons" severity="error" messages={scenario.reasons} /><Messages label="Warnings" severity="warning" messages={scenario.warnings} /><Trace trace={scenario.trace} />
          </details>)}
        </details>}
      </div>
    </div>}
  </div>;
}
