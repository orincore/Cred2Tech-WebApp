import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

// Stage Summary as analytics instead of a wall of bars: headline numbers, a conversion funnel (how many cases got
// this far, and what share carried on to the next step) and a donut that shows where the pipeline sits right now.
// Pure SVG/HTML on theme tokens, so it follows the organisation's colour and dark mode with no chart library.

const STAGES = [
  'Lead Created', 'Data Pulled', 'Eligibility Report Generated', 'Lead Sent to Lender',
  'Under Process', 'Sanctioned Undisbursed', 'Partly Disbursed', 'Closed',
];
const LOST = 'Closed Leads';

// where a case sits right now, in five groups people can reason about
const GROUPS = [
  { key: 'early', label: 'Getting ready', hint: 'Lead, data pulled, eligibility', stages: STAGES.slice(0, 3), color: 'var(--warning)' },
  { key: 'lender', label: 'With lender', hint: 'Sent to lender, under process', stages: STAGES.slice(3, 5), color: 'var(--primary)' },
  { key: 'sanction', label: 'Sanctioned', hint: 'Sanctioned or part disbursed', stages: STAGES.slice(5, 7), color: 'var(--success)' },
  { key: 'closed', label: 'Closed', hint: 'Completed', stages: STAGES.slice(7), color: '#64748B' },
  { key: 'lost', label: 'Closed leads', hint: 'Did not go ahead', stages: [LOST], color: 'var(--error)' },
];

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
    <svg viewBox="0 0 200 200" role="img" aria-label="Cases by current stage" style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block', margin: '0 auto' }}>
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
      <text x="100" y={activeGroup ? 94 : 100} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 28, fontWeight: 800, fill: 'var(--on-surface)' }}>
        {fmt(activeGroup ? activeGroup.count : total)}
      </text>
      <text x="100" y={activeGroup ? 116 : 120} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--on-muted)' }}>
        {activeGroup ? `${activeGroup.label} · ${pct(activeGroup.count, total)}%` : 'cases'}
      </text>
    </svg>
  );
};

const StageAnalytics = ({ counts, isMobile }) => {
  const [active, setActive] = useState(null);

  const m = useMemo(() => {
    const by = (l) => Number(counts?.[l]) || 0;
    const lost = by(LOST);
    const live = STAGES.map((l) => by(l));
    const total = live.reduce((a, b) => a + b, 0) + lost;
    // "reached this stage or later": a case now at stage 5 also passed stages 1 to 4
    const reached = live.map((_, i) => live.slice(i).reduce((a, b) => a + b, 0));
    const groups = GROUPS.map((g) => ({ ...g, count: g.stages.reduce((a, l) => a + by(l), 0) }));
    return { lost, live, total, reached, groups };
  }, [counts]);

  if (!m.total) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-muted)', fontSize: 14 }}>No cases in this period yet. Add a customer to see the pipeline here.</div>;
  }

  const base = Math.max(1, m.reached[0]);
  const sanctioned = m.reached[5];
  const withLenderOrBeyond = m.reached[3];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Total cases" value={fmt(m.total)} sub="in this period" />
        <Stat label="Sent to a lender" value={fmt(withLenderOrBeyond)} sub={`${pct(withLenderOrBeyond, base)}% of active cases`} />
        <Stat label="Sanctioned or beyond" value={fmt(sanctioned)} sub={`${pct(sanctioned, base)}% of active cases`} />
        <Stat label="Closed leads" value={fmt(m.lost)} sub={`${pct(m.lost, m.total)}% of all cases`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: isMobile ? 28 : 36, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Conversion funnel</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 12px' }}>Cases that reached each stage or went further, and the share that carried on from the step before.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STAGES.map((label, i) => {
              const n = m.reached[i]; const w = Math.max(n > 0 ? 3 : 0, (n / base) * 100);
              const prev = i > 0 ? m.reached[i - 1] : null;
              return (
                <div key={label}>
                  {prev != null && (
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', padding: '2px 0 2px 0', textAlign: 'center' }}>
                      {prev > 0 ? `↓ ${pct(n, prev)}% carried on` : '↓'}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '190px minmax(0, 1fr) 92px', alignItems: 'center', gap: isMobile ? 4 : 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</span>
                    <div style={{ height: 26, background: 'var(--surface-low)', display: 'flex', justifyContent: 'center' }} title={`${label}: ${fmt(n)} reached`}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', background: 'var(--primary)', opacity: 1 - i * 0.055 }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', textAlign: isMobile ? 'left' : 'right' }}>
                      {fmt(n)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-muted)' }}>{pct(n, base)}%</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Where cases are right now</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 12px' }}>Share of all cases by current stage group.</div>
          <Donut groups={m.groups} total={m.total} active={active} onActive={setActive} />
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
                <span style={{ fontSize: 11, color: 'var(--on-muted)', width: 44, textAlign: 'right' }}>{pct(g.count, m.total)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StageAnalytics;
