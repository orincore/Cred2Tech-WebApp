const test = require('node:test');
const assert = require('node:assert/strict');
const { decideCaseUrlSync } = require('../src/utils/caseUrlSync.js');

// The logic the wizards used before: any disagreement is "the user navigated".
const oldDecision = ({ urlCaseId, caseId }) => {
  const url = urlCaseId || null;
  const id = caseId == null ? null : String(caseId);
  if (url === id) return 'none';
  return url ? 'restore' : 'reset';
};

test('REGRESSION: creating a case on the first Request Consent click must not reset or reload the wizard', () => {
  // render 1: setCaseId(new) has landed, the router's transition has not -> URL still has no caseId
  const render1 = { urlCaseId: null, caseId: 5503320, selfCreatedCaseId: '5503320' };
  assert.equal(oldDecision(render1), 'reset', 'documents the bug: the old logic wiped the form and the consent request here');
  assert.deepEqual(decideCaseUrlSync(render1), { action: 'none', clearSelfCreated: false });

  // render 2: the URL has caught up
  const render2 = { urlCaseId: '5503320', caseId: 5503320, selfCreatedCaseId: '5503320' };
  assert.deepEqual(decideCaseUrlSync(render2), { action: 'none', clearSelfCreated: true });
});

test('the other order (URL first, state later) is equally ignored', () => {
  const r = decideCaseUrlSync({ urlCaseId: '5503320', caseId: null, selfCreatedCaseId: 5503320 });
  assert.deepEqual(r, { action: 'none', clearSelfCreated: false });
});

test('state and URL agree -> nothing to do (string vs number is compared as text)', () => {
  assert.equal(decideCaseUrlSync({ urlCaseId: '12', caseId: 12 }).action, 'none');
  assert.equal(decideCaseUrlSync({ urlCaseId: null, caseId: null }).action, 'none');
  assert.equal(decideCaseUrlSync({ urlCaseId: '', caseId: null }).action, 'none');
});

test('a real navigation to a different case still loads it', () => {
  assert.equal(decideCaseUrlSync({ urlCaseId: '99', caseId: 12 }).action, 'restore');
  // even right after creating a case: the user went somewhere else
  assert.equal(decideCaseUrlSync({ urlCaseId: '99', caseId: 12, selfCreatedCaseId: '12' }).action, 'restore');
});

test('opening a case from a link (state empty, URL has an id) still loads it', () => {
  assert.equal(decideCaseUrlSync({ urlCaseId: '12', caseId: null }).action, 'restore');
});

test('"New Case" (URL drops the id while a case is loaded) still starts blank', () => {
  assert.equal(decideCaseUrlSync({ urlCaseId: null, caseId: 12 }).action, 'reset');
});

test('after the self-created case has settled, a later "New Case" on that same case resets as normal', () => {
  const settled = decideCaseUrlSync({ urlCaseId: '5503320', caseId: 5503320, selfCreatedCaseId: '5503320' });
  assert.equal(settled.clearSelfCreated, true);                      // the page clears its memory here
  assert.equal(decideCaseUrlSync({ urlCaseId: null, caseId: 5503320, selfCreatedCaseId: null }).action, 'reset');
});

test('remembering a created case never blocks navigation involving another case', () => {
  assert.equal(decideCaseUrlSync({ urlCaseId: null, caseId: 7, selfCreatedCaseId: '5503320' }).action, 'reset');
  assert.equal(decideCaseUrlSync({ urlCaseId: '8', caseId: null, selfCreatedCaseId: '5503320' }).action, 'restore');
});
