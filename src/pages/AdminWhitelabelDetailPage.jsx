import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, CheckCircle2, Circle, ClipboardList, History, Palette, Rocket, Settings2, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { whitelabelService, apiError, fieldErrors } from '../api/whitelabelService';
import { Card, Pill, PageFrame } from './whitelabel/atoms';
import OrgDetailsForm, { DETAIL_KEYS } from './whitelabel/OrgDetailsForm';
import BrandingEditor from './whitelabel/BrandingEditor';
import ProvisioningTracker from './whitelabel/ProvisioningTracker';
import SuspendControl from './whitelabel/SuspendControl';
import UsageTab from './whitelabel/UsageTab';
import OverviewAnalytics from './whitelabel/OverviewAnalytics';
import BillingTab from './whitelabel/BillingTab';
import { useStepUp } from './whitelabel/StepUp';
import { STATUS_META, hostFor, readiness, canProvision, validateDetails, detailsPayload, changedFields } from './whitelabel/whitelabelUi';

const TABS = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'details', label: 'Details', icon: Settings2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'setup', label: 'Setup', icon: Rocket },
  { id: 'usage', label: 'Usage', icon: BarChart3, live: true },       // these two read the organisation's own database,
  { id: 'billing', label: 'Billing', icon: Wallet, live: true },      // so they exist only once it is live (or suspended)
  { id: 'activity', label: 'Activity', icon: History },
];

const pick = (o) => Object.fromEntries(DETAIL_KEYS.map((k) => [k, o[k] ?? '']));

