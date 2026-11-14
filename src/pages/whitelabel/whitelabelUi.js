// Pure helpers for the white-label admin screens (no React, no browser globals), so they can be tested with node --test.

export const STATUS_META = {
  DRAFT:        { label: 'Draft',        tone: 'neutral', hint: 'Being set up. Not live.' },
  PROVISIONING: { label: 'Setting up',   tone: 'info',    hint: 'Infrastructure is being created.' },
  ACTIVE:       { label: 'Live',         tone: 'success', hint: 'Serving its own site.' },
  SUSPENDED:    { label: 'Suspended',    tone: 'warning', hint: 'Switched off. Its address shows nothing.' },
  FAILED:       { label: 'Needs attention', tone: 'error', hint: 'Setup stopped with an error.' },
  OFFBOARDED:   { label: 'Offboarded',   tone: 'neutral', hint: 'Removed. The address is on hold.' },
};
export const JOB_META = {
  QUEUED:       { label: 'Waiting to start', tone: 'info' },
  RUNNING:      { label: 'Running',          tone: 'info' },
  SUCCEEDED:    { label: 'Completed',        tone: 'success' },
  FAILED:       { label: 'Stopped with an error', tone: 'error' },
  ROLLING_BACK: { label: 'Rolling back',     tone: 'warning' },
  ROLLED_BACK:  { label: 'Rolled back',      tone: 'neutral' },
  CANCELLED:    { label: 'Cancelled',        tone: 'neutral' },
};
export const STEP_STATUS_META = {
  PENDING:     { label: 'Waiting',     tone: 'neutral' },
  RUNNING:     { label: 'In progress', tone: 'info' },
  DONE:        { label: 'Done',        tone: 'success' },
  SKIPPED:     { label: 'Skipped',     tone: 'neutral' },
  FAILED:      { label: 'Failed',      tone: 'error' },
  COMPENSATED: { label: 'Undone',      tone: 'warning' },
};
export const ACTIVE_JOB_STATUSES = ['QUEUED', 'RUNNING', 'ROLLING_BACK'];

// ── subdomain ───────────────────────────────────────────────────────────────
/** A first suggestion for the subdomain from the organisation's name: lowercase letters, digits, single hyphens. */
export function suggestSlug(name, { min = 3, max = 30 } = {}) {
  let s = String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  // drop trailing company-form words ("Pvt Ltd", "LLP", ...), however many are stacked at the end
  for (let prev = ''; prev !== s;) { prev = s; s = s.replace(/-(pvt|private|ltd|limited|llp|inc)$/, ''); }
  if (s.length > max) s = s.slice(0, max).replace(/-+$/g, '');
  return s.length >= min ? s : '';
}

/** Instant, local format check (the server decides reserved names, uniqueness and DNS). Returns an error text or ''. */
export function slugFormatError(raw, { min = 3, max = 30 } = {}) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s.length < min || s.length > max) return `Use ${min} to ${max} characters.`;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s)) return 'Use only lowercase letters, numbers and hyphens, not starting or ending with a hyphen.';
  if (s.includes('--')) return 'Consecutive hyphens are not allowed.';
  if (/^\d+$/.test(s)) return 'The name cannot be only numbers.';
  return '';
}
export const hostFor = (slug, base) => (slug && base ? `${slug}.${base}` : '');

// ── forms ───────────────────────────────────────────────────────────────────
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[^\s@<>]{2,}$/;
export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Client-side check of the organisation details, mirroring the server's rules so errors show before saving. */
export function validateDetails(v, { partial = false } = {}) {
  const e = {};
  const t = (x) => String(x == null ? '' : x).trim();
  if (!partial || 'display_name' in v) { if (t(v.display_name).length < 2) e.display_name = 'Enter the organisation name (at least 2 characters).'; else if (/[<>]/.test(v.display_name)) e.display_name = 'Angle brackets are not allowed.'; }
  if (t(v.contact_email) && !EMAIL.test(t(v.contact_email))) e.contact_email = 'Enter a valid email.';
  if (!partial && !t(v.contact_email)) e.contact_email = 'The administrator email is required: the invite is sent there.';
  if (t(v.contact_mobile) && !/^[6-9]\d{9}$/.test(t(v.contact_mobile))) e.contact_mobile = 'Enter a 10-digit Indian mobile number.';
  if (t(v.pan_number) && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(t(v.pan_number).toUpperCase())) e.pan_number = 'Enter a valid PAN.';
  if (t(v.gst_number) && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(t(v.gst_number).toUpperCase())) e.gst_number = 'Enter a valid GSTIN.';
  if (t(v.pincode) && !/^\d{6}$/.test(t(v.pincode))) e.pincode = 'Enter a 6-digit pincode.';
  return e;
}

