const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const esbuild = require('esbuild');
const filename = path.resolve(__dirname, '../src/components/esr/RulebookWorkings.jsx');
const compiled = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
const component = new Module(filename, module);
component.filename = filename;
component.paths = Module._nodeModulePaths(path.dirname(filename));
component._compile(compiled, filename);
const { default: Workings, RulebookDiagnostics } = component.exports;
const render = (Type, props) => renderToStaticMarkup(React.createElement(Type, props));

test('scheme and scenario output preserves engine amounts, workings and warnings', () => {
  const props = { initiallyOpen: true, lender: { configuration_errors: [], schemes: [{
    scheme: 'salaried', label: 'Salaried', eligible: true, amount: 1234567.89, income_based: 2000000,
    emi: 18943, roi: 7.6, tenure_months: 240, foir: 0.7, ltv: 0.65,
    trace: [{ step: 'Applicant obligations', result: 18943, note: 'Housing loan included' }],
    reasons: [], warnings: [{ code: 'SOURCE_NOTE', message: 'Salary verification pending' }],
    scenario_details: [{ scenario: 'B — together', chosen: true, eligible: true, amount: 1234567.89,
      reasons: [], warnings: [], trace: [{ step: 'Co-applicant obligations', result: 18729 }] }]
  }, { scheme: 'other', label: 'Other scheme', eligible: false, amount: 300000,
    reasons: [{ code: 'DATA_MISSING', message: 'DOB required' }], warnings: [], trace: [] }] } };
  const html = render(Workings, props);
  const otherHtml = render(Workings, { ...props, initialScheme: 'other' });
  for (const value of ['12,34,567.89', '20,00,000', '70.00%', '65.00%', '240 months', 'Housing loan included',
    '18,729', 'Salary verification pending', 'B — together', 'Hide Calculation', 'role="tablist"']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('DOB required'));
  assert.ok(otherHtml.includes('DOB required'));
  assert.ok(otherHtml.includes('Indicative amount only'));
  assert.ok(otherHtml.includes('Why this scheme is not eligible'));
  const closed = render(Workings, { lender: props.lender });
  assert.ok(closed.includes('View Calculation'));
  assert.ok(!closed.includes('role="tablist"'));
  assert.ok(!closed.includes('DOB required'));
  assert.ok(!closed.includes('Salary verification pending'));
  assert.ok(!closed.includes('Method assessment summaries'));
});

test('selected calculation tab shows readable rejection and ABB warning without external summaries or codes', () => {
  const reason = 'Existing obligations exhaust the repayment capacity.';
  const warning = 'Lender ABB definition is average of balances on 5th, 15th, 25th, 30th over 12 months; day-wise balances not available, so the platform ABB (₹9,03,561) was used.';
  const props = { initiallyOpen: true, initialScheme: 'cash_profit', lender: { schemes: [
    { scheme: 'cash_profit', label: 'Cash Profit Method', eligible: false, amount: 0,
      reasons: [{ code: 'OBLIGATIONS_EXCEED_CAPACITY', message: reason }], warnings: [{ code: 'ABB_DEFINITION', message: warning }] },
    { scheme: 'banking', label: 'Banking (ABB × 67%)', eligible: true, amount: 30000000,
      reasons: [], warnings: [{ code: 'ABB_DEFINITION', message: warning }] }
  ] } };
  const html = render(Workings, props);
  assert.ok(html.includes(reason));
  assert.equal(html.split(warning).length - 1, 1);
  assert.ok(html.includes('✕'));
  assert.ok(html.includes('⚠'));
  assert.ok(html.includes('color:var(--error)'));
  assert.ok(html.includes('color:var(--warning)'));
  assert.ok(!html.includes('OBLIGATIONS_EXCEED_CAPACITY'));
  assert.ok(!html.includes('ABB_DEFINITION'));
  assert.ok(!html.includes('ABB × 67%'));
  assert.ok(html.includes('role="tabpanel"'));
  assert.ok(!html.includes('Method assessment summaries'));
  assert.ok(!html.includes('<article'));
  const banking = render(Workings, { ...props, initialScheme: 'banking' });
  assert.ok(banking.includes(warning));
  assert.ok(!banking.includes(reason));
  const closed = render(Workings, { lender: props.lender });
  assert.ok(!closed.includes(reason));
  assert.ok(!closed.includes(warning));
});

test('provisional results, input gaps and configuration errors remain visible', () => {
  const html = render(RulebookDiagnostics, { report: { version_number: 14, raw_payload: { engine_result: {
    as_of: '2026-10-14', engine_version: '0.1.0', provisional: true, partial: true,
    input_issues: [{ code: 'OBLIGATION_EMI_MISSING', message: 'Used car EMI missing' }],
    data_gaps: [{ code: 'DATA_MISSING', message: 'Turnover missing', affects: ['Bank · GST'] }],
    adapter_notes: ['Only this case sources used'], invalid_rulebooks: [{ lender: 'Bad Bank', errors: ['Invalid policy'] }],
    not_offered: [{ lender: 'Other Bank', reason: 'HL not configured' }]
  } } } });
  for (const value of ['ESR v14', 'Provisional results', 'Used car EMI missing', 'Turnover missing', 'Bank · GST',
    'Only this case sources used', 'Bad Bank: Invalid policy', 'Other Bank: HL not configured']) assert.ok(html.includes(value), value);
});

test('historical report prompts explicit refresh with the new engine', () => {
  const html = render(RulebookDiagnostics, { report: { raw_payload: {} } });
  assert.ok(html.includes('previous calculation engine'));
  assert.ok(html.includes('Refresh Results'));
});

test('assessment summary displays the engine best offer and concise method name', () => {
  const html = render(RulebookDiagnostics, { report: { version_number: 15, raw_payload: { engine_result: {
    as_of: '2026-10-15', engine_version: '0.1.0',
    summary: { eligible_lenders: 12, best_offer: { lender: 'Example Bank', scheme: 'banking', amount: 75000000 } },
    lenders: [{ lender: 'Example Bank', schemes: [{ scheme: 'banking', label: 'Banking (ABB = monthly income)' }] }]
  } } } });
  assert.ok(html.includes('12 eligible lenders'));
  assert.ok(html.includes('7,50,00,000'));
  assert.ok(html.includes('Example Bank'));
  assert.ok(html.includes('Banking'));
  assert.ok(!html.includes('ABB = monthly income'));
});
