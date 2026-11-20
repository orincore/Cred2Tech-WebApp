import React, { useState } from 'react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { BarChart } from '../../components/charts/SvgCharts';
import { esrApiPortal, apiError } from '../../api/esrApiService';
import { Card } from '../whitelabel/atoms';
import { Notice, Stat, StatRow, Table, inr, num, td, useAsync } from './common';

const RANGES = [{ id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }];
const iso = (d) => d.toISOString().slice(0, 10);
const plain = (n) => num(n);

export default function UsageTab({ flag }) {
  const [range, setRange] = useState('30');
  const [environment, setEnvironment] = useState('');
  const usage = useAsync(() => {
    const to = new Date(); const from = new Date(Date.now() - (Number(range) - 1) * 86400000);
    return esrApiPortal.usage({ from: iso(from), to: iso(to), bucket: 'day', ...(environment ? { environment } : {}) });
  }, [range, environment]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="form-control" style={{ width: 'auto' }} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period">{RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        {flag('uat.enabled') && flag('production.enabled') && (
          <select className="form-control" style={{ width: 'auto' }} value={environment} onChange={(e) => setEnvironment(e.target.value)} aria-label="Environment">
            <option value="">Both environments</option><option value="PRODUCTION">Production</option><option value="UAT">Test (UAT)</option>
          </select>
        )}
      </div>
      {usage.loading ? <LoadingSpinner /> : usage.error ? <Notice tone="error">{apiError(usage.error, 'Could not load usage')}</Notice> : (() => {
        const u = usage.data;
        return (
          <>
            <StatRow>
              <Stat label="Calls" value={num(u.totals.calls)} />
              <Stat label="Success rate" value={u.totals.success_rate_pct === null ? '—' : `${u.totals.success_rate_pct}%`} sub={`${num(u.totals.successful)} ok · ${num(u.totals.failed)} failed`} />
              <Stat label="Charged" value={inr(u.totals.charged_inr)} sub="GST extra" />
            </StatRow>
            <Card title="Calls per day">
              <BarChart labels={u.series.map((p) => p.bucket.slice(5))} format={plain} tipFormat={plain} ariaLabel="Calls per day"
                series={[{ name: 'Successful', color: 'var(--success)', values: u.series.map((p) => p.successful) }, { name: 'Failed', color: 'var(--error)', values: u.series.map((p) => p.failed) }]} stacked />
            </Card>
            <div style={{ height: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <Card title="By key">
                {!u.by_key.length ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No calls in this period.</p> : (
                  <Table head={['Key', 'Calls', 'Charged']}>{u.by_key.map((k) => <tr key={k.key_prefix || 'none'}><td style={td}>{k.key_name || k.key_prefix || 'No key (refused calls)'}</td><td style={td}>{num(k.calls)}</td><td style={td}>{inr(k.charged_inr)}</td></tr>)}</Table>
                )}
              </Card>
              <Card title="By outcome">
                {!u.by_status.length ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No calls in this period.</p> : (
                  <Table head={['Result', 'Calls']}>{u.by_status.map((s) => <tr key={s.status_code}><td style={td}>{s.status_code === 200 ? '200 OK' : `Error ${s.status_code}`}</td><td style={td}>{num(s.calls)}</td></tr>)}</Table>
                )}
              </Card>
            </div>
          </>
        );
      })()}
    </>
  );
}
