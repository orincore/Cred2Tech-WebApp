import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Users, Activity, Banknote, ShieldCheck, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import StageBar from '../../components/ui/StageBar';
import TableSkeleton from '../../components/ui/TableSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import TrendBadge, { AnimatedNumber } from '../../components/ui/TrendBadge';
import { getPlatformSummary, getPlatformApiUsage, getPlatformFunnel, getTopDsas, getTopLenders } from '../../api/dashboardService';
import { formatCompactINR, getErrorMessage } from '../../utils/helpers';

const PlatformDashboardView = ({ period, refreshKey, isMobile, isTablet }) => {
  const [summary, setSummary] = useState(null);
  const [apiUsage, setApiUsage] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [topDsas, setTopDsas] = useState([]);
  const [topLenders, setTopLenders] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);

  const load = useCallback(async () => {
    setLoadingSummary(true);
    setLoadingTables(true);
    const params = { period };
    await Promise.all([
      getPlatformSummary(params).then(setSummary).catch((err) => { toast.error(getErrorMessage(err)); setSummary(null); }).finally(() => setLoadingSummary(false)),
      getPlatformApiUsage(params).then(setApiUsage).catch(() => setApiUsage(null)),
      getPlatformFunnel(params).then((d) => setFunnel(Array.isArray(d) ? d : [])).catch(() => setFunnel([])),
      getTopDsas(params).then((d) => setTopDsas(Array.isArray(d) ? d : [])).catch(() => setTopDsas([])),
      getTopLenders(params).then((d) => setTopLenders(Array.isArray(d) ? d : [])).catch(() => setTopLenders([])).finally(() => setLoadingTables(false)),
    ]);
  }, [period]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const kpis = summary && [
    { title: 'Active DSAs', value: summary.active_dsas, trendPct: summary.active_dsas_trend_pct, subtitle: summary.active_dsas_new_period != null ? `${summary.active_dsas_new_period} new this period` : undefined, icon: Building2, color: 'var(--primary)' },
    { title: 'Active Clients', value: summary.active_clients, trendPct: summary.active_clients_trend_pct, icon: Users, color: 'var(--info)' },
    { title: 'Total API Calls', value: summary.total_api_calls, trendPct: summary.total_api_calls_trend_pct, icon: Activity, color: 'var(--warning)' },
    { title: 'Amount Disbursed', value: summary.amount_disbursed, isCurrency: true, trendPct: summary.amount_disbursed_trend_pct, icon: Banknote, color: 'var(--success)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
        {(kpis || Array.from({ length: 4 })).map((k, i) => (
          <motion.div key={k?.title || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
            <StatCard
              title={k?.title || ''}
              loading={loadingSummary || !k}
              icon={k?.icon}
              color={k?.color}
              value={k ? (k.isCurrency ? formatCompactINR(k.value) : <AnimatedNumber value={k.value} />) : '—'}
              subtitle={
                k ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {k.subtitle}
                    <TrendBadge pct={k.trendPct} />
                  </span>
                ) : undefined
              }
            />
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `1fr ${isTablet ? '300px' : '360px'}`, gap: 20, alignItems: 'start' }}>
        <SectionCard title="API Usage by Type" subtitle="Calls, success rate, and failures this period" delay={0.1}>
          {loadingTables ? (
            <TableSkeleton rows={4} columns={4} />
          ) : !apiUsage?.rows?.length ? (
            <EmptyState icon={Inbox} title="No API usage" description="No API calls recorded in this period." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? 480 : '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--outline)' }}>
                    {['API Type', 'Calls', 'Success Rate', 'Failed / Refunded'].map((h) => (
                      <th key={h} style={{ padding: '10px 20px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apiUsage.rows.map((r, i) => (
                    <tr key={r.api_code || i} style={{ borderBottom: '1px solid var(--outline)' }}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{r.display_name || r.api_code}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--on-surface)' }}>{r.total?.toLocaleString?.('en-IN') ?? r.total}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{r.success_rate != null ? `${r.success_rate}%` : '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--on-muted)' }}>{r.failed ?? 0} / {r.refunded ?? 0}</td>
                    </tr>
                  ))}
                  {apiUsage.totals && (
                    <tr style={{ borderTop: '2px solid var(--outline)' }}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>Total</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{apiUsage.totals.total?.toLocaleString?.('en-IN') ?? apiUsage.totals.total}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{apiUsage.totals.success_rate != null ? `${apiUsage.totals.success_rate}%` : '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--on-muted)' }}>{apiUsage.totals.failed ?? 0} / {apiUsage.totals.refunded ?? 0}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Customer Funnel"
          delay={0.15}
          actions={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', borderRadius: 0 }}>
              <ShieldCheck size={11} /> Counts only — No PII
            </span>
          }
        >
          {loadingTables ? (
            <TableSkeleton rows={5} columns={1} />
          ) : funnel.length === 0 ? (
            <EmptyState icon={Inbox} title="No funnel data" description="No activity recorded in this period." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
              {funnel.map((f, i) => (
                <StageBar
                  key={f.stage || f.label}
                  label={f.label}
                  count={f.count}
                  pct={f.conversion_pct ?? 0}
                  suffix={f.conversion_pct != null ? `${f.conversion_pct}% conv.` : undefined}
                  color="var(--primary)"
                  delay={i * 0.05}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
        <SectionCard title="Top DSAs" subtitle="By activity this period" delay={0.2}>
          {loadingTables ? (
            <TableSkeleton rows={5} columns={4} />
          ) : topDsas.length === 0 ? (
            <EmptyState icon={Inbox} title="No DSA activity" description="No DSA activity recorded in this period." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? 420 : '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--outline)' }}>
                    {['DSA', 'API Calls', 'Applications', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topDsas.map((d, i) => (
                    <tr key={d.dsa_name || i} style={{ borderBottom: '1px solid var(--outline)' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>{d.dsa_name}</p>
                        {d.since && <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: 0 }}>Since {d.since}</p>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--on-surface)' }}>{d.api_calls?.toLocaleString?.('en-IN') ?? d.api_calls}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--on-surface)' }}>{d.applications?.toLocaleString?.('en-IN') ?? d.applications}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 0,
                          color: d.status === 'Active' ? 'var(--success)' : 'var(--warning)',
                          background: d.status === 'Active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        }}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Top Lenders" subtitle="By pipeline volume this period" delay={0.25}>
          {loadingTables ? (
            <TableSkeleton rows={5} columns={4} />
          ) : topLenders.length === 0 ? (
            <EmptyState icon={Inbox} title="No lender activity" description="No lender activity recorded in this period." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? 420 : '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--outline)' }}>
                    {['Lender', 'Applied', 'Sanctioned', 'Disbursed'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topLenders.map((l, i) => (
                    <tr key={l.lender_name || i} style={{ borderBottom: '1px solid var(--outline)' }}>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{l.lender_name}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--on-surface)' }}>{l.applied?.toLocaleString?.('en-IN') ?? l.applied}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--on-surface)' }}>{l.sanctioned?.toLocaleString?.('en-IN') ?? l.sanctioned}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--on-surface)' }}>{l.disbursed?.toLocaleString?.('en-IN') ?? l.disbursed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default PlatformDashboardView;
