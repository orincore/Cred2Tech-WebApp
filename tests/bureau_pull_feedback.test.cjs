const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/pages/BureauObligationsPage.jsx'), 'utf8');
const handler = source.slice(source.indexOf('  const handlePullBureau = async'), source.indexOf('\n  // Recomputed every render'));
async function run(result, { fetched = false, count = 0 } = {}) {
  const messages = [];
  const context = vm.createContext({
    caseId: 8105723, data: { grouped: [] },
    setRetryingFor() {}, setBureauFailedFor() {},
    caseService: { runBureauVerification: async () => result, syncObligations: async () => {} },
    load: async () => ({ grouped: [{ applicant: { id: 4693, bureau_fetched: fetched }, obligations: Array(count).fill({}) }] }),
    toast: { error: text => messages.push(['error', text]), success: text => messages.push(['success', text]) },
  });
  await vm.runInContext(handler + '\nhandlePullBureau(4693);', context);
  return messages;
}
test('BUREAU vendor errors are shown even with stored obligations and mixed ID types', async () => {
  assert.deepEqual(await run({ errors: [{ applicantId: '4693', stage: 'BUREAU', error: 'BEFISC: Request limit exceeded' }] }, { count: 2, fetched: true }), [['error', 'Bureau check failed: BEFISC: Request limit exceeded']]);
});
test('legacy obligations errors remain visible', async () => {
  assert.deepEqual(await run({ errors: [{ applicantId: 4693, stage: 'OBLIGATIONS', error: 'No Record Found' }] }), [['error', 'Bureau check failed: No Record Found']]);
});
test('missing report does not claim a confirmed no-credit-history result', async () => {
  assert.deepEqual(await run({ errors: [] }), [['error', 'Bureau verification did not complete. No confirmed report is available for this applicant.']]);
  assert.deepEqual(await run({ errors: [] }, { fetched: true }), [['success', 'Bureau data fetched successfully.']]);
});
