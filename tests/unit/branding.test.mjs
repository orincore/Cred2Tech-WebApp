// Pure branding logic. Run with:  node --test tests/unit/branding.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOrgCandidateHost, parseList, normalizeBranding, buildTheme, themeCss, contrastWithWhite, hexToHsl,
  brandTitle, brandTitleFrom, DEFAULT_NAME,
} from '../../src/branding/brandingCore.js';

test('host detection: exactly one label under a configured base domain, never a main host', () => {
  const cfg = { baseDomains: ['cred2tech.com'], mainHosts: ['app.cred2tech.com', 'www.cred2tech.com'] };
  assert.equal(isOrgCandidateHost('acme.cred2tech.com', cfg), true);
  assert.equal(isOrgCandidateHost('ACME.Cred2Tech.com', cfg), true);
  for (const h of ['app.cred2tech.com', 'www.cred2tech.com', 'cred2tech.com', 'a.b.cred2tech.com', 'evil.com', 'acme.cred2tech.com.evil.com', '', null, undefined, 'localhost']) {
    assert.equal(isOrgCandidateHost(h, cfg), false, String(h));
  }
  assert.equal(isOrgCandidateHost('acme.cred2tech.com', { baseDomains: [], mainHosts: [] }), false, 'feature off when no base domain is configured');
  assert.equal(isOrgCandidateHost('acme.dev.cred2tech.com', { baseDomains: ['dev.cred2tech.com', 'cred2tech.com'] }), true);
  assert.equal(isOrgCandidateHost('acme.localhost', { baseDomains: ['localhost'] }), true);
  assert.equal(isOrgCandidateHost('localhost', { baseDomains: ['localhost'] }), false);
  assert.deepEqual(parseList(' a , b,, c '), ['a', 'b', 'c']); assert.deepEqual(parseList(undefined), []);
});

test('payload validation: only safe, well-formed branding is accepted', () => {
  const ok = normalizeBranding({
    name: '  Acme Finance ', powered_by_visible: true, theme: { primary_color: '#0F766E' }, tagline: 'Fast', support_email: 'a@b.co',
    logo_placements: { login_page: false }, assets: { LOGO_LIGHT: { url: '/api/whitelabel/assets/LOGO_LIGHT?v=abcdef12' } },
  });
  assert.equal(ok.name, 'Acme Finance'); assert.equal(ok.poweredBy, true); assert.equal(ok.primary, '#0F766E');
  assert.equal(ok.logoLight, '/api/whitelabel/assets/LOGO_LIGHT?v=abcdef12'); assert.equal(ok.logoDark, null);
  assert.deepEqual(ok.placements, { login_page: false });
  // a hostile or broken response can never inject a colour, a script URL or an external image
  const bad = normalizeBranding({ name: 'X', theme: { primary_color: 'red;}body{display:none' }, powered_by_visible: 'yes',
    assets: { LOGO_LIGHT: { url: 'https://evil.test/x.png' }, LOGO_DARK: { url: 'javascript:alert(1)' }, FAVICON: { url: '/api/whitelabel/assets/FAVICON?v=ZZZZZZZZ' } } });
  assert.equal(bad.primary, null); assert.equal(bad.poweredBy, false); assert.equal(bad.logoLight, null); assert.equal(bad.logoDark, null); assert.equal(bad.favicon, null);
  for (const junk of [null, undefined, {}, { name: '' }, { name: 5 }, 'x', []]) assert.equal(normalizeBranding(junk), null);
  assert.equal(normalizeBranding({ name: 'x'.repeat(500) }).name.length, 80);
});

test('theme: built from one colour, readable white-on-primary, light and dark sets, and the indigo scale', () => {
  const t = buildTheme('#0F766E');
  assert.equal(t.light['--primary'], '#0F766E'); assert.equal(t.adjusted, false);
  assert.ok(contrastWithWhite(t.light['--primary']) >= 4.5);
  assert.notEqual(t.dark['--primary'], t.light['--primary'], 'dark mode uses a lighter tint, like the built-in theme');
  for (const k of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) assert.match(t.channels[`--indigo-${k}`], /^\d{1,3} \d{1,3} \d{1,3}$/, `shade ${k}`);
  const lum = (k) => hexToHsl(`#${t.channels[`--indigo-${k}`].split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`).l;
  const ls = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(lum);
  assert.deepEqual([...ls].sort((a, b) => b - a), ls, 'the scale gets monotonically darker');
});

test('theme: a too-light brand colour is darkened until white text is legible', () => {
  const t = buildTheme('#FFEB3B');                      // yellow: white text on it is unreadable
  assert.equal(t.adjusted, true); assert.ok(contrastWithWhite(t.light['--primary']) >= 4.5);
  const dark = buildTheme('#000000'); assert.ok(dark && contrastWithWhite(dark.light['--primary']) >= 4.5);
  for (const bad of [null, undefined, '', 'red', '#12345', '#GGGGGG', 'url(x)']) assert.equal(buildTheme(bad), null, String(bad));
});

test('theme CSS contains only variable declarations (no way to inject rules)', () => {
  const css = themeCss(buildTheme('#C2410C'));
  assert.match(css, /^:root\{[^{}]*\}:root\.dark\{[^{}]*\}$/);
  assert.equal(/[<>@]|url\(|expression|javascript/i.test(css), false);
  assert.ok(css.includes('--primary:#') && css.includes('--indigo-600:'));
  assert.equal(themeCss(null), '');
});

test('titles: the brand replaces only the leading Cred2Tech token, in any language', () => {
  assert.equal(brandTitle('Login', 'Acme'), 'Acme | Login'); assert.equal(brandTitle('', 'Acme'), 'Acme'); assert.equal(brandTitle('Login'), `${DEFAULT_NAME} | Login`);
  assert.equal(brandTitleFrom('Cred2Tech | Data Consent', 'Acme'), 'Acme | Data Consent');
  assert.equal(brandTitleFrom('Cred2Tech | डेटा सहमति', 'Acme'), 'Acme | डेटा सहमति');
  assert.equal(brandTitleFrom('About Cred2Tech', 'Acme'), 'About Cred2Tech', 'not replaced mid-string');
  assert.equal(brandTitleFrom('Cred2Tech | Login'), 'Cred2Tech | Login', 'unchanged on the main app');
});