/** What the server accepts: blanks become null so a cleared field clears it. */
export function detailsPayload(v, keys) {
  const out = {};
  for (const k of keys) { if (!(k in v)) continue; const val = typeof v[k] === 'string' ? v[k].trim() : v[k]; out[k] = val === '' ? null : val; }
  return out;
}

/** Fields that changed between the saved record and the form (so we PATCH only those). */
export function changedFields(saved, form, keys) {
  const out = {};
  for (const k of keys) { const a = saved[k] == null ? '' : saved[k]; const b = form[k] == null ? '' : form[k]; if (String(a) !== String(b)) out[k] = form[k]; }
  return out;
}

// ── readiness ───────────────────────────────────────────────────────────────
/** What must / should be in place before provisioning. `required` items block the Start button. */
export function readiness(org) {
  const b = org.branding || {}; const assets = org.assets || [];
  const hasLogo = assets.some((a) => a.kind === 'LOGO_LIGHT' || a.kind === 'LOGO_DARK');
  return [
    { key: 'name', label: 'Organisation name', done: !!org.display_name, required: true },
    { key: 'subdomain', label: 'Subdomain reserved', done: !!org.slug, required: true },
    { key: 'admin_email', label: 'Administrator email (the invite goes here)', done: !!org.contact_email, required: true },
    { key: 'logo', label: 'Logo uploaded', done: hasLogo, required: false, hint: 'Without one, the organisation name is shown as text.' },
    { key: 'colour', label: 'Brand colour chosen', done: !!b.primary_color, required: false, hint: 'Otherwise the default Cred2Tech colours are used.' },
    { key: 'support', label: 'Support contact', done: !!(b.support_email || b.support_phone), required: false, hint: 'Shown in emails and on the blocked-device message.' },
  ];
}
export const canProvision = (org) => readiness(org).filter((r) => r.required).every((r) => r.done);

// ── live progress ───────────────────────────────────────────────────────────
/** Incremental Server-Sent-Events parser: feed it the text so far, get the complete events and the unfinished rest. */
export function splitSse(buffer) {
  const events = []; let rest = buffer; let i;
  while ((i = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, i); rest = rest.slice(i + 2);
    let event = 'message'; const data = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;                           // comment / heartbeat
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (!data.length) continue;
    try { events.push({ event, data: JSON.parse(data.join('\n')) }); } catch (e) { /* a broken frame is skipped, never fatal */ }
  }
  return { events, rest };
}

/** Apply one live event to the status snapshot, immediately, before the next refresh confirms it. */
export function applyEvent(snapshot, e) {
  if (!snapshot || !e) return snapshot;
  if (e.type === 'step' && snapshot.steps) {
    const steps = snapshot.steps.map((s) => (s.key === e.step_key ? { ...s, status: e.status, attempts: e.attempts ?? s.attempts, error: e.error ?? (e.status === 'RUNNING' ? null : s.error) } : s));
    const done = steps.filter((s) => s.status === 'DONE' || s.status === 'SKIPPED').length;
    return { ...snapshot, steps, progress: { done, total: steps.length, percent: Math.round((done / steps.length) * 100) } };
  }
  if (e.type === 'job') return { ...snapshot, job: { ...snapshot.job, status: e.status || snapshot.job.status, error: e.error ?? snapshot.job.error } };
  return snapshot;
}

export function jobStage(snapshot) {
  if (!snapshot) return 'none';
  const s = snapshot.job.status;
  if (ACTIVE_JOB_STATUSES.includes(s)) return 'active';
  if (s === 'FAILED') return 'failed';
  if (s === 'SUCCEEDED') return 'done';
  return 'ended';
}

/** Which controls make sense for this job. */
export function allowedActions(snapshot, { provisioningConfigured = true } = {}) {
  if (!snapshot) return { start: provisioningConfigured, retry: false, rollback: false, cancel: false };
  const s = snapshot.job.status; const failed = s === 'FAILED';
  const partlyRolledBack = (snapshot.steps || []).some((x) => x.status === 'COMPENSATED');
  return {
    start: ['ROLLED_BACK', 'CANCELLED'].includes(s) && provisioningConfigured,
    retry: failed && !partlyRolledBack,
    rollback: failed,
    cancel: ['QUEUED', 'RUNNING'].includes(s) && !snapshot.job.cancel_requested,
  };
}

export const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(n % 1048576 ? 1 : 0)} MB` : `${Math.round(n / 1024)} KB`);
export function formatDuration(from, to) {
  if (!from) return '';
  const ms = new Date(to || Date.now()) - new Date(from);
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
