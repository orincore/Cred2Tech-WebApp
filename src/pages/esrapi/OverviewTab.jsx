import React from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { esrApiPortal, apiError } from '../../api/esrApiService';
import { Card, Pill } from '../whitelabel/atoms';
import { Notice, Stat, StatRow, inr, num, useAsync, STATUS_TONE } from './common';

// Everything on this tab is chosen by the server's feature flags (`flag`): the plan, role and account state are never inspected here.
export default function OverviewTab({ flag, goTo }) {
  const { data: me, loading, error } = useAsync(() => esrApiPortal.me(), []);
  if (loading) return <LoadingSpinner />;
  if (error) return <Notice tone="error">{apiError(error, 'Could not load your account')}</Notice>;
  const { account, access, plan, this_month: month, next_steps: steps } = me;

  return (
    <>
      {flag('account.pending') && <Notice tone="info" title="Your account is being set up">Cred2Tech is still activating your account. You will be e-mailed when it is ready.</Notice>}
      {flag('account.suspended') && <Notice tone="warning" title="Your account is suspended">{account.suspended_reason || 'Contact Cred2Tech support to restore access.'} Existing records stay visible; new actions are switched off.</Notice>}
      {flag('account.closed') && <Notice tone="error" title="Your account is closed">API access has ended. Your records stay visible.</Notice>}
      {flag('billing.blocked_notice') && <Notice tone="error" title="Production calls are blocked">An invoice is overdue past its grace period. Pay it from the Billing tab to resume production calls.</Notice>}
      {flag('billing.overdue_notice') && !flag('billing.blocked_notice') && <Notice tone="warning" title="You have an overdue invoice">Pay it from the Billing tab to avoid production calls being blocked.</Notice>}
      {flag('billing.low_balance_warning') && <Notice tone="warning" title="Your balance is low">Your balance is {inr(plan.balance_inr)}, below your alert level of {inr(plan.low_balance_alert_inr)}. Production calls stop when it cannot cover a call.</Notice>}

      <StatRow>
        {flag('billing.balance') && <Stat label="Prepaid balance" value={inr(plan.balance_inr)} sub={`Alert below ${inr(plan.low_balance_alert_inr)}`} tone={flag('billing.low_balance_warning') ? 'warning' : undefined} />}
        {flag('billing.credit_limit') && <Stat label="Credit available" value={inr(plan.available_inr)} sub={`${inr(plan.used_inr)} used of ${inr(plan.credit_limit_inr)}`} />}
        {flag('billing.invoices') && <Stat label="Unpaid invoices" value={num(plan.unpaid_invoices)} sub={plan.unpaid_invoices ? inr(plan.unpaid_total_inr) : 'Nothing due'} tone={flag('billing.overdue_notice') ? 'error' : undefined} />}
        {flag('usage.view') && <Stat label="Production calls this month" value={num(month.production.calls)} sub={`${num(month.production.successful)} successful · ${inr(month.production.charged_inr)} charged`} />}
        {flag('uat.enabled') && <Stat label="Test (UAT) calls this month" value={num(month.uat.calls)} sub={flag('uat.credits') ? `${num(access.uat.credits_remaining)} of ${num(access.uat.credits_total)} free calls left` : undefined} />}
      </StatRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card title="Your account">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
            <dt style={{ color: 'var(--text-tertiary)' }}>Organisation</dt><dd style={{ margin: 0 }}>{me.organisation.name}</dd>
            <dt style={{ color: 'var(--text-tertiary)' }}>GSTIN</dt><dd style={{ margin: 0 }}>{me.organisation.gst_number || 'Not provided (invoices are issued without GST registration)'}</dd>
            <dt style={{ color: 'var(--text-tertiary)' }}>Status</dt><dd style={{ margin: 0 }}><Pill tone={STATUS_TONE[account.status] || 'neutral'}>{account.status}</Pill></dd>
            {flag('uat.enabled') && <><dt style={{ color: 'var(--text-tertiary)' }}>Test access</dt><dd style={{ margin: 0 }}>{num(access.uat.keys)} key(s) · {num(access.uat.ip_addresses)} IP address(es)</dd></>}
            {flag('production.enabled') && <><dt style={{ color: 'var(--text-tertiary)' }}>Production access</dt><dd style={{ margin: 0 }}>{num(access.production.keys)} key(s) · {num(access.production.ip_addresses)} IP address(es)</dd></>}
          </dl>
        </Card>
        {steps && steps.length > 0 && (
          <Card title="Getting started">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'grid', gap: 6 }}>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {flag('keys.view') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo('access')}>Keys &amp; IP addresses</button>}
              {flag('playground.uat') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo('docs')}>API docs</button>}
            </div>
          </Card>
        )}
      </div>
      {flag('logs.view') && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 14 }}>Every call you make is recorded. See them in <Link to="/esr-api/logs">Call log</Link>.</p>}
    </>
  );
}