const Overview = ({ org, config, go }) => {
  const items = readiness(org);
  const ready = canProvision(org);
  // Consumption charts need the organisation's own database, which exists only once it is live (or suspended).
  const hasData = ['ACTIVE', 'SUSPENDED'].includes(org.status);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    {/* full width; the checklist and the summary sit side by side when there is room (and stack on a narrow screen) */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 18, alignItems: 'start' }}>
      <Card title="Before setup" subtitle="Required items must be done before the site can be built.">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((r) => (
            <li key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              {r.done ? <CheckCircle2 size={16} color="var(--success)" /> : <Circle size={16} color="var(--on-muted)" />}
              <div>
                <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{r.label}</span>
                {!r.required && <span style={{ color: 'var(--on-muted)' }}> (optional)</span>}
                {!r.done && r.hint && <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>{r.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => go('branding')}>Edit branding</button>
          <button className="btn btn-primary btn-sm" style={{ borderRadius: 0 }} disabled={!ready} onClick={() => go('setup')}>Go to setup</button>
        </div>
      </Card>
      <Card title="Summary">
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 18px', fontSize: 13 }}>
          {[['Address', hostFor(org.slug, config?.primary_base_domain)], ['Registered name', org.legal_name], ['Administrator', [org.contact_name, org.contact_email].filter(Boolean).join(' · ')], ['Mobile', org.contact_mobile], ['PAN', org.pan_number], ['GSTIN', org.gst_number]].map(([k, v]) => (
            <React.Fragment key={k}><dt style={{ color: 'var(--on-muted)' }}>{k}</dt><dd style={{ margin: 0, color: 'var(--on-surface)' }}>{v || '—'}</dd></React.Fragment>
          ))}
        </dl>
      </Card>
    </div>
    {hasData && <OverviewAnalytics org={org} />}
    </div>
  );
};

const Details = ({ org, stepUp, onSaved }) => {
  const [values, setValues] = useState(() => pick(org));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const locked = !['DRAFT', 'FAILED', 'ACTIVE', 'SUSPENDED'].includes(org.status);
  useEffect(() => { setValues(pick(org)); }, [org.id, org.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    const errs = validateDetails(values); setErrors(errs);
    if (Object.keys(errs).length) { toast.error('Please fix the highlighted fields'); return; }
    const diff = changedFields(pick(org), values, DETAIL_KEYS);
    if (!Object.keys(diff).length) { toast('Nothing changed'); return; }
    setSaving(true);
    try {
      const updated = await stepUp.run((headers) => whitelabelService.update(org.id, detailsPayload(diff, Object.keys(diff)), headers));
      toast.success('Details saved'); onSaved(updated);
    } catch (err) {
      if (err.cancelled) return;
      setErrors(fieldErrors(err)); toast.error(apiError(err, 'Could not save'));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card title="Organisation and administrator" subtitle="The subdomain cannot be changed here.">
        <OrgDetailsForm values={values} onChange={setValues} errors={errors} disabled={locked} />
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || locked} style={{ borderRadius: 0 }}>{saving ? <LoadingSpinner size={14} /> : 'Save changes'}</button>
      </div>
    </form>
  );
};

// `version` changes whenever the organisation is saved, so a suspend/resume/edit made on this very screen shows up at once.
const Activity = ({ orgId, version }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => { whitelabelService.audit(orgId).then(setRows).catch((e) => { toast.error(apiError(e, 'Could not load activity')); setRows([]); }); }, [orgId, version]);
  if (!rows) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={26} /></div>;
  if (!rows.length) return <EmptyState icon={History} title="No activity yet" description="Changes to this organisation are recorded here." />;
  return (
    <Card title="Activity" subtitle="Every change, newest first.">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, i) => (
          <li key={r.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, borderBottom: '1px solid var(--outline)', paddingBottom: 8 }}>
            <span style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{String(r.action || r.event || '').replace(/[._]/g, ' ')}</span>
            <span style={{ color: 'var(--on-muted)', whiteSpace: 'nowrap' }}>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : ''}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const AdminWhitelabelDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stepUp = useStepUp();
  const [org, setOrg] = useState(null);
  const [config, setConfig] = useState(null);
  const [missing, setMissing] = useState(false);
  const hasData = org && (org.status === 'ACTIVE' || org.status === 'SUSPENDED');
  const tabs = TABS.filter((t) => !t.live || hasData);
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const go = (t) => setParams({ tab: t }, { replace: true });
  const [unpaid, setUnpaid] = useState([]);
  useEffect(() => {
    if (!hasData) { setUnpaid([]); return undefined; }
    let live = true;
    whitelabelService.platformFee(id).then((f) => { if (live) setUnpaid(f.unpaid_periods || []); }).catch(() => {});
    return () => { live = false; };
  }, [id, hasData, org?.updated_at, tab]);

  const reload = useCallback(async () => {
    try { setOrg(await whitelabelService.get(id)); }
    catch (err) { if (err?.response?.status === 404) setMissing(true); else toast.error(apiError(err, 'Could not load the organisation')); }
  }, [id]);
  useEffect(() => { reload(); whitelabelService.config().then(setConfig).catch(() => {}); }, [reload]);

  const changed = useMemo(() => (o) => (o && o.id ? setOrg((prev) => ({ ...prev, ...o })) : reload()), [reload]);

  if (missing) return <EmptyState icon={Palette} title="Organisation not found" description="It may have been removed." action={<button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate('/admin/whitelabel')}>Back to partners</button>} />;
  if (!org || !config) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={30} /></div>;

  const meta = STATUS_META[org.status];
  return (
    <PageFrame icon={Palette} title={org.display_name} subtitle={hostFor(org.slug, config.primary_base_domain)}
      back={<Link to="/admin/whitelabel" aria-label="Back to partners" style={{ display: 'flex', color: 'var(--on-muted)' }}><ArrowLeft size={18} /></Link>}
      actions={<><Pill tone={meta?.tone} title={meta?.hint}>{meta?.label || org.status}</Pill><SuspendControl org={org} stepUp={stepUp} onChanged={changed} /></>}
      tabs={tabs} tab={tab} onTab={go}>
      {org.status === 'SUSPENDED' && (
        <p role="status" style={{ margin: '0 0 16px', padding: '10px 12px', fontSize: 13, background: 'var(--warning-bg)', color: 'var(--text-primary)' }}>
          This organisation is suspended. Its site is offline for every user and its background work is paused. Nothing has been deleted. Use Resume to bring it back.
        </p>
      )}
      {tab === 'overview' && <Overview org={org} config={config} go={go} />}
      {tab === 'details' && <Details org={org} stepUp={stepUp} onSaved={changed} />}
      {tab === 'branding' && <BrandingEditor org={org} config={config} stepUp={stepUp} onChanged={changed} />}
      {tab === 'setup' && <ProvisioningTracker org={org} config={config} stepUp={stepUp} onOrgChanged={changed} />}
      {unpaid.length > 0 && tab !== 'billing' && (
        <p role="status" style={{ margin: '0 0 16px', padding: '10px 12px', fontSize: 13, background: 'var(--warning-bg)', color: 'var(--text-primary)' }}>
          The monthly platform fee is unpaid for {unpaid.length} month{unpaid.length === 1 ? '' : 's'} because the wallet is short of credits. <button type="button" onClick={() => go('billing')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Open billing</button>
        </p>
      )}
      {tab === 'usage' && <UsageTab org={org} onOrgChanged={changed} />}
      {tab === 'billing' && <BillingTab org={org} stepUp={stepUp} onOrgChanged={changed} />}
      {tab === 'activity' && <Activity orgId={org.id} version={`${org.status}|${org.updated_at}`} />}
      {stepUp.modal}
    </PageFrame>
  );
};

export default AdminWhitelabelDetailPage;
