// node --test tests/unit/whitelabelUi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestSlug, slugFormatError, hostFor, validateDetails, detailsPayload, changedFields, readiness, canProvision,
  splitSse, applyEvent, jobStage, allowedActions, formatBytes, formatDuration,
} from '../../src/pages/whitelabel/whitelabelUi.js';

test('subdomain suggestion from a company name', () => {
  assert.equal(suggestSlug('Acme Finance Pvt Ltd'), 'acme-finance');
  assert.equal(suggestSlug('  Bravo & Co.  '), 'bravo-and-co');
  assert.equal(suggestSlug('Crédit Société'), 'credit-societe');
  assert.equal(suggestSlug('A'), '', 'too short to suggest');
  assert.equal(suggestSlug('12'), '');
  assert.ok(suggestSlug('x'.repeat(80)).length <= 30);
  assert.equal(suggestSlug('Hello---World'), 'hello-world');
  assert.equal(suggestSlug(null), '');
  assert.equal(hostFor('acme', 'dev.cred2tech.com'), 'acme.dev.cred2tech.com'); assert.equal(hostFor('', 'x.com'), '');
});

test('subdomain format errors mirror the server rules', () => {
  assert.equal(slugFormatError(''), ''); assert.equal(slugFormatError('acme-loans'), '');
  for (const bad of ['ab', 'a'.repeat(31), '-acme', 'acme-', 'ac me', 'acme.loans', 'ac--me', '123456', 'ACME_X']) assert.notEqual(slugFormatError(bad.toLowerCase() === bad ? bad : bad), '', bad);
  assert.equal(slugFormatError('ACME'), '', 'case is normalised, not an error');
});

test('details validation: required on create, optional on edit, formats checked', () => {
  const ok = { display_name: 'Acme', contact_email: 'a@b.co', contact_mobile: '9876543210', pan_number: 'abcde1234f', pincode: '560001' };
  assert.deepEqual(validateDetails(ok), {});
  assert.ok(validateDetails({}).display_name && validateDetails({}).contact_email);
  assert.deepEqual(validateDetails({ pincode: '12' }, { partial: true }), { pincode: 'Enter a 6-digit pincode.' });
  const bad = validateDetails({ display_name: '<b>', contact_email: 'x', contact_mobile: '123', gst_number: 'nope' });
  for (const k of ['display_name', 'contact_email', 'contact_mobile', 'gst_number']) assert.ok(bad[k], k);
});

test('payloads: blanks clear a field, only changed fields are sent', () => {
  assert.deepEqual(detailsPayload({ a: ' x ', b: '', c: 5 }, ['a', 'b', 'c', 'd']), { a: 'x', b: null, c: 5 });
  assert.deepEqual(changedFields({ a: 'x', b: null }, { a: 'x', b: '' }, ['a', 'b']), {}, 'null equals empty');
  assert.deepEqual(changedFields({ a: 'x', b: 'y' }, { a: 'z', b: 'y' }, ['a', 'b']), { a: 'z' });
});

test('readiness: three required items block provisioning, the rest are advice', () => {
  const org = { display_name: 'A', slug: 'a-co', contact_email: null, branding: {}, assets: [] };
  assert.equal(canProvision(org), false);
  assert.equal(canProvision({ ...org, contact_email: 'a@b.co' }), true);
  const r = readiness({ ...org, contact_email: 'a@b.co', branding: { primary_color: '#000000', support_email: 'h@x.co' }, assets: [{ kind: 'LOGO_DARK' }] });
  assert.deepEqual(r.filter((x) => !x.done).map((x) => x.key), [], 'everything done');
  assert.equal(readiness(org).find((x) => x.key === 'logo').required, false);
});

test('SSE parser: handles split chunks, heartbeats, multiple events and junk', () => {
  let r = splitSse('event: snapshot\ndata: {"a":1}\n\n: keep-alive\n\nevent: progress\ndata: {"type":"step"');
  assert.deepEqual(r.events, [{ event: 'snapshot', data: { a: 1 } }]);
  assert.ok(r.rest.startsWith('event: progress'));
  r = splitSse(`${r.rest},"status":"DONE"}\n\nevent: x\ndata: not json\n\n`);
  assert.deepEqual(r.events, [{ event: 'progress', data: { type: 'step', status: 'DONE' } }], 'the broken frame is skipped');
  assert.equal(r.rest, '');
  assert.deepEqual(splitSse(': hb\n\n').events, []);
});

test('live events update the snapshot immediately: step status, progress, job status', () => {
  const snap = { job: { status: 'RUNNING' }, progress: { done: 0, total: 3, percent: 0 }, steps: [{ key: 'a', status: 'PENDING' }, { key: 'b', status: 'PENDING' }, { key: 'c', status: 'PENDING' }] };
  const s1 = applyEvent(snap, { type: 'step', step_key: 'a', status: 'RUNNING', attempts: 1 });
  assert.equal(s1.steps[0].status, 'RUNNING'); assert.equal(s1.steps[0].attempts, 1);
  const s2 = applyEvent(s1, { type: 'step', step_key: 'a', status: 'DONE' });
  assert.deepEqual(s2.progress, { done: 1, total: 3, percent: 33 });
  const s3 = applyEvent(s2, { type: 'step', step_key: 'b', status: 'FAILED', error: 'boom' });
  assert.equal(s3.steps[1].error, 'boom');
  assert.equal(applyEvent(s3, { type: 'job', status: 'FAILED', error: 'x' }).job.status, 'FAILED');
  assert.equal(applyEvent(snap, { type: 'step', step_key: 'zzz', status: 'DONE' }).progress.done, 0, 'unknown step ignored');
  assert.equal(applyEvent(null, { type: 'job' }), null); assert.equal(snap.steps[0].status, 'PENDING', 'input not mutated');
});

test('controls follow the job state', () => {
  const mk = (status, extra = {}, steps = []) => ({ job: { status, ...extra }, steps });
  assert.deepEqual(allowedActions(null), { start: true, retry: false, rollback: false, cancel: false });
  assert.deepEqual(allowedActions(null, { provisioningConfigured: false }).start, false);
  assert.deepEqual(allowedActions(mk('RUNNING')), { start: false, retry: false, rollback: false, cancel: true });
  assert.equal(allowedActions(mk('RUNNING', { cancel_requested: true })).cancel, false);
  assert.deepEqual(allowedActions(mk('FAILED')), { start: false, retry: true, rollback: true, cancel: false });
  assert.equal(allowedActions(mk('FAILED', {}, [{ status: 'COMPENSATED' }])).retry, false, 'a half rolled back job can only finish rolling back');
  assert.equal(allowedActions(mk('ROLLED_BACK')).start, true); assert.equal(allowedActions(mk('SUCCEEDED')).start, false);
  assert.deepEqual(['QUEUED', 'RUNNING', 'ROLLING_BACK', 'FAILED', 'SUCCEEDED', 'CANCELLED'].map((s) => jobStage(mk(s))), ['active', 'active', 'active', 'failed', 'done', 'ended']);
});

test('formatting', () => {
  assert.equal(formatBytes(1048576), '1 MB'); assert.equal(formatBytes(262144), '256 KB'); assert.equal(formatBytes(1572864), '1.5 MB');
  assert.equal(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:00.4Z'), '<1s');
  assert.equal(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:01:05Z'), '1m 5s');
  assert.equal(formatDuration(null), '');
});
