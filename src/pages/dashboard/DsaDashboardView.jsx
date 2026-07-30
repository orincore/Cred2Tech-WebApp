import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  UserPlus, ClipboardCheck, CheckCircle2, Banknote,
  Plus, Users, Network, UserCircle, ArrowRight, Inbox,
} from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import StageBar from '../../components/ui/StageBar';
import TableSkeleton from '../../components/ui/TableSkeleton';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import TrendBadge, { AnimatedNumber } from '../../components/ui/TrendBadge';
import { getDsaSummary, getDsaCases, getDsaStageSummary } from '../../api/dashboardService';
import { formatCompactINR, getErrorMessage, formatStatusLabel, CASE_STAGE_LABELS } from '../../utils/helpers';

// Fixed pipeline order — matches the product's actual case lifecycle stages.
const STAGE_ORDER = [
  'Lead Created',
  'Data Pulled',
  'Eligibility Report Generated',
  'Lead Sent to Lender',
  'Under Process',
  'Sanctioned Undisbursed',
  'Partly Disbursed',
  'Closed',
  'Closed Leads',
];

const QuickAction = ({ icon: Icon, label, desc, color, onClick, delay }) => (
  <motion.button
    initial={{ opacity: 0, x: 8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3, delay }}
    whileHover={{ x: 2, borderColor: color }}
    onClick={onClick}
    style={{
      background: 'transparent',
      border: '1px solid var(--outline)',
      borderRadius: 0,
      padding: '12px 14px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    }}
  >
    <div style={{ width: 34, height: 34, borderRadius: 0, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color={color} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '1px 0 0' }}>{desc}</p>
    </div>
    <ArrowRight size={14} color="var(--on-muted)" style={{ flexShrink: 0 }} />
  </motion.button>
);

const STAGE_BADGE_COLORS = {
  approved: 'var(--success)',
  sanctioned: 'var(--success)',
  disbursed: 'var(--success)',
  rejected: 'var(--error)',
  closed: 'var(--on-muted)',
};

const stageColor = (stage) => {
  const key = (stage || '').toLowerCase();
  for (const k in STAGE_BADGE_COLORS) if (key.includes(k)) return STAGE_BADGE_COLORS[k];
  return 'var(--info)';
};

const DsaDashboardView = ({ period, refreshKey, isMobile, isTablet }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [stageSummary, setStageSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCases, setLoadingCases] = useState(true);

  const load = useCallback(async () => {
    setLoadingSummary(true);
    setLoadingCases(true);
    const params = { period };
    await Promise.all([
      getDsaSummary(params).then(setSummary).catch((err) => { toast.error(getErrorMessage(err)); setSummary(null); }).finally(() => setLoadingSummary(false)),
      getDsaCases(params).then((d) => setCases(Array.isArray(d) ? d : [])).catch((err) => { toast.error(getErrorMessage(err)); setCases([]); }).finally(() => setLoadingCases(false)),
      getDsaStageSummary(params).then(setStageSummary).catch(() => setStageSummary(null)),
    ]);
  }, [period]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const kpis = [
    { key: 'leads', title: 'Leads Created', icon: UserPlus, color: 'var(--primary)' },
    { key: 'eligibility', title: 'Eligibility Checked', icon: ClipboardCheck, color: 'var(--info)' },
    { key: 'sanctions', title: 'Sanctions', icon: CheckCircle2, color: 'var(--success)' },
    { key: 'disbursements', title: 'Disbursements', icon: Banknote, color: 'var(--warning)' },
  ];

  const stageEntries = stageSummary
    ? STAGE_ORDER.map((label) => ({ label, count: stageSummary[label] || 0 }))
    : [];
  const stageMax = Math.max(1, ...stageEntries.map((s) => s.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map((k, i) => {
          const d = summary?.[k.key];
          return (
            <motion.div key={k.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
              <StatCard
                title={k.title}
                loading={loadingSummary}
                icon={k.icon}
                color={k.color}
                value={d ? <AnimatedNumber value={d.count} /> : '—'}
                subtitle={
                  d ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {formatCompactINR(d.amount)}
                      <TrendBadge pct={d.trend_pct} count={d.trend_count} />
                    </span>
                  ) : undefined
                }
              />
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `1fr ${isTablet ? '280px' : '320px'}`, gap: 20, alignItems: 'start' }}>
        <SectionCard
          title="Cases"
          subtitle="Your pipeline this period"
          delay={0.1}
          actions={
            <button
              onClick={() => navigate('/customers')}
              style={{ background: 'transparent', border: '1px solid var(--outline)', color: 'var(--on-surface)', padding: '6px 12px', borderRadius: 0, fontSize: 12, fontWeight: 600 }}
            >
              View All
            </button>
          }
        >
          {loadingCases ? (
            <TableSkeleton rows={5} columns={5} />
          ) : cases.length === 0 ? (
            <EmptyState icon={Inbox} title="No cases yet" description="No cases were created in this period." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? 560 : '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--outline)' }}>
                    {['Case', 'Customer', 'Lender', 'Amount', 'Stage'].map((h) => (
                      <th key={h} style={{ padding: '10px 20px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c, i) => (
                    <motion.tr
                      key={c.case_id ?? i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                      onClick={() => c.case_id && navigate(`/cases/${c.case_id}`)}
                      style={{ cursor: c.case_id ? 'pointer' : 'default', borderBottom: '1px solid var(--outline)' }}
                      whileHover={{ backgroundColor: 'var(--surface-low)' }}
                    >
                      <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{c.case_ref || c.case_id}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--on-surface)' }}>{c.customer_name || '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--on-muted)' }}>{c.lender || '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{formatCompactINR(c.applied_amount)}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 0, color: stageColor(c.stage), background: `${stageColor(c.stage)}18` }}>
                          {c.stage ? (CASE_STAGE_LABELS[c.stage] || formatStatusLabel(c.stage)) : '—'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title="Quick Actions" delay={0.15}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
              <QuickAction icon={Plus} label="Add New Customer" desc="Start a new case" color="var(--success)" onClick={() => navigate('/customers/add')} delay={0.05} />
              <QuickAction icon={Users} label="Customer List" desc="Browse all customers" color="var(--primary)" onClick={() => navigate('/customers')} delay={0.1} />
              <QuickAction icon={UserCircle} label="My Profile" desc="View your session" color="var(--warning)" onClick={() => navigate('/profile')} delay={0.15} />
              <QuickAction icon={Network} label="View Hierarchy" desc="Explore the org chart" color="var(--info)" onClick={() => navigate('/hierarchy')} delay={0.2} />
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Stage Summary" subtitle="Cases by pipeline stage, this period" delay={0.2}>
        {loadingSummary ? (
          <TableSkeleton rows={4} columns={1} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '18px 28px', padding: 20 }}>
            {stageEntries.map((s, i) => (
              <StageBar key={s.label} label={s.label} count={s.count} pct={(s.count / stageMax) * 100} color="var(--primary)" delay={i * 0.04} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default DsaDashboardView;
