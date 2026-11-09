import React, { useMemo, useRef, useState } from 'react';

/**
 * Small, dependency-free SVG charts (line, bar, donut) for the admin revenue pages.
 *
 * Colours are CSS variables (with fallbacks), so light and dark themes both work and the charts
 * match the rest of the app. Each chart is responsive (SVG viewBox), has hover tooltips, an
 * accessible label, and says "No data" instead of drawing an empty axis.
 */

export const PALETTE = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info, #7c5cff)', 'var(--error)', '#0ea5e9', '#a855f7', '#14b8a6', '#f97316'];

const AXIS = 'var(--on-muted)';
const GRID = 'var(--outline)';

/** ₹1.2L / ₹3.4Cr style short money for axes, full precision for tooltips. */
export const inrShort = (n) => {
  const v = Math.abs(Number(n) || 0); const sign = n < 0 ? '−' : '';
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `${sign}₹${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(v)}`;
};
export const inrFull = (n) => `${n < 0 ? '−' : ''}₹${Math.abs(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Nice" tick values covering [min, max] (always includes 0 when the data does). */
function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const W = 640;
const PAD = { l: 58, r: 14, t: 14, b: 30 };

const NoData = ({ height, message = 'No data in this period' }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-muted)', fontSize: 12, fontWeight: 600 }}>{message}</div>
);

const Legend = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8 }}>
    {items.map((it) => (
      <span key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--on-surface)' }}>
        <span style={{ width: 10, height: 10, background: it.color, display: 'inline-block', borderRadius: it.dashed ? 0 : 2, border: it.dashed ? `1px dashed ${it.color}` : 'none' }} />{it.name}
      </span>
    ))}
  </div>
);

const Tooltip = ({ x, y, title, rows, wrapW }) => (
  <div style={{
    position: 'absolute', left: Math.min(Math.max(x, 8), wrapW - 8), top: y, transform: `translate(${x > wrapW * 0.6 ? '-105%' : '12px'}, -50%)`, pointerEvents: 'none', zIndex: 5,
    background: 'var(--bg-surface)', border: '1px solid var(--outline)', boxShadow: 'var(--shadow-lg, 0 4px 14px rgba(0,0,0,.18))', padding: '8px 10px', minWidth: 150, fontSize: 11,
  }}>
    <div style={{ fontWeight: 800, color: 'var(--on-surface)', marginBottom: 4 }}>{title}</div>
    {rows.map((r) => (
      <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--on-surface)', fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: r.color, display: 'inline-block' }} />{r.name}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
      </div>
    ))}
  </div>
);

/** Shared plot geometry for line and bar charts. */
function useScale(series, height, { stacked = false, includeZero = true } = {}) {
  return useMemo(() => {
    const all = [];
    const n = series[0]?.values.length || 0;
    if (stacked) {
      for (let i = 0; i < n; i += 1) {
        let pos = 0; let neg = 0;
        series.forEach((s) => { const v = s.values[i] || 0; if (v >= 0) pos += v; else neg += v; });
        all.push(pos, neg);
      }
    } else series.forEach((s) => s.values.forEach((v) => all.push(v || 0)));
    let min = Math.min(...all, includeZero ? 0 : Infinity); let max = Math.max(...all, includeZero ? 0 : -Infinity);
    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    const ticks = niceTicks(min, max);
    const lo = ticks[0]; const hi = ticks[ticks.length - 1];
    const ph = height - PAD.t - PAD.b;
    const y = (v) => PAD.t + ph - ((v - lo) / (hi - lo || 1)) * ph;
    return { ticks, y, lo, hi, n };
  }, [series, height, stacked, includeZero]);
}

const Axes = ({ ticks, y, labels, xAt, fmt, height, labelEvery }) => (
  <>
    {ticks.map((t) => (
      <g key={t}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" strokeDasharray={t === 0 ? '' : '3 3'} />
        <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={AXIS} fontWeight="600">{fmt(t)}</text>
      </g>
    ))}
    {labels.map((l, i) => (i % labelEvery === 0 ? <text key={l} x={xAt(i)} y={height - 9} textAnchor="middle" fontSize="10" fill={AXIS} fontWeight="600">{l}</text> : null))}
  </>
);

/**
 * Line chart.
 * @param {{labels: string[], series: {name: string, color: string, values: number[], dashed?: boolean}[],
 *   height?: number, format?: (n: number) => string, tipFormat?: (n: number) => string}} p
 */
export const LineChart = ({ labels, series, height = 230, format = inrShort, tipFormat = inrFull, ariaLabel = 'Line chart' }) => {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const { ticks, y } = useScale(series, height);
  const n = labels.length;
  const hasData = n > 0 && series.some((s) => s.values.some((v) => v));
  if (!hasData) return <NoData height={height} />;
  const xAt = (i) => (n === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1));
  const labelEvery = Math.ceil(n / 8);

  const onMove = (e) => {
    const rect = wrap.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0; let bd = Infinity;
    for (let i = 0; i < n; i += 1) { const d = Math.abs(xAt(i) - px); if (d < bd) { bd = d; best = i; } }
    setHover({ i: best, x: (xAt(best) / W) * rect.width, y: e.clientY - rect.top });
  };

  return (
    <div>
      <div ref={wrap} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
          <Axes ticks={ticks} y={y} labels={labels} xAt={xAt} fmt={format} height={height} labelEvery={labelEvery} />
          {series.map((s) => (
            <g key={s.name}>
              <path d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${y(v || 0)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeDasharray={s.dashed ? '5 4' : ''} />
              {s.values.map((v, i) => <circle key={i} cx={xAt(i)} cy={y(v || 0)} r={hover?.i === i ? 4.5 : 2.6} fill={s.color} stroke="var(--bg-surface)" strokeWidth="1.2" />)}
            </g>
          ))}
          {hover && <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={PAD.t} y2={height - PAD.b} stroke={AXIS} strokeWidth="1" strokeDasharray="3 3" />}
        </svg>
        {hover && wrap.current && (
          <Tooltip x={hover.x} y={Math.max(hover.y, 30)} wrapW={wrap.current.clientWidth} title={labels[hover.i]} rows={series.map((s) => ({ name: s.name, color: s.color, value: tipFormat(s.values[hover.i] || 0) }))} />
        )}
      </div>
      <Legend items={series} />
    </div>
  );
};

/**
 * Bar chart, grouped or stacked.
 * @param {{labels: string[], series: {name: string, color: string, values: number[]}[], stacked?: boolean, height?: number}} p
 */
export const BarChart = ({ labels, series, stacked = false, height = 230, format = inrShort, tipFormat = inrFull, ariaLabel = 'Bar chart' }) => {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const { ticks, y } = useScale(series, height, { stacked });
  const n = labels.length;
  const hasData = n > 0 && series.some((s) => s.values.some((v) => v));
  if (!hasData) return <NoData height={height} />;
  const plotW = W - PAD.l - PAD.r;
  const slot = plotW / n;
  const groupW = Math.min(slot * 0.7, 64);
  const barW = stacked ? groupW : groupW / series.length;
  const xCenter = (i) => PAD.l + slot * i + slot / 2;
  const labelEvery = Math.ceil(n / 10);
  const zero = y(0);

  const onMove = (e) => {
    const rect = wrap.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.min(Math.max(Math.floor((px - PAD.l) / slot), 0), n - 1);
    setHover({ i, x: (xCenter(i) / W) * rect.width, y: e.clientY - rect.top });
  };

  return (
    <div>
      <div ref={wrap} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
          <Axes ticks={ticks} y={y} labels={labels} xAt={xCenter} fmt={format} height={height} labelEvery={labelEvery} />
          {hover && <rect x={PAD.l + slot * hover.i} y={PAD.t} width={slot} height={height - PAD.t - PAD.b} fill="var(--bg-elevated)" opacity="0.7" />}
          {labels.map((_, i) => {
            let pos = 0; let neg = 0;
            return series.map((s, si) => {
              const v = s.values[i] || 0;
              if (!v) return null;
              let top; let bottom;
              if (stacked) { if (v >= 0) { bottom = y(pos); pos += v; top = y(pos); } else { top = y(neg); neg += v; bottom = y(neg); } }
              else { top = v >= 0 ? y(v) : zero; bottom = v >= 0 ? zero : y(v); }
              const x = stacked ? xCenter(i) - barW / 2 : xCenter(i) - groupW / 2 + si * barW;
              return <rect key={`${i}-${s.name}`} x={x} y={Math.min(top, bottom)} width={Math.max(barW - (stacked ? 0 : 1.5), 1)} height={Math.max(Math.abs(bottom - top), 1)} fill={s.color} rx="1.5" />;
            });
          })}
        </svg>
        {hover && wrap.current && (
          <Tooltip x={hover.x} y={Math.max(hover.y, 30)} wrapW={wrap.current.clientWidth} title={labels[hover.i]} rows={series.map((s) => ({ name: s.name, color: s.color, value: tipFormat(s.values[hover.i] || 0) }))} />
        )}
      </div>
      <Legend items={series} />
    </div>
  );
};

/**
 * Donut chart with a centre total and a legend showing value and share.
 * @param {{slices: {name: string, value: number, color?: string}[], centerLabel?: string, centerValue?: string, size?: number}} p
 */
export const DonutChart = ({ slices, centerLabel = '', centerValue = '', size = 170, format = inrFull, ariaLabel = 'Donut chart' }) => {
  const [hover, setHover] = useState(null);
  const items = slices.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length], value: Math.max(Number(s.value) || 0, 0) }));
  const total = items.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return <NoData height={size} />;
  const r = size / 2 - 8; const inner = r * 0.62; const cx = size / 2; const cy = size / 2;
  let angle = -Math.PI / 2;
  const arcs = items.filter((s) => s.value > 0).map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = angle; const a1 = angle + sweep; angle = a1;
    const big = sweep > Math.PI ? 1 : 0;
    const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const [x0, y0] = p(r, a0); const [x1, y1] = p(r, a1); const [x2, y2] = p(inner, a1); const [x3, y3] = p(inner, a0);
    // A single full-circle slice cannot be one arc; draw it as two halves.
    const d = sweep >= Math.PI * 2 - 1e-6
      ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r},${r} 0 1 1 ${cx},${cy - r} M${cx},${cy - inner} A${inner},${inner} 0 1 0 ${cx},${cy + inner} A${inner},${inner} 0 1 0 ${cx},${cy - inner}Z`
      : `M${x0},${y0} A${r},${r} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${big} 0 ${x3},${y3} Z`;
    return { ...s, d };
  });
  const active = hover !== null ? items.find((s) => s.name === hover) : null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
          {arcs.map((a) => (
            <path key={a.name} d={a.d} fill={a.color} fillRule="evenodd" stroke="var(--bg-surface)" strokeWidth="1.5" opacity={hover === null || hover === a.name ? 1 : 0.35}
              onMouseEnter={() => setHover(a.name)} onMouseLeave={() => setHover(null)} style={{ transition: 'opacity .12s' }} />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', padding: inner * 0.25 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{active ? active.name : centerLabel}</div>
          <div style={{ fontSize: active ? 13 : 14, fontWeight: 800, color: 'var(--on-surface)', marginTop: 2 }}>{active ? format(active.value) : centerValue}</div>
          {active && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)' }}>{((active.value / total) * 100).toFixed(1)}%</div>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 150 }}>
        {items.map((s) => (
          <div key={s.name} onMouseEnter={() => setHover(s.name)} onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, opacity: hover === null || hover === s.name ? 1 : 0.45, cursor: 'default' }}>
            <span style={{ width: 10, height: 10, background: s.color, display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, color: 'var(--on-surface)' }}>{s.name}</span>
            <span style={{ fontWeight: 700, color: 'var(--on-surface)', fontVariantNumeric: 'tabular-nums' }}>{format(s.value)}</span>
            <span style={{ width: 44, textAlign: 'right', color: 'var(--on-muted)', fontWeight: 600 }}>{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** A titled card that holds a chart, in the same sharp-cornered style as the page's tables. */
export const ChartCard = ({ title, hint, children, style }) => (
  <div className="card" style={{ padding: 0, borderRadius: 0, ...style }}>
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--outline)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
    </div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);

/** Lays chart cards out in a responsive grid (one column on narrow screens). */
export const ChartGrid = ({ children, min = 340 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 16, marginBottom: 16 }}>{children}</div>
);
