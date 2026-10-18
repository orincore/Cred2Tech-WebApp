const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSanctionContext: resolve, createSanctionForm, createDisbursementForm } = require('../src/utils/caseStageForm.js');
const lenders = [
  { id: 119, lender_name: 'Example Bank', is_active: true },
  { id: 120, lender_name: 'Archived Bank', is_active: false }
];
test('case-assigned lender stays visible and submitted even when the sanction response contains blanks', () => {
  for (const form of [{}, { lender_name: '', tenant_lender_id: '', product_type: '' }]) {
    const result = resolve({ caseData: { lender_name: 'Example Bank', product_type: 'LAP' },
      sanction: { lender_name: '', tenant_lender_id: null, product_type: '' }, form, lenders });
    assert.equal(result.lender_name, 'Example Bank');
    assert.equal(result.tenant_lender_id, '119');
    assert.equal(result.product_type, 'LAP');
    assert.equal(result.isLenderLocked, true);
  }
});
test('all lenders resolve numeric/string IDs and historical inactive assignments without changing names', () => {
  for (const l of lenders) for (const id of [l.id, String(l.id)]) {
    const result = resolve({ caseData: { tenant_lender_id: id }, lenders });
    assert.equal(result.lender_name, l.lender_name);
    assert.equal(result.tenant_lender_id, String(l.id));
    assert.equal(result.isLenderLocked, true);
  }
});
test('existing sanction takes precedence over stale case/form identity and product', () => {
  const result = resolve({ caseData: { lender_name: 'Wrong case lender', product_type: 'LAP' },
    sanction: { lender_name: 'Archived Bank', tenant_lender_id: 120, product_type: 'HL' },
    form: { lender_name: 'Wrong previous-case lender', tenant_lender_id: '999' }, lenders });
  assert.equal(result.lender_name, 'Archived Bank');
  assert.equal(result.tenant_lender_id, '120');
  assert.equal(result.product_type, 'HL');
});
test('blank or unassigned cases require explicit selection, never the first lender', () => {
  assert.equal(resolve({ lenders }).lender_name, '');
  assert.equal(resolve({ lenders }).isLenderLocked, false);
  const selected = resolve({ form: { tenant_lender_id: '119' }, lenders });
  assert.equal(selected.lender_name, 'Example Bank');
  assert.equal(selected.isLenderLocked, false);
});
test('name-only legacy cases resolve case/whitespace differences and do not guess ambiguous IDs', () => {
  assert.equal(resolve({ caseData: { lender_name: ' example  bank ' }, lenders }).tenant_lender_id, '119');
  const duplicateNames = [...lenders, { id: 999, lender_name: 'EXAMPLE BANK' }];
  const result = resolve({ caseData: { lender_name: 'Example Bank' }, lenders: duplicateNames });
  assert.equal(result.tenant_lender_id, '');
  assert.equal(result.lender_name, 'Example Bank');
});
test('a missing sanction name cannot borrow the name of a different case lender', () => {
  const result = resolve({ sanction: { tenant_lender_id: 999 },
    caseData: { tenant_lender_id: 119, lender_name: 'Example Bank' }, lenders });
  assert.equal(result.tenant_lender_id, '999');
  assert.equal(result.lender_name, '');
  assert.equal(result.isLenderLocked, false);
});
test('new-case forms reset identity and amounts instead of retaining a previous case', () => {
  const previous = createSanctionForm();
  previous.lender_name = 'Previous bank'; previous.sanctioned_amount = 1000000;
  const next = createSanctionForm();
  assert.equal(next.lender_name, ''); assert.equal(next.sanctioned_amount, '');
  const disbursement = createDisbursementForm(); disbursement.amount = 1000000;
  assert.equal(createDisbursementForm().amount, '');
});
