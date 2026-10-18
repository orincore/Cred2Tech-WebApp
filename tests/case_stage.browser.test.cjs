const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');

test('real stage modal submits consistent lender details for manual, locked, ID-only and delayed-response cases', { timeout: 120000 }, async () => {
  const bundle = await build({ stdin: { loader: 'jsx', resolveDir: path.resolve(__dirname, '..'), contents: `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
    import CaseDetailPage from './src/pages/CaseDetailPage.jsx';
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/cases/1']}><Routes><Route path="/cases/:id" element={<CaseDetailPage />} /></Routes></MemoryRouter>);
  ` }, plugins: [{ name: 'mock-case-apis', setup(b) {
    b.onResolve({ filter: /\/api\/(caseService|tenantLenderService)$|\/context\/(AuthContext|ThemeContext)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'mock-stage' }));
    b.onLoad({ filter: /.*/, namespace: 'mock-stage' }, args => {
      const contents = args.path === 'AuthContext' ? "export const useAuth = () => ({hasRole: role => role === 'DSA_ADMIN'});"
        : args.path === 'ThemeContext' ? "export const useTheme = () => ({theme: 'light'});"
        : args.path === 'tenantLenderService' ? 'export const getTenantLenders = async () => window.__fixture.lenders;'
        : `const delay=ms=>new Promise(r=>setTimeout(r,ms)); export const caseService={
          getCaseById: async () => {await delay(window.__fixture.caseDelay||0);return {id:1,stage:'ESR_GENERATED',category:'BUSINESS',product_type:'LAP',customer:{business_name:'Test business'},applicants:[],documents:[],other_cases:[],...window.__fixture.caseData};},
          getDisbursementSummary: async () => {await delay(window.__fixture.summaryDelay||0);window.__summaryLoaded=true;return {sanction:window.__fixture.sanction,summary:{sanctioned_amount:1000000}};},
          sanctionCase: async(id,payload)=>{window.__submitted={id,payload};return payload;}
        };`;
      return { contents, loader: 'js' };
    });
  } }], bundle: true, platform: 'browser', format: 'iife', write: false,
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' } });
  const fixtures = [
    { name: 'case-first', caseDelay: 0, summaryDelay: 120, caseData: { lender_name: 'Example Bank' }, sanction: { lender_name: '', processing_fee: 0, confirmed_roi: 0 }, expected: 'Example Bank', expectedId: '119' },
    { name: 'summary-first', caseDelay: 120, summaryDelay: 0, caseData: { lender_name: 'Example Bank' }, sanction: { lender_name: '', processing_fee: 0, confirmed_roi: 0 }, expected: 'Example Bank', expectedId: '119' },
    { name: 'inactive-id', caseData: { tenant_lender_id: 120 }, sanction: null, expected: 'Archived Bank', expectedId: '120' },
    { name: 'saved-sanction', caseData: { lender_name: 'Wrong case lender' }, sanction: { lender_name: 'Archived Bank', tenant_lender_id: 120, product_type: 'HL', processing_fee: 0 }, expected: 'Archived Bank', expectedId: '120' },
    { name: 'manual', caseData: {}, sanction: null, expected: 'Example Bank', expectedId: '119', manual: true }
  ].map(f => ({ ...f, lenders: [{ id: 119, lender_name: 'Example Bank', is_active: true }, { id: 120, lender_name: 'Archived Bank', is_active: false }] }));
  const server = http.createServer((req,res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type','application/javascript'); res.end(bundle.outputFiles[0].text); return; }
    const f = fixtures.find(f => f.name === req.url.slice(1));
    res.setHeader('Content-Type','text/html');
    res.end('<div id="root"></div><script>window.__fixture='+JSON.stringify(f)+'</script><script src="/bundle.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL||undefined});
    for (const f of fixtures) {
      const page=await browser.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port+'/'+f.name);
      await page.waitForFunction(()=>window.__summaryLoaded);
      await page.getByRole('button',{name:'Update Stage',exact:true}).click();
      const modal=page.locator('.modal-box');
      await modal.locator('button[aria-haspopup="listbox"]').first().click();
      await page.getByRole('option',{name:'Sanctioned',exact:true}).click();
      if (f.manual) {
        await modal.locator('button[aria-haspopup="listbox"]').nth(1).click();
        await page.getByRole('option',{name:'Example Bank',exact:true}).click();
      } else assert.ok((await modal.textContent()).includes(f.expected), f.name+' locked lender');
      const field = label => modal.locator('.form-group').filter({hasText:label}).locator('input');
      await field('Sanctioned Amount').fill('1000000');
      await field('Sanction Date').fill('2026-10-18');
      await field('Confirmed ROI').fill('8.5');
      if(f.sanction) assert.equal(await field('Processing Fee').inputValue(),'0',f.name+' preserves zero fee');
      else await field('Processing Fee').fill('0');
      await modal.getByRole('button',{name:'Confirm Update',exact:true}).click();
      await page.waitForFunction(()=>!!window.__submitted);
      const submitted=await page.evaluate(()=>window.__submitted.payload);
      assert.equal(submitted.lender_name,f.expected,f.name);
      assert.equal(submitted.tenant_lender_id,f.expectedId,f.name);
      assert.equal(submitted.product_type,f.sanction?.product_type||'LAP',f.name);
      await page.close();
    }
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
});
