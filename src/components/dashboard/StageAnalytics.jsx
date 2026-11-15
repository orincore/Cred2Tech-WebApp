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
// shorter axis labels so nine columns stay readable; the full stage name is in each bar's tooltip text
const STAGE_SHORT = {
  'Eligibility Report Generated': 'Eligibility Report', 'Sanctioned Undisbursed': 'Sanctioned', 'Lead Sent to Lender': 'Sent to Lender',
};

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

// The top of the value axis: four gridlines at whole numbers (cases are counted in ones), the last at or above the tallest bar.
function niceMax(v) {
  return 4 * Math.max(1, Math.ceil(v / 4));
}

// Vertical bars: one column per stage, rising from a shared baseline, value on top, gridlines and a value axis behind.
const ColumnChart = ({ items, leads }) => {
  const [hover, setHover] = useState(null);
  const H = 220;
  const max = niceMax(Math.max(1, ...items.map((i) => i.count)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: items.length * 64 + 44, display: 'flex' }}>
        <div style={{ width: 40, height: H, marginTop: 34, position: 'relative', flexShrink: 0 }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', right: 8, bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)', fontSize: 11, color: 'var(--on-muted)' }}>{fmt(t)}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', height: H, marginTop: 34, display: 'flex', alignItems: 'flex-end', gap: 10, borderBottom: '1px solid var(--outline)' }}>
            {ticks.slice(1).map((t) => (
              <div key={t} aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t / max) * 100}%`, borderTop: '1px dashed var(--outline)', opacity: 0.6 }} />
            ))}
            {items.map((it, i) => {
              const h = (it.count / max) * 100;
              return (
                <div
                  key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  title={`${it.label}: ${fmt(it.count)} cases${leads > 0 ? ` (${pct(it.count, leads)}% of leads created)` : ''}`}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', opacity: hover != null && hover !== i ? 0.5 : 1, transition: 'opacity .15s' }}
                >
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${Math.max(it.count > 0 ? 1.5 : 0, h)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '70%', maxWidth: 44, background: it.color, position: 'relative' }}
                  >
                    {/* the value sits just above its bar, so it moves with it */}
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', paddingBottom: 3, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1.1 }}>{fmt(it.count)}</div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', minHeight: 12 }}>{leads > 0 && it.count > 0 ? `${pct(it.count, leads)}%` : ''}</div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {items.map((it) => (
              <div key={it.label} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10.5, lineHeight: 1.25, color: 'var(--on-surface)', fontWeight: 600 }}>{it.label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
    // the bars: the eight stages in order (the brand colour, fading a little as the pipeline goes on), then Closed Leads in red
    const columns = [
      ...STAGES.map((label, i) => ({ label: STAGE_SHORT[label] || label, count: entered[i], color: 'var(--primary)', fade: 1 - i * 0.055 })),
      { label: 'Closed Leads', count: lost, color: 'var(--error)', fade: 1 },
    ].map((c) => ({ ...c, color: c.fade < 1 ? `color-mix(in srgb, ${c.color} ${Math.round(c.fade * 100)}%, var(--surface))` : c.color }));
    return { entered, lost, leads, sanctionedOrBeyond, base, groups, columns, any: entered.some((n) => n > 0) || lost > 0 };
  }, [counts]);

  if (!m.any) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-muted)', fontSize: 14 }}>No cases in this period yet. Add a customer to see the pipeline here.</div>;
  }

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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Cases by stage</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 14px' }}>How many cases reached each stage in this period. The small figure is the share of leads created.</div>
          <ColumnChart items={m.columns} leads={m.leads} />
        </div>

        <div style={{ minWidth: 0 }}>
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
