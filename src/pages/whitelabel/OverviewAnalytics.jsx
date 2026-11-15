import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService, apiError } from '../../api/whitelabelService';
import { LineChart, BarChart, DonutChart, ChartCard, ChartGrid, PALETTE, inrShort, inrFull } from '../../components/charts/SvgCharts';
import { Card } from './atoms';
import { formatBytes } from './whitelabelUi';

// Charts and totals for ONE partner organisation: what it consumes, what it pays, what it does. Read live from the
// organisation's own database (GET /admin/whitelabel/:id/analytics); aggregate counts only, no personal data.

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const short = (n) => {
  const v = Number(n) || 0; const a = Math.abs(v);
  if (a >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 10) / 10);
};
const monthLabel = (m) => { const [y, mm] = m.split('-'); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); };
const dayLabel = (d) => { const [y, m, dd] = d.split('-'); return new Date(Number(y), Number(m) - 1, Number(dd)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const STAGE = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const codeLabel = (c) => (c.length > 14 ? `${c.slice(0, 13)}…` : c);

const Stat = ({ label, value, sub, tone }) => (
  <div style={{ padding: '12px 14px', border: '1px solid var(--outline)', background: 'var(--surface)', borderLeft: tone ? `3px solid ${tone}` : '1px solid var(--outline)' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--on-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const OverviewAnalytics = ({ org }) => {
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setA(await whitelabelService.analytics(org.id)); setError(null); }
    catch (e) { setError(apiError(e, 'Could not load the analytics')); }
    finally { setLoading(false); }
  }, [org.id]);
  useEffect(() => { load(); }, [load, org.status]);

  const view = useMemo(() => {
    if (!a) return null;
    const mLabels = a.months.map((m) => monthLabel(m.month));
    const topApis = a.by_api.filter((x) => x.credits > 0).slice(0, 6);
    const busiest = [...a.by_api].sort((x, y) => y.calls - x.calls).slice(0, 8);
    const hasMoney = a.months.some((m) => m.recharged_inr || m.msme_fees_inr || m.plan_charges_inr);
    return { mLabels, topApis, busiest, hasMoney };
  }, [a]);

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontSize: 13, margin: 0 }}>{error}</p>;
  if (!a) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={26} /></div>;

  const k = a.kpis;
  const { mLabels, topApis, busiest, hasMoney } = view;
  const noActivity = !k.api_calls && !k.cases_total && !k.recharged_inr;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card
        title="Consumption and activity"
        subtitle={`Last ${a.window_months} months · India time · read live from this organisation's own database.`}
        actions={<button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={load} disabled={loading} aria-label="Refresh analytics"><RefreshCw size={13} /> Refresh</button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Stat label="API calls" value={num(k.api_calls)} sub={`${num(k.api_success)} succeeded · ${num(k.api_failed)} failed · ${num(k.api_refunded)} refunded`} tone="var(--primary)" />
          <Stat label="Success rate" value={k.success_rate === null ? '—' : `${k.success_rate}%`} sub="calls that completed" tone="var(--success)" />
          <Stat label="Credits consumed" value={num(k.credits_used)} sub="on successful calls" tone="var(--warning)" />
          <Stat label="Wallet balance" value={`${num(k.wallet_balance_credits)} cr`} sub={`${num(k.recharges)} recharge${k.recharges === 1 ? '' : 's'} · ${inrFull(k.recharged_inr)}`} tone="var(--info, #7c5cff)" />
          <Stat label="Cases" value={num(k.cases_total)} sub={`${num(k.cases_created)} created in this window`} />
          <Stat label="Users and partners" value={`${num(k.active_users)} / ${num(k.partners)}`} sub="active users / sourcing partners" />
          <Stat label="SMS sent" value={num(k.sms_sent)} />
          <Stat label="Storage" value={formatBytes(k.storage_bytes)} sub={`${num(k.storage_files)} files`} />
        </div>
        {noActivity && <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--on-muted)' }}>No activity yet. Charts fill in as this organisation's partners use the platform.</p>}
      </Card>

      <ChartGrid min={420}>
        <ChartCard title="API calls per month" hint="Succeeded, failed and refunded.">
          <BarChart stacked ariaLabel="API calls per month by outcome" labels={mLabels} format={short} tipFormat={num}
            series={[
              { name: 'Succeeded', color: 'var(--success)', values: a.months.map((m) => m.api_success) },
              { name: 'Failed', color: 'var(--error)', values: a.months.map((m) => m.api_failed) },
              { name: 'Refunded', color: 'var(--warning)', values: a.months.map((m) => m.api_refunded) },
            ]} />
        </ChartCard>
        <ChartCard title="Credits per month" hint="Credits consumed on successful calls, against credits added to the wallet.">
          <LineChart ariaLabel="Credits consumed and added per month" labels={mLabels} format={short} tipFormat={num}
            series={[
              { name: 'Consumed', color: 'var(--warning)', values: a.months.map((m) => m.credits_used) },
              { name: 'Added to wallet', color: 'var(--success)', values: a.months.map((m) => m.credits_in) },
              { name: 'All debits', color: 'var(--primary)', dashed: true, values: a.months.map((m) => m.credits_out) },
            ]} />
        </ChartCard>
      </ChartGrid>

      <ChartGrid min={420}>
        <ChartCard title="Last 30 days" hint="API calls and credits, day by day.">
          <LineChart ariaLabel="API calls and credits, last 30 days" labels={a.days.map((d) => dayLabel(d.day))} format={short} tipFormat={num}
            series={[
              { name: 'API calls', color: 'var(--primary)', values: a.days.map((d) => d.api_calls) },
              { name: 'Credits', color: 'var(--warning)', dashed: true, values: a.days.map((d) => d.credits_used) },
            ]} />
        </ChartCard>
        <ChartCard title="Money paid per month" hint="What this organisation paid, in rupees: wallet recharges, Direct-MSME fees and plan charges.">
          {hasMoney ? (
            <BarChart stacked ariaLabel="Rupees paid per month" labels={mLabels} format={inrShort} tipFormat={inrFull}
              series={[
                { name: 'Wallet recharges', color: 'var(--primary)', values: a.months.map((m) => m.recharged_inr) },
                { name: 'MSME fees', color: 'var(--success)', values: a.months.map((m) => m.msme_fees_inr) },
                { name: 'Plan charges', color: 'var(--warning)', values: a.months.map((m) => m.plan_charges_inr) },
              ]} />
          ) : <p style={{ margin: 0, fontSize: 12.5, color: 'var(--on-muted)' }}>No payments in this window.</p>}
        </ChartCard>
      </ChartGrid>

      <ChartGrid min={340}>
        <ChartCard title="Share of credits by API" hint="Credits consumed on successful calls.">
          <DonutChart size={150} ariaLabel="Share of credits by API" centerLabel="Credits" centerValue={short(k.credits_used)} format={num}
            slices={topApis.map((x, i) => ({ name: x.api_code, value: x.credits, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="Calls by vendor" hint="Which vendor served the calls.">
          <DonutChart size={150} ariaLabel="Calls by vendor" centerLabel="Calls" centerValue={short(k.api_calls)} format={num}
            slices={a.by_vendor.map((x, i) => ({ name: x.vendor, value: x.calls, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="Cases by stage">
          <DonutChart size={150} ariaLabel="Cases by stage" centerLabel="Cases" centerValue={short(k.cases_total)} format={num}
            slices={a.cases.by_stage.map((x, i) => ({ name: STAGE(x.stage), value: x.cases, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
      </ChartGrid>

      <ChartGrid min={420}>
        <ChartCard title="Busiest APIs" hint="Calls against calls that did not succeed.">
          <BarChart ariaLabel="Busiest APIs" labels={busiest.map((x) => codeLabel(x.api_code))} format={short} tipFormat={num}
            series={[
              { name: 'Succeeded', color: 'var(--success)', values: busiest.map((x) => x.success) },
              { name: 'Failed or refunded', color: 'var(--error)', values: busiest.map((x) => x.failed + x.refunded) },
            ]} stacked />
        </ChartCard>
        <ChartCard title="Cases and SMS per month">
          <BarChart ariaLabel="Cases created and SMS sent per month" labels={mLabels} format={short} tipFormat={num}
            series={[
              { name: 'Cases created', color: 'var(--primary)', values: a.months.map((m) => m.cases_created) },
              { name: 'SMS sent', color: 'var(--info, #7c5cff)', values: a.months.map((m) => m.sms_sent) },
            ]} />
        </ChartCard>
      </ChartGrid>

      {a.cases.by_lender.length > 0 && (
        <ChartGrid min={420}>
          <ChartCard title="Cases by lender" hint="The lenders its cases were sent to.">
            <BarChart ariaLabel="Cases by lender" labels={a.cases.by_lender.map((x) => codeLabel(x.lender))} format={short} tipFormat={num}
              series={[{ name: 'Cases', color: 'var(--primary)', values: a.cases.by_lender.map((x) => x.cases) }]} />
          </ChartCard>
        </ChartGrid>
      )}

      <Card title="By API" subtitle="Every API this organisation has called in the window.">
        {a.by_api.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: 'var(--on-muted)' }}>No API calls yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {['API', 'Calls', 'Succeeded', 'Failed', 'Refunded', 'Success rate', 'Credits'].map((h, i) => <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline)', textAlign: i ? 'right' : 'left' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {a.by_api.map((r) => (
                  <tr key={r.api_code}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline)', fontFamily: 'monospace', fontWeight: 600 }}>{r.api_code}</td>
                    {[r.calls, r.success, r.failed, r.refunded].map((v, i) => <td key={i} style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline)', textAlign: 'right' }}>{num(v)}</td>)}
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline)', textAlign: 'right' }}>{r.success_rate}%</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline)', textAlign: 'right', fontWeight: 700 }}>{num(r.credits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OverviewAnalytics;
