import { useSyncExternalStore } from 'react';
import { setOrgMode, getApiBaseUrl } from '../lib/apiBase';
import {
  DEFAULT_NAME, isOrgCandidateHost, parseList, normalizeBranding, buildTheme, themeCss, brandTitle, brandTitleFrom,
} from './brandingCore';

// Which site is this? Decided once, before the app renders (initBranding), then read synchronously everywhere.
//   status 'main'        the Cred2Tech app: nothing here changes any behaviour
//   status 'org'         a white-label organisation's site: its name, logo, colours, texts
//   status 'unavailable' an org-looking address that is unknown, suspended, or could not be loaded: show a neutral
//                        page, NEVER the Cred2Tech app under someone else's address
//
// Configured at build time (one build serves every org):
//   VITE_WL_BASE_DOMAINS   e.g. "cred2tech.com" (prod) or "dev.cred2tech.com" (dev) or "localhost" (local). Unset
//                          = the feature is OFF and every host is the main app.
//   VITE_MAIN_APP_HOSTS    hosts under the base domain that are the main app, e.g. "app.cred2tech.com,www.cred2tech.com"
const BASE_DOMAINS = parseList(import.meta.env.VITE_WL_BASE_DOMAINS);
const MAIN_HOSTS = parseList(import.meta.env.VITE_MAIN_APP_HOSTS);

let state = { status: 'main', branding: null, theme: null };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const set = (next) => { state = { ...state, ...next }; emit(); };

function applyToDocument(branding, theme) {
  if (theme) {
    let el = document.getElementById('wl-theme');
    if (!el) { el = document.createElement('style'); el.id = 'wl-theme'; document.head.appendChild(el); }
    el.textContent = themeCss(theme);
  }
  document.title = brandTitle('Login', branding.name);
  // The tab icon: the org's favicon, or none. Never the Cred2Tech one.
  document.querySelectorAll('link[rel~="icon"]').forEach((n) => n.parentNode.removeChild(n));
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = branding.favicon || 'data:,';
  document.head.appendChild(link);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', branding.tagline || branding.name);
}

async function fetchBranding(timeoutMs = 4000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/whitelabel/branding', { headers: { Accept: 'application/json' }, cache: 'no-cache', signal: ctl.signal });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { error: true };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { notFound: true };   // a static host answering with index.html
    return { branding: normalizeBranding(await res.json()) };
  } catch (e) { return { error: true }; } finally { clearTimeout(t); }
}

// A customer link (consent / ITR / GST) is always sent from the MAIN app host, never an org's subdomain
// (TRAI/DLT only delivers SMS links on the registered domain). The token names the org instead:
// /SUNBY/CONaBcD1234.k (or /c/...). Only such a link page takes the org's brand; everything else on the
// main host stays the Cred2Tech app.
const LINK_PAGE = /^\/(?:SUNBY|c)\/((?:CON|ITR|GST)[A-Za-z0-9_-]{8}\.[0-9a-z]{1,8})\/?$/;

async function initLinkBranding(token) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(`${getApiBaseUrl()}/whitelabel/link-branding?t=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: ctl.signal });
    if (!res.ok) return;
    const json = await res.json();
    const branding = normalizeBranding(json);
    if (!branding) return;
    // The logo files are served from the org's own host, not from this one.
    const origin = typeof json.origin === 'string' && /^https?:\/\/[a-z0-9.:-]+$/i.test(json.origin) ? json.origin : null;
    const abs = (u) => (u && origin ? `${origin}${u}` : null);
    const withOrigin = { ...branding, logoLight: abs(branding.logoLight), logoDark: abs(branding.logoDark), favicon: abs(branding.favicon) };
    const theme = buildTheme(withOrigin.primary);
    // No setOrgMode(): the API stays where the main app's API is, which is where this link's requests go.
    applyToDocument(withOrigin, theme);
    set({ status: 'org', branding: withOrigin, theme });
  } catch (e) { /* a branding failure never blocks the customer: the page stays on the default brand */ } finally { clearTimeout(t); }
}

/** Call once before rendering. Resolves with the final state. Never rejects. */
export async function initBranding() {
  if (!isOrgCandidateHost(window.location.hostname, { baseDomains: BASE_DOMAINS, mainHosts: MAIN_HOSTS })) {
    const link = LINK_PAGE.exec(window.location.pathname);
    if (link) await initLinkBranding(link[1]);
    return state;                                                       // the main app, exactly as before
  }
  let r = await fetchBranding();
  if (r.error) r = await fetchBranding();                               // one retry for a transient failure
  if (r.branding) {
    const theme = buildTheme(r.branding.primary);
    setOrgMode(true);
    applyToDocument(r.branding, theme);
    set({ status: 'org', branding: r.branding, theme });
  } else {
    set({ status: 'unavailable' });
  }
  return state;
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** React hook: { isOrg, status, name, ... }. */
export function useBranding() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return describe(s);
}

function describe(s) {
  const b = s.branding;
  return {
    status: s.status,
    isOrg: s.status === 'org',
    name: b ? b.name : DEFAULT_NAME,
    poweredBy: !!(b && b.poweredBy),
    tagline: b ? b.tagline : null,
    footerText: b ? b.footerText : null,
    supportEmail: b ? b.supportEmail : null,
    supportPhone: b ? b.supportPhone : null,
    logoLight: b ? b.logoLight : null,
    logoDark: b ? b.logoDark : null,
    placements: b ? b.placements : {},
    /** Should the logo show on this surface? Default yes; an org can switch a surface off. */
    showLogoOn: (surface) => !(b && surface && b.placements && b.placements[surface] === false),
  };
}

// Non-hook accessors for plain modules (document titles, push notifications).
export const getBranding = () => describe(state);
export const brandName = () => (state.branding ? state.branding.name : DEFAULT_NAME);
export const titleFor = (suffix) => brandTitle(suffix, brandName());
export const titleFrom = (title) => brandTitleFrom(title, brandName());
