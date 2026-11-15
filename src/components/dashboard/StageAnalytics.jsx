import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

// Stage Summary as analytics instead of a wall of bars: headline numbers, a conversion funnel and a donut of how the
// period's leads turned out. Pure SVG/HTML on theme tokens, so it follows the organisation's colour and dark mode.
//
// What the numbers are: the API returns, for each stage, how many cases ENTERED that stage during the selected period
// (each case counted once per stage). So a stage's number already means "got this far", and the funnel uses it as is.

const STAGES = [
  'Lead Created', 'Data Pulled', 'Eligibility Report Generated', 'Lead Sent to Lender',
  'Under Process', 'Sanctioned Undisbursed', 'Partly Disbursed', 'Closed',
];
const LOST = 'Closed Leads';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN');
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const Stat = ({ label, value, sub }) => (
  <div style={{ flex: '1 1 140px', minWidth: 0, padding: '14px 16px', border: '1px solid var(--outline)', background: 'var(--surface-low)' }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--on-muted)' }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const Donut = ({ groups, total, active, onActive }) => {
  const R = 72; const C = 2 * Math.PI * R; const GAP = groups.filter((g) => g.count > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const activeGroup = groups.find((g) => g.key === active);
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="How this period's leads turned out" style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block', margin: '0 auto', color: 'var(--on-surface)' }}>
      <g transform="rotate(-90 100 100)">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-low)" strokeWidth="26" />
        {groups.filter((g) => g.count > 0).map((g) => {
          const len = (g.count / total) * C;
          const el = (
            <circle
              key={g.key} cx="100" cy="100" r={R} fill="none" stroke={g.color}
              strokeWidth={active === g.key ? 30 : 26}
              strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`} strokeDashoffset={-offset}
              style={{ cursor: 'pointer', transition: 'stroke-width .15s', opacity: active && active !== g.key ? 0.45 : 1 }}
              onMouseEnter={() => onActive(g.key)} onMouseLeave={() => onActive(null)}
            >
              <title>{`${g.label}: ${fmt(g.count)} (${pct(g.count, total)}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </g>
      <text x="100" y={activeGroup ? 94 : 100} textAnchor="middle" dominantBaseline="middle" fill="currentColor" style={{ fontSize: 28, fontWeight: 800 }}>
        {fmt(activeGroup ? activeGroup.count : total)}
      </text>
      <text x="100" y={activeGroup ? 116 : 120} textAnchor="middle" fill="currentColor" style={{ fontSize: 11, opacity: 0.65 }}>
        {activeGroup ? `${activeGroup.label} · ${pct(activeGroup.count, total)}%` : 'leads'}
      </text>
    </svg>
  );
};

const StageAnalytics = ({ counts, isMobile }) => {
  const [active, setActive] = useState(null);

  const m = useMemo(() => {
    const by = (l) => Number(counts?.[l]) || 0;
    const entered = STAGES.map(by);            // cases that entered each stage in the period
    const lost = by(LOST);
    const leads = entered[0];
    // How the period's leads turned out. A case that was sanctioned has usually gone on to be disbursed or closed too,
    // so "sanctioned or beyond" takes the largest of those, and what is left is still in progress.
    const sanctionedOrBeyond = Math.max(entered[5], entered[6], entered[7]);
    const base = Math.max(leads, sanctionedOrBeyond + lost);
    const inProgress = Math.max(0, base - sanctionedOrBeyond - lost);
    const groups = [
      { key: 'progress', label: 'In progress', hint: 'Not sanctioned or closed yet', count: inProgress, color: 'var(--primary)' },
      { key: 'sanctioned', label: 'Sanctioned or beyond', hint: 'Sanctioned, part or fully disbursed, closed', count: sanctionedOrBeyond, color: 'var(--success)' },
      { key: 'lost', label: 'Closed leads', hint: 'Did not go ahead', count: lost, color: 'var(--error)' },
    ];
    return { entered, lost, leads, sanctionedOrBeyond, base, groups, any: entered.some((n) => n > 0) || lost > 0 };
  }, [counts]);

  if (!m.any) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-muted)', fontSize: 14 }}>No cases in this period yet. Add a customer to see the pipeline here.</div>;
  }

  const top = Math.max(1, ...m.entered);
  const toLender = m.entered[3];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Leads created" value={fmt(m.leads)} sub="in this period" />
        <Stat label="Sent to a lender" value={fmt(toLender)} sub={`${pct(toLender, m.leads)}% of leads created`} />
        <Stat label="Sanctioned or beyond" value={fmt(m.sanctionedOrBeyond)} sub={`${pct(m.sanctionedOrBeyond, m.leads)}% of leads created`} />
        <Stat label="Closed leads" value={fmt(m.lost)} sub={`${pct(m.lost, m.leads)}% of leads created`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: isMobile ? 28 : 36, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Conversion funnel</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 12px' }}>Cases that reached each stage in this period, and the share that moved on from the stage before.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STAGES.map((label, i) => {
              const n = m.entered[i]; const w = Math.max(n > 0 ? 3 : 0, (n / top) * 100);
              const prev = i > 0 ? m.entered[i - 1] : null;
              // a later stage can be larger than the one before (a case may skip a stage): show nothing rather than >100%
              const step = prev != null && prev > 0 && n <= prev ? `↓ ${pct(n, prev)}% moved on` : (prev != null ? '↓' : null);
              return (
                <div key={label}>
                  {step && <div style={{ fontSize: 11, color: 'var(--on-muted)', padding: '2px 0', textAlign: 'center' }}>{step}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '190px minmax(0, 1fr) 92px', alignItems: 'center', gap: isMobile ? 4 : 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</span>
                    <div style={{ height: 26, background: 'var(--surface-low)', display: 'flex', justifyContent: 'center' }} title={`${label}: ${fmt(n)} cases reached this stage`}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', background: 'var(--primary)', opacity: 1 - i * 0.055 }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', textAlign: isMobile ? 'left' : 'right' }}>
                      {fmt(n)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-muted)' }}>{m.leads > 0 ? `${pct(n, m.leads)}%` : ''}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>How this period's leads turned out</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 12px' }}>Based on the stages cases reached in this period.</div>
          <Donut groups={m.groups} total={Math.max(1, m.base)} active={active} onActive={setActive} />
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.groups.map((g) => (
              <li
                key={g.key} onMouseEnter={() => setActive(g.key)} onMouseLeave={() => setActive(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px', background: active === g.key ? 'var(--surface-low)' : 'transparent', cursor: 'default' }}
              >
                <span aria-hidden style={{ width: 10, height: 10, background: g.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{g.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--on-muted)' }}>{g.hint}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{fmt(g.count)}</span>
                <span style={{ fontSize: 11, color: 'var(--on-muted)', width: 44, textAlign: 'right' }}>{pct(g.count, m.base)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StageAnalytics;
