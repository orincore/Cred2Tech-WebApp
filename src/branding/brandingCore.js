// Pure branding logic (no React, no browser globals), so it can be tested directly with node --test.
// See docs/Whitelabel.md Phase 5 in the backend repo.

export const DEFAULT_NAME = 'Cred2Tech';
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Is this hostname a candidate for a white-label org site (exactly one label under a configured base domain)? */
export function isOrgCandidateHost(hostname, { baseDomains = [], mainHosts = [] } = {}) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h || mainHosts.map((m) => m.toLowerCase()).includes(h)) return false;
  return baseDomains.some((raw) => {
    const base = String(raw).trim().toLowerCase().replace(/^\.+|\.+$/g, '');
    if (!base || !h.endsWith(`.${base}`)) return false;
    const label = h.slice(0, -(base.length + 1));
    return label.length > 0 && !label.includes('.');
  });
}

export function parseList(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Validate the public branding payload from the API. Returns a safe object, or null if it is unusable. */
export function normalizeBranding(json) {
  if (!json || typeof json !== 'object' || typeof json.name !== 'string' || !json.name.trim()) return null;
  const color = (c) => (typeof c === 'string' && HEX.test(c) ? c : null);
  const text = (t, max) => (typeof t === 'string' && t.trim() ? t.trim().slice(0, max) : null);
  const url = (u) => (typeof u === 'string' && /^\/api\/whitelabel\/assets\/[A-Z_]+\?v=[0-9a-f]{8}$/.test(u) ? u : null);
  const assets = json.assets && typeof json.assets === 'object' ? json.assets : {};
  return {
    name: json.name.trim().slice(0, 80),
    poweredBy: json.powered_by_visible === true,
    primary: color(json.theme && json.theme.primary_color),
    tagline: text(json.tagline, 120),
    footerText: text(json.footer_text, 200),
    supportEmail: text(json.support_email, 120),
    supportPhone: text(json.support_phone, 30),
    placements: json.logo_placements && typeof json.logo_placements === 'object' ? { ...json.logo_placements } : {},
    logoLight: url(assets.LOGO_LIGHT && assets.LOGO_LIGHT.url),
    logoDark: url(assets.LOGO_DARK && assets.LOGO_DARK.url),
    favicon: url(assets.FAVICON && assets.FAVICON.url),
  };
}

// ── colour maths ─────────────────────────────────────────────────────────────
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255; const g = parseInt(hex.slice(3, 5), 16) / 255; const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2; let h = 0; let s = 0;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  const S = s / 100; const L = l / 100; const k = (n) => (n + h / 30) % 12; const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function contrastWithWhite(hex) {
  const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/**
 * Build the whole theme from ONE brand colour. White text sits on the primary, so a colour that would make it
 * unreadable (contrast under 4.5:1) is darkened until it passes: legibility beats an exact brand match.
 */
export function buildTheme(primaryHex) {
  if (!HEX.test(primaryHex || '')) return null;
  let { h, s, l } = hexToHsl(primaryHex);
  let primary = primaryHex.toUpperCase(); let adjusted = false;
  while (contrastWithWhite(primary) < 4.5 && l > 8) { l -= 2; primary = toHex(hslToRgb(h, s, l)); adjusted = true; }
  const at = (dl, sMul = 1) => hslToRgb(h, clamp(s * sMul, 0, 100), clamp(l + dl, 4, 97));
  const fixed = (lightness, sMul) => hslToRgb(h, clamp(s * sMul, 0, 100), lightness);
  // Tailwind-style 50..950 scale, with the brand colour as 600 (what the app's primary buttons and links use)
  const scale = {
    50: fixed(96, 0.9), 100: fixed(93, 0.9), 200: fixed(87, 0.9), 300: fixed(78, 0.9),
    400: at(14), 500: at(7), 600: hslToRgb(h, s, l), 700: at(-9), 800: at(-18), 900: at(-26), 950: at(-36),
  };
  const light = {
    '--primary': primary, '--primary-dark': toHex(scale[800]), '--primary-light': toHex(scale[500]), '--primary-subtle': toHex(scale[50]),
    '--brand-panel': primary, '--brand-panel-dark': toHex(scale[950]),
  };
  // dark mode: the app already uses lighter primaries on dark surfaces; do the same from the same hue
  const dark = {
    '--primary': toHex(scale[500]), '--primary-dark': toHex(scale[400]), '--primary-light': toHex(scale[300]), '--primary-subtle': toHex(scale[950]),
    '--brand-panel': primary, '--brand-panel-dark': toHex(scale[950]),
  };
  const channels = {};
  Object.entries(scale).forEach(([k, rgb]) => { channels[`--indigo-${k}`] = rgb.join(' '); });
  return { primary, adjusted, light, dark, channels };
}

/** CSS text for the injected <style>: both colour schemes, plus the indigo scale the Tailwind classes read. */
export function themeCss(theme) {
  if (!theme) return '';
  const decl = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
  return `:root{${decl(theme.light)};${decl(theme.channels)}}:root.dark{${decl(theme.dark)}}`;
}

export const brandTitle = (suffix, name = DEFAULT_NAME) => (suffix ? `${name} | ${suffix}` : name);
/** "Cred2Tech | Login" (any language) -> "<name> | Login". Only the leading brand token is replaced. */
export const brandTitleFrom = (title, name = DEFAULT_NAME) => String(title || '').replace(/^Cred2Tech\b/, name);
