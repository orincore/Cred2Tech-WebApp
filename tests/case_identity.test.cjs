const test = require('node:test');
const assert = require('node:assert/strict');
const { hasCarriedOverIdentity } = require('../src/utils/caseIdentity.js');

test('"Continue as New Case": a fresh unconsented applicant with a source link keeps the old identity hidden', () => {
  assert.equal(hasCarriedOverIdentity({ source_applicant_id: 4738, otp_verified: false }), true);
});

test('a lender case Cred2Tech allocated to a partner (a copy that kept the customer\'s consent) shows its own identity', () => {
  // Real shape of lead 9361084 on dev: copied applicant, source link set, consent carried over.
  assert.equal(hasCarriedOverIdentity({ source_applicant_id: 4738, otp_verified: true, pan_verified: true }), false);
});

test('an ordinary case (no source link) is never treated as carried over, consented or not', () => {
  assert.equal(hasCarriedOverIdentity({ source_applicant_id: null, otp_verified: false }), false);
  assert.equal(hasCarriedOverIdentity({ otp_verified: true }), false);
});

test('a continued case becomes the customer\'s own once its OWN consent is granted', () => {
  const app = { source_applicant_id: 4738, otp_verified: false };
  assert.equal(hasCarriedOverIdentity(app), true);
  assert.equal(hasCarriedOverIdentity({ ...app, otp_verified: true }), false);
});

test('no applicant yet is safe', () => {
  assert.equal(hasCarriedOverIdentity(undefined), false);
  assert.equal(hasCarriedOverIdentity(null), false);
});
