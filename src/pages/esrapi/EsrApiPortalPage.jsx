import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, CreditCard, FileSearch, KeyRound, LayoutDashboard, Play, Plug, Users } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import NotificationBell from '../../components/notifications/NotificationBell';
import useEsrApiFeatures from '../../hooks/useEsrApiFeatures';
import { PageFrame } from '../whitelabel/atoms';
import { Notice, Sharp } from './common';
import OverviewTab from './OverviewTab';
import AccessTab from './AccessTab';
import LogsTab from './LogsTab';
import UsageTab from './UsageTab';
import BillingTab from './BillingTab';
import TeamTab from './TeamTab';
import DocsTab from './DocsTab';
import PlaygroundTab from './PlaygroundTab';

// The ESR API client dashboard. The set of tabs, and everything inside them, is decided by the server's feature flags (useEsrApiFeatures):
// this page never looks at the billing plan, the user's role or the account status itself.
const TABS = [
  { id: 'overview', label: 'Overview', subtitle: 'Your account at a glance', icon: LayoutDashboard, show: () => true, Component: OverviewTab },
  { id: 'access', label: 'Keys & IP addresses', subtitle: 'API keys and the addresses allowed to call', icon: KeyRound, show: (f) => f('keys.view') || f('ip.view'), Component: AccessTab },
  { id: 'logs', label: 'Call log', subtitle: 'Every call made with your keys', icon: FileSearch, show: (f) => f('logs.view'), Component: LogsTab },
  { id: 'usage', label: 'Usage', subtitle: 'Calls, success rate and spend over time', icon: BarChart3, show: (f) => f('usage.view'), Component: UsageTab },
  { id: 'billing', label: 'Billing', subtitle: 'Balance, payments, invoices and statement', icon: CreditCard, show: (f) => f('billing.balance') || f('billing.credit_limit') || f('billing.invoices') || f('billing.ledger'), Component: BillingTab },
  { id: 'team', label: 'Team', subtitle: 'People who can sign in to this account', icon: Users, show: (f) => f('team.view'), Component: TeamTab },
  { id: 'docs', label: 'API docs', subtitle: 'How to call the API', icon: BookOpen, show: () => true, Component: DocsTab },
  { id: 'playground', label: 'Playground', subtitle: 'Try a request from your browser', icon: Play, show: () => true, Component: PlaygroundTab },
];

export default function EsrApiPortalPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { flag, loading, error, reload } = useEsrApiFeatures();

  // The notification bell (opens the app-wide panel, which shows admin announcements sent to API clients) sits in every header of this dashboard.
  const bell = <NotificationBell />;
  if (loading) return <PageFrame icon={Plug} title="ESR API" subtitle="Eligibility as a service" actions={bell}><LoadingSpinner /></PageFrame>;
  if (error) return <PageFrame icon={Plug} title="ESR API" subtitle="Eligibility as a service" actions={bell}><Notice tone="error">{error}</Notice></PageFrame>;

  const visible = TABS.filter((t) => t.show(flag));
  const current = visible.find((t) => t.id === tab) || visible[0];
  const goTo = (id) => navigate(id === 'overview' ? '/esr-api' : `/esr-api/${id}`);
  const Current = current.Component;

  // The sections are in the sidebar now (constants/navItems.js, gated by the same flags), so the page has no tab bar: its header names the section.
  return (
    <PageFrame icon={current.icon} title={current.label} subtitle={current.subtitle} actions={bell}>
      <Sharp><Current flag={flag} goTo={goTo} reloadFeatures={reload} /></Sharp>
    </PageFrame>
  );
}
