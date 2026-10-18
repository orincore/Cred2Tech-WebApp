const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { chromium } = require('@playwright/test');

test('numeric lender selection fills the sanction name; zero and cleared selections follow native select string values', async () => {
  const script = buildSync({ stdin: { loader: 'jsx', resolveDir: path.resolve(__dirname, '..'), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import CustomSelect from './src/components/CustomSelect.jsx';
    function App() {
      const lenders = [{ id: 119, lender_name: 'Example Bank' }, { id: 0, lender_name: 'Zero Bank' }];
      const [form, setForm] = useState({ tenant_lender_id: '', lender_name: '' });
      return <><CustomSelect name="tenant_lender_id" value={form.tenant_lender_id} onChange={e => {
        const selected = lenders.find(l => String(l.id) === e.target.value);
        setForm({ tenant_lender_id: e.target.value, lender_name: selected ? selected.lender_name : '', value_type: typeof e.target.value });
      }}><option value="">Select lender</option>{lenders.map(l => <option key={l.id} value={l.id}>{l.lender_name}</option>)}</CustomSelect>
      <output>{JSON.stringify(form)}</output></>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  ` }, bundle: true, platform: 'browser', format: 'iife', write: false, define: { 'process.env.NODE_ENV': '"test"' } }).outputFiles[0].text;
  const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script>' + script + '</script>'); });
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    const select = page.locator('button[aria-haspopup="listbox"]');
    const read = async () => JSON.parse(await page.locator('output').textContent());
    await select.click();
    await page.getByRole('option', { name: 'Example Bank', exact: true }).click();
    assert.deepEqual(await read(), { tenant_lender_id: '119', lender_name: 'Example Bank', value_type: 'string' });
    await select.click();
    await page.getByRole('option', { name: 'Zero Bank', exact: true }).click();
    assert.deepEqual(await read(), { tenant_lender_id: '0', lender_name: 'Zero Bank', value_type: 'string' });
    await select.click();
    await page.getByRole('option', { name: 'Select lender', exact: true }).click();
    assert.deepEqual(await read(), { tenant_lender_id: '', lender_name: '', value_type: 'string' });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
