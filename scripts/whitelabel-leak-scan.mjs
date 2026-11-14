#!/usr/bin/env node
// White-label LEAK SCAN (docs/Whitelabel.md Phase 5, in the backend repo). Opens a white-label org's site in a real
// browser, signs in as a demo admin, walks the main screens, and lists EVERY visible mention of Cred2Tech: page text,
// the tab title, alt/title/placeholder/aria attributes, image sources and links. Exit code 1 if anything unexpected
// appears.
//
// Allowed (by the owner's decisions): the "Powered by Cred2Tech" line when the org has it on, and the Terms/Privacy
// links (legal wording keeps naming Cred2Tech as the platform operator).
//
// Setup: run the backend demo stack (Cred2Tech/scripts/whitelabel/dev-demo-stack.js --tokens=<file>) and the web app
//   VITE_API_BASE_URL=http://localhost:5001/api VITE_WL_BASE_DOMAINS=localhost VITE_KEEP_HOST=1 npx vite --port 3003
// then:  node scripts/whitelabel-leak-scan.mjs --org=bravo --tokens=/tmp/wl-tokens.json [--anon] [--shots=<dir>] [--expect-attribution]
// Uses the Chromium Playwright already installed; set PW_EXE to a browser binary to override.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
const flag = (n) => process.argv.includes(`--${n}`);
const slug = arg('org'); const tokensFile = arg('tokens'); const shots = arg('shots'); const anon = flag('anon');
if (!slug || (!anon && !tokensFile)) { console.error('Usage: --org=<slug> --tokens=<file> [--anon] [--shots=<dir>] [--expect-attribution]'); process.exit(2); }
const token = anon ? null : JSON.parse(fs.readFileSync(tokensFile, 'utf8'))[slug];
const host = `${slug}.localhost:${arg('port') || 3003}`;
const ROUTES = anon
  ? ['/login', '/forgot-password', '/reset-password?token=demo', '/customer-consent?token=demo', '/itr-auth?token=demo', '/gst-auth?token=demo', '/register-dsa', '/msme/login']
  : ['/', '/profile', '/customers', '/users', '/organization', '/wallet', '/storage/manage', '/hierarchy', '/no-such-page'];
const ALLOWED = [/^Cred2Tech$/, /https:\/\/cred2tech\.com\/?$/, /https:\/\/cred2tech\.com\/(terms-of-use|privacy-policy)$/];

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
await ctx.route('**/*', (route) => { const u = route.request().url(); return /^https?:\/\/(localhost|[a-z0-9-]+\.localhost|127\.0\.0\.1)(:\d+)?\//.test(u) || u.startsWith('data:') ? route.continue() : route.abort(); });
await ctx.addInitScript(([t]) => { try { if (t) localStorage.setItem('token', t); localStorage.setItem('dev_banner_closed', 'true'); } catch (e) { /* */ } }, [token]);
const page = await ctx.newPage();
let unexpected = 0; let attribution = 0;
for (const r of ROUTES) {
  await page.goto(`http://${host}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(700);
  const skip = page.getByText('Skip, I know everything'); if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
  const res = await page.evaluate(() => {
    const hits = []; const re = /cred2tech|credtech/i;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (t && re.test(t)) hits.push({ where: 'text', text: t.slice(0, 120) }); }
    if (re.test(document.title)) hits.push({ where: 'title', text: document.title });
    document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach((el) => ['alt', 'title', 'placeholder', 'aria-label'].forEach((a) => { const v = el.getAttribute(a); if (v && re.test(v)) hits.push({ where: a, text: v }); }));
    document.querySelectorAll('img[src],link[href],a[href],source[src]').forEach((el) => { const v = el.getAttribute('src') || el.getAttribute('href'); if (v && re.test(v)) hits.push({ where: `${el.tagName.toLowerCase()} ${el.getAttribute('src') ? 'src' : 'href'}`, text: v.slice(0, 100) }); });
    return { title: document.title, url: location.pathname, hits };
  });
  const bad = res.hits.filter((h) => !ALLOWED.some((a) => a.test(h.text))); attribution += res.hits.length - bad.length; unexpected += bad.length;
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${r}  ->  ${res.url}  title="${res.title}"${bad.length ? '' : (res.hits.length ? `  (allowed: ${res.hits.length})` : '')}`);
  bad.forEach((h) => console.log(`       [${h.where}] ${h.text}`));
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${slug}-${r.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`) }); }
}
await browser.close();
console.log(`\n${unexpected ? `LEAKS FOUND: ${unexpected}` : 'No unexpected Cred2Tech mentions.'} (allowed attribution/legal mentions seen: ${attribution})`);
if (flag('expect-attribution') && !attribution) { console.log('Expected the attribution line but saw none.'); process.exit(1); }
process.exit(unexpected ? 1 : 0);
