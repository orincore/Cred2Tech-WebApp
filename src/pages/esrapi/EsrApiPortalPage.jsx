import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, CreditCard, FileSearch, KeyRound, LayoutDashboard, Plug, Users } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useEsrApiFeatures from '../../hooks/useEsrApiFeatures';
import { PageFrame } from '../whitelabel/atoms';
import { Notice, Sharp } from './common';
import OverviewTab from './OverviewTab';
import AccessTab from './AccessTab';
import LogsTab from './LogsTab';
import UsageTab from './UsageTab';
import BillingTab from './BillingTab';
import TeamTab from './TeamTab';

// The ESR API client dashboard. The set of tabs, and everything inside them, is decided by the server's feature flags (useEsrApiFeatures):
// this page never looks at the billing plan, the user's role or the account status itself.
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: () => true, Component: OverviewTab },
  { id: 'access', label: 'Keys & IP addresses', icon: KeyRound, show: (f) => f('keys.view') || f('ip.view'), Component: AccessTab },
  { id: 'logs', label: 'Call log', icon: FileSearch, show: (f) => f('logs.view'), Component: LogsTab },
  { id: 'usage', label: 'Usage', icon: BarChart3, show: (f) => f('usage.view'), Component: UsageTab },
  { id: 'billing', label: 'Billing', icon: CreditCard, show: (f) => f('billing.balance') || f('billing.credit_limit') || f('billing.invoices') || f('billing.ledger'), Component: BillingTab },
  { id: 'team', label: 'Team', icon: Users, show: (f) => f('team.view'), Component: TeamTab },
];

export default function EsrApiPortalPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { flag, loading, error, reload } = useEsrApiFeatures();

  if (loading) return <PageFrame icon={Plug} title="ESR API" subtitle="Eligibility as a service"><LoadingSpinner /></PageFrame>;
  if (error) return <PageFrame icon={Plug} title="ESR API" subtitle="Eligibility as a service"><Notice tone="error">{error}</Notice></PageFrame>;

  const visible = TABS.filter((t) => t.show(flag));
  const current = visible.find((t) => t.id === tab) || visible[0];
  const goTo = (id) => navigate(id === 'overview' ? '/esr-api' : `/esr-api/${id}`);
  const Current = current.Component;

  return (
    <PageFrame icon={Plug} title="ESR API" subtitle="Eligibility as a service for your own systems"
      tabs={visible.map(({ id, label, icon }) => ({ id, label, icon }))} tab={current.id} onTab={goTo}>
      <Sharp><Current flag={flag} goTo={goTo} reloadFeatures={reload} /></Sharp>
    </PageFrame>
  );
}
