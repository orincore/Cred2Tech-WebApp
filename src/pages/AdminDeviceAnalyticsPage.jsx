import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Monitor, Smartphone, Tablet, Users, Clock, Activity, Download, RefreshCw, Info } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { LineChart, BarChart, DonutChart, ChartCard, ChartGrid } from '../components/charts/SvgCharts';
import { deviceAnalyticsService } from '../api/deviceAnalyticsService';

// Super Admin: who uses Cred2Tech on desktop, mobile and tablet, which OS / browser / screen width, and how long they
// really use it. Numbers come from the usage heartbeat (src/lib/usageTracker.js) and, for history before it existed, from
// login records. See the "How to read this page" section at the bottom for the exact definitions.

const DEVICE = {
  DESKTOP: { label: 'Desktop', color: 'var(--primary)', icon: Monitor },
  MOBILE: { label: 'Mobile', color: 'var(--success)', icon: Smartphone },
  TABLET: { label: 'Tablet', color: 'var(--warning)', icon: Tablet },
  UNKNOWN: { label: 'Unknown', color: 'var(--on-muted)', icon: Monitor },
};
const GROUPS = [
  { value: 'all', label: 'Everyone' },
  { value: 'staff', label: 'Partners & staff' },
  { value: 'msme', label: 'MSME customers' },
];
const PRESETS = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }];
const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin', CRED2TECH_MEMBER: 'Cred2Tech Member', DSA_ADMIN: 'Sourcing Partner Admin', DSA_MEMBER: 'Sourcing Partner Member',
  SUB_DSA: 'Sub-Sourcing Partner', MSME_CUSTOMER: 'MSME Customer', API_CLIENT_ADMIN: 'API Client Admin', API_CLIENT_MEMBER: 'API Client Member',
};

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const pct = (x) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');

/** 2h 14m / 5m 30s / 42s */
const duration = (sec) => {
  const s = Math.round(Number(sec) || 0);
  if (s <= 0) return '0s';
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return r && m < 10 ? `${m}m ${r}s` : `${m}m`;
  return `${r}s`;
};
const peopleText = (n) => `${num(n)} ${Number(n) === 1 ? 'person' : 'people'}`;
// Whole numbers only on a count axis (a tick of 0.5 people would be nonsense and rounds to a repeated label).
const wholeTick = (v) => (Number.isInteger(v) ? String(v) : '');
// Daily screen time is drawn in hours, or in minutes while the busiest day is under two hours, so small numbers stay readable.
const timeUnit = (days) => {
  const max = Math.max(0, ...days.map((d) => d.desktop_seconds + d.mobile_seconds + d.tablet_seconds));
  return max < 7200 ? { div: 60, short: 'm', label: 'minutes' } : { div: 3600, short: 'h', label: 'hours' };
};
const dayLabel = (d) => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-');

const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => { const f = () => setM(window.innerWidth <= 768); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return m;
};

const Seg = ({ value, onChange, options, label }) => (
  <div role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--outline)', background: 'var(--surface)', maxWidth: '100%', overflowX: 'auto' }}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
          style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: on ? 'var(--primary)' : 'transparent', color: on ? '#fff' : 'var(--on-surface)' }}>
          {o.label}
        </button>
      );
    })}
  </div>
);

const Share = ({ value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
    <div style={{ flex: 1, height: 6, background: 'var(--surface-low)', minWidth: 50 }}><div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', background: color || 'var(--primary)' }} /></div>
    <span style={{ fontSize: 12, fontWeight: 700, width: 38, textAlign: 'right' }}>{pct(value)}</span>
  </div>
);

const Table = ({ columns, rows, empty = 'No data in this period.' }) => (
  <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
    <table>
      <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.label}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 ? <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--on-muted)', padding: 20 }}>{empty}</td></tr>
          : rows.map((r, i) => (
            <tr key={r._key || i}>{columns.map((c) => <td key={c.key} data-label={c.label} style={{ textAlign: c.align || 'left', whiteSpace: c.nowrap ? 'nowrap' : undefined }}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
          ))}
      </tbody>
    </table>
  </div>
);

const Section = ({ title, hint, children }) => (
  <div className="card" style={{ padding: 0, borderRadius: 0, marginBottom: 16, overflow: 'hidden' }}>
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--outline)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
    </div>
    {children}
  </div>
);

