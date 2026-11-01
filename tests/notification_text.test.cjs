const test = require('node:test');
const assert = require('node:assert/strict');
const { notificationMessage } = require('../src/utils/notificationText.js');

const pull = (message) => ({ event_type: 'DATA_PULL', title: 'GST pull completed', message });

test('the technical lines the backend used to write are hidden - only the title remains', () => {
  for (const message of [
    'GST pull COMPLETED via webhook',
    'GST pull FAILED via webhook',
    'Bank Statement analysis COMPLETED via webhook',
    'Bank Statement analysis FAILED: Invalid PDF password supplied to provider',
    'ITR analytics pull COMPLETED',
    'Background processing for GST has ended with status COMPLETED',
    'Background processing for BANK has ended with status Failed',
  ]) assert.equal(notificationMessage(pull(message)), '', message);
});

test('no message at all (the new notifications) shows nothing extra', () => {
  for (const message of [undefined, null, '', '   ']) assert.equal(notificationMessage(pull(message)), '');
});

test('plain-English data-pull messages are kept', () => {
  assert.equal(notificationMessage({ event_type: 'DATA_PULL', message: 'Bureau verification partial success' }), 'Bureau verification partial success');
  assert.equal(notificationMessage({ event_type: 'DATA_PULL', message: 'Your report is ready to view' }), 'Your report is ready to view');
});

test('other kinds of notification are never altered, even if they contain such words', () => {
  const payout = { event_type: 'PAYOUT', message: 'Payout COMPLETED for case 12' };
  assert.equal(notificationMessage(payout), 'Payout COMPLETED for case 12');
  assert.equal(notificationMessage({ event_type: 'LOGIN_ALERT', message: 'New sign-in from Chrome' }), 'New sign-in from Chrome');
});

test('missing notification is safe', () => {
  assert.equal(notificationMessage(undefined), '');
  assert.equal(notificationMessage(null), '');
  assert.equal(notificationMessage({}), '');
});