const Skeleton = () => (
  <div aria-busy="true" aria-label="Loading device analytics">
    <ChartGrid min={200}>{Array.from({ length: 6 }).map((_, i) => <StatCard key={i} loading />)}</ChartGrid>
    <div className="skeleton" style={{ height: 260, marginBottom: 16 }} />
    <div className="skeleton" style={{ height: 260 }} />
  </div>
);

const DeviceChip = ({ c }) => {
  const d = DEVICE[c] || DEVICE.UNKNOWN; const Icon = d.icon;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: d.color }}><Icon size={13} />{d.label}</span>;
};

const AdminDeviceAnalyticsPage = () => {
  const isMobile = useIsMobile();
  const [group, setGroup] = useState('all');
  const [to, setTo] = useState(istToday());
  const [from, setFrom] = useState(addDays(istToday(), -29));
  const [preset, setPreset] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await deviceAnalyticsService.report({ from, to, group })); }
    catch (e) {
      const msg = e.response?.data?.error || 'Could not load device analytics.';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  }, [from, to, group]);
  useEffect(() => { load(); }, [load]);

  const pickPreset = (days) => { setPreset(days); setTo(istToday()); setFrom(addDays(istToday(), -(days - 1))); };
  const customDates = (f, t) => { setPreset(null); setFrom(f); setTo(t); };
  const rangeOk = from && to && from <= to;

  const deviceRows = data?.by_device || [];
  const dev = useMemo(() => Object.fromEntries(deviceRows.map((d) => [d.device_class, d])), [deviceRows]);
  const days = data?.timeseries || [];
  const labels = days.map((d) => dayLabel(d.date));
  const unit = timeUnit(days);
  const t = data?.totals;
  const hasUsage = !!t && t.sessions > 0;
  const trackingStartedAfterRange = data?.tracking_since && data.tracking_since.slice(0, 10) > from;

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Device', 'Users who used it', 'Main-device users', 'Sessions', 'Screen time (s)', 'Share of screen time', 'Avg session (s)', 'Avg per user (s)']];
    deviceRows.forEach((d) => rows.push([DEVICE[d.device_class].label, d.users, d.main_device_users, d.sessions, d.active_seconds, d.share_of_screen_time.toFixed(4), Math.round(d.avg_session_seconds), Math.round(d.avg_seconds_per_user)]));
    rows.push([], ['Date', 'Active users', 'Desktop users', 'Mobile users', 'Tablet users', 'Desktop seconds', 'Mobile seconds', 'Tablet seconds']);
    days.forEach((d) => rows.push([d.date, d.users, d.desktop_users, d.mobile_users, d.tablet_users, d.desktop_seconds, d.mobile_seconds, d.tablet_seconds]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `device-analytics_${from}_to_${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Device Analytics"
          subtitle="Who uses Cred2Tech on desktop, mobile and tablet, and for how long"
          compact={isMobile}
          actions={<button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!data || loading}><Download size={14} /> Export CSV</button>}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 24px' : '0 24px 32px' }}>
        {/* Filters */}
        <div className="card" style={{ padding: 12, borderRadius: 0, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Seg label="Period" value={preset} onChange={pickPreset} options={PRESETS.map((p) => ({ value: p.days, label: p.label }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <input type="date" className="form-control" aria-label="From date" value={from} max={to} onChange={(e) => customDates(e.target.value, to)} style={{ width: 150 }} />
            <span style={{ color: 'var(--on-muted)', fontSize: 12 }}>to</span>
            <input type="date" className="form-control" aria-label="To date" value={to} min={from} max={istToday()} onChange={(e) => customDates(from, e.target.value)} style={{ width: 150 }} />
          </div>
          <Seg label="Who" value={group} onChange={setGroup} options={GROUPS} />
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading || !rangeOk} style={{ marginLeft: isMobile ? 0 : 'auto' }}><RefreshCw size={14} className={loading ? 'icon-loading' : ''} /> Refresh</button>
        </div>
        {!rangeOk && <div className="notice notice-warning" style={{ marginBottom: 14 }}>Choose a start date that is not after the end date.</div>}

        {error && !loading && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: 14, justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span><button className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
          </div>
        )}

        {loading && !data ? <Skeleton /> : data && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {data.tracking_since == null ? (
              <div className="notice notice-info" style={{ marginBottom: 14 }}><Info size={16} style={{ flexShrink: 0 }} />
                <span>Screen time and device tracking has not recorded anything yet. It starts the first time someone uses the app after this update is live. Login records below cover earlier history.</span></div>
            ) : trackingStartedAfterRange && (
              <div className="notice notice-info" style={{ marginBottom: 14 }}><Info size={16} style={{ flexShrink: 0 }} />
                <span>Screen time tracking began on <b>{new Date(data.tracking_since).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</b>. Days before that have no screen time; see "Login records" for their device mix.</span></div>
            )}

            {/* Headline numbers */}
            <ChartGrid min={isMobile ? 150 : 190}>
              <StatCard title="People measured" value={num(t.users)} subtitle={`${num(t.sessions)} visits`} icon={Users} color="var(--primary)" />
              <StatCard title="Total screen time" value={duration(t.active_seconds)} subtitle="Foreground and in use" icon={Clock} color="var(--success)" />
              <StatCard title="Avg per visit" value={duration(t.avg_session_seconds)} subtitle="Time in use per visit" icon={Activity} color="var(--warning)" />
              <StatCard title="Avg per person per day" value={duration(t.avg_seconds_per_active_day)} subtitle="On days they used it" icon={Clock} color="var(--primary)" />
              <StatCard title="Installed-app users" value={num(t.installed_app_users)} subtitle={t.users ? `${pct(t.installed_app_users / t.users)} of people` : ' '} icon={Smartphone} color="var(--info)" />
            </ChartGrid>

            {!hasUsage ? (
              <div className="card" style={{ borderRadius: 0, marginBottom: 16 }}><EmptyState icon={Activity} title="No usage recorded in this period" description="Pick a longer period, or check back after people have used the app." /></div>
            ) : (
              <>
                {/* Desktop vs mobile vs tablet */}
                <ChartGrid min={isMobile ? 280 : 400}>
                  <ChartCard title="Main device of each person" hint="Each person is counted once, under the device they spent the most screen time on.">
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <DonutChart
                        ariaLabel="People by main device"
                        centerLabel={t.users === 1 ? 'person' : 'people'} centerValue={num(t.users)} format={peopleText}
                        slices={deviceRows.map((d) => ({ name: DEVICE[d.device_class].label, value: d.main_device_users, color: DEVICE[d.device_class].color }))}
                      />
                    </div>
                  </ChartCard>
                  <ChartCard title="Screen time by device" hint="Share of all the time the app was in use.">
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <DonutChart
                        ariaLabel="Screen time by device"
                        centerLabel="total" centerValue={duration(t.active_seconds)} format={(v) => duration(v)}
                        slices={deviceRows.map((d) => ({ name: DEVICE[d.device_class].label, value: d.active_seconds, color: DEVICE[d.device_class].color }))}
                      />
                    </div>
                  </ChartCard>
                </ChartGrid>

                <Section title="Desktop, mobile and tablet" hint="'Used it' counts everyone who used that device at least once, so a person on two devices appears in both rows. 'Main device' counts each person once.">
                  <Table
                    columns={[
                      { key: 'device', label: 'Device', render: (r) => <DeviceChip c={r.device_class} /> },
                      { key: 'main', label: 'Main device of', align: 'right', render: (r) => `${num(r.main_device_users)} (${pct(r.share_of_users)})` },
                      { key: 'users', label: 'Used it', align: 'right', render: (r) => num(r.users) },
                      { key: 'sessions', label: 'Visits', align: 'right', render: (r) => num(r.sessions) },
                      { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) },
                      { key: 'share', label: 'Share of time', render: (r) => <Share value={r.share_of_screen_time} color={DEVICE[r.device_class].color} /> },
                      { key: 'avgv', label: 'Avg per visit', align: 'right', nowrap: true, render: (r) => duration(r.avg_session_seconds) },
                      { key: 'avgu', label: 'Avg per person', align: 'right', nowrap: true, render: (r) => duration(r.avg_seconds_per_user) },
                    ]}
                    rows={deviceRows.map((d) => ({ ...d, _key: d.device_class }))}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '12px 14px', borderTop: '1px solid var(--outline)', fontSize: 12, color: 'var(--on-muted)' }}>
                    <span><b style={{ color: 'var(--on-surface)' }}>{num(data.user_mix.desktop_only)}</b> use desktop only</span>
                    <span><b style={{ color: 'var(--on-surface)' }}>{num(data.user_mix.mobile_only)}</b> use mobile only</span>
                    <span><b style={{ color: 'var(--on-surface)' }}>{num(data.user_mix.tablet_only)}</b> use tablet only</span>
                    <span><b style={{ color: 'var(--on-surface)' }}>{num(data.user_mix.more_than_one)}</b> use more than one kind of device</span>
                  </div>
                </Section>

                {/* Trend */}
                <ChartGrid min={isMobile ? 280 : 440}>
                  <ChartCard title="People active each day" hint="Distinct people who used the app that day, by device (Indian time).">
                    <LineChart
                      ariaLabel="Daily active people by device" labels={labels} format={wholeTick} tipFormat={peopleText}
                      series={[
                        { name: 'Desktop', color: DEVICE.DESKTOP.color, values: days.map((d) => d.desktop_users) },
                        { name: 'Mobile', color: DEVICE.MOBILE.color, values: days.map((d) => d.mobile_users) },
                        { name: 'Tablet', color: DEVICE.TABLET.color, values: days.map((d) => d.tablet_users) },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title="Screen time each day" hint={`${unit.label[0].toUpperCase()}${unit.label.slice(1)} the app was in use, by device.`}>
                    <BarChart
                      stacked ariaLabel="Daily screen time by device" labels={labels}
                      format={(v) => `${Number(v.toFixed(1))}${unit.short}`} tipFormat={(v) => duration(v * unit.div)}
                      series={[
                        { name: 'Desktop', color: DEVICE.DESKTOP.color, values: days.map((d) => d.desktop_seconds / unit.div) },
                        { name: 'Mobile', color: DEVICE.MOBILE.color, values: days.map((d) => d.mobile_seconds / unit.div) },
                        { name: 'Tablet', color: DEVICE.TABLET.color, values: days.map((d) => d.tablet_seconds / unit.div) },
                      ]}
                    />
                  </ChartCard>
                </ChartGrid>

                {/* Operating system, browser, installed app, screen width */}
                <ChartGrid min={isMobile ? 280 : 400}>
                  <Section title="Operating system">
                    <Table columns={[{ key: 'name', label: 'System' }, { key: 'users', label: 'People', align: 'right', render: (r) => num(r.users) }, { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) }, { key: 'share', label: 'Share of time', render: (r) => <Share value={r.share_of_screen_time} /> }]} rows={data.by_os.map((r) => ({ ...r, _key: r.name }))} />
                  </Section>
                  <Section title="Browser">
                    <Table columns={[{ key: 'name', label: 'Browser' }, { key: 'users', label: 'People', align: 'right', render: (r) => num(r.users) }, { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) }, { key: 'share', label: 'Share of time', render: (r) => <Share value={r.share_of_screen_time} /> }]} rows={data.by_browser.map((r) => ({ ...r, _key: r.name }))} />
                  </Section>
                  <Section title="Installed app or browser tab" hint="Visits from the app installed on a phone or computer, compared with a normal browser tab.">
                    <Table columns={[{ key: 'name', label: 'How it was opened' }, { key: 'users', label: 'People', align: 'right', render: (r) => num(r.users) }, { key: 'sessions', label: 'Visits', align: 'right', render: (r) => num(r.sessions) }, { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) }, { key: 'share', label: 'Share of time', render: (r) => <Share value={r.share_of_screen_time} /> }]} rows={data.by_install.map((r) => ({ ...r, _key: r.name }))} />
                  </Section>
                  <Section title="Screen width" hint="Browser window width when the visit started.">
                    <Table columns={[{ key: 'label', label: 'Width' }, { key: 'users', label: 'People', align: 'right', render: (r) => num(r.users) }, { key: 'sessions', label: 'Visits', align: 'right', render: (r) => num(r.sessions) }, { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) }]} rows={data.by_screen.map((r) => ({ ...r, _key: r.key }))} />
                  </Section>
                </ChartGrid>

                <Section title="By account type" hint="Main device is the device each person used most.">
                  <Table
                    columns={[
                      { key: 'role', label: 'Account type', render: (r) => ROLE_LABEL[r.role] || r.role },
                      { key: 'users', label: 'People', align: 'right', render: (r) => num(r.users) },
                      { key: 'desk', label: 'Main device: desktop', align: 'right', render: (r) => num(r.main_device.DESKTOP) },
                      { key: 'mob', label: 'Mobile', align: 'right', render: (r) => num(r.main_device.MOBILE) },
                      { key: 'tab', label: 'Tablet', align: 'right', render: (r) => num(r.main_device.TABLET) },
                      { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) },
                    ]}
                    rows={data.by_role.map((r) => ({ ...r, _key: r.role }))}
                  />
                </Section>

                <Section title="Most active people" hint={`The ${data.top_users.length} people with the most screen time in this period.`}>
                  <Table
                    columns={[
                      { key: 'name', label: 'Person', render: (r) => <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{r.email}{r.org_name ? ` · ${r.org_name}` : ''}</div></div> },
                      { key: 'role', label: 'Account type', render: (r) => ROLE_LABEL[r.role] || r.role },
                      { key: 'main', label: 'Main device', render: (r) => <DeviceChip c={r.main_device} /> },
                      { key: 'dev', label: 'Devices used', render: (r) => r.devices.map((c) => (DEVICE[c] || DEVICE.UNKNOWN).label).join(', ') },
                      { key: 'time', label: 'Screen time', align: 'right', nowrap: true, render: (r) => duration(r.active_seconds) },
                      { key: 'days', label: 'Active days', align: 'right', render: (r) => num(r.active_days) },
                      { key: 'sessions', label: 'Visits', align: 'right', render: (r) => num(r.sessions) },
                      { key: 'seen', label: 'Last seen', nowrap: true, render: (r) => dateTime(r.last_seen) },
                    ]}
                    rows={data.top_users.map((r) => ({ ...r, _key: `${r.org_id ?? 'm'}:${r.user_id}` }))}
                  />
                </Section>
              </>
            )}

            {/* History from login records, available even for days before screen-time tracking began */}
            <Section title="Login records" hint="Devices people signed in from during this period, from the login records on file. Based on the browser's own description only, with no screen time. A newer iPad can appear as a desktop here; the sections above correct for that.">
              <Table
                columns={[
                  { key: 'device', label: 'Device', render: (r) => <DeviceChip c={r.device_class} /> },
                  { key: 'users', label: 'People who signed in', align: 'right', render: (r) => num(r.users) },
                  { key: 'logins', label: 'Sign-ins', align: 'right', render: (r) => num(r.logins) },
                  { key: 'share', label: 'Share of people', render: (r) => <Share value={data.login_records.users ? r.users / data.login_records.users : 0} color={DEVICE[r.device_class].color} /> },
                ]}
                rows={data.login_records.by_device.map((r) => ({ ...r, _key: r.device_class }))}
                empty="No sign-ins on file for this period."
              />
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--outline)', fontSize: 12, color: 'var(--on-muted)' }}>
                {num(data.login_records.users)} people, {num(data.login_records.logins)} sign-ins in this period.
              </div>
            </Section>

            <Section title="How to read this page">
              <ul style={{ margin: 0, padding: '12px 14px 12px 30px', fontSize: 12, lineHeight: 1.7, color: 'var(--on-muted)' }}>
                <li><b style={{ color: 'var(--on-surface)' }}>Screen time</b> is the time the app was open in the foreground <i>and</i> the person touched, clicked, typed or scrolled within the last 60 seconds. A tab left open in the background or a phone left on a table adds nothing.</li>
                <li><b style={{ color: 'var(--on-surface)' }}>A visit</b> is one browser tab or one launch of the installed app. A new visit starts after 30 minutes without activity and at midnight Indian time, so time is always counted on the right day.</li>
                <li><b style={{ color: 'var(--on-surface)' }}>Accuracy:</b> the server never accepts more time than has actually passed since the visit began, and ignores repeated or out-of-order reports, so numbers cannot be inflated or counted twice. Screen time is only available from the day tracking started; nothing is estimated for earlier days.</li>
                <li><b style={{ color: 'var(--on-surface)' }}>Privacy:</b> only the kind of device, operating system, browser, screen size and seconds are stored. No page, URL, content or IP address is recorded.</li>
                <li>All days are Indian time (IST). {data.databases > 1 ? `Includes ${data.databases - 1} white-label organisation database${data.databases > 2 ? 's' : ''}.` : ''}</li>
              </ul>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeviceAnalyticsPage;
