const text = value => value == null ? '' : String(value).trim();
const nameKey = value => text(value).replace(/\s+/g, ' ').toLowerCase();

export function createSanctionForm() {
  return { loan_account_number: '', sanction_date: new Date().toISOString().split('T')[0],
    sanctioned_amount: '', confirmed_roi: '', processing_fee: '', remarks: '',
    lender_name: '', product_type: '', tenant_lender_id: '' };
}

export function createDisbursementForm() {
  return { amount: '', disbursement_date: new Date().toISOString().split('T')[0],
    next_disbursement_due_date: '', remarks: '', pdd_pending: false,
    pdd_documents: [{ document_name: '', due_date: '' }], loan_account_number: '', subvention_amount: '' };
}

// Resolve identity independently of request completion order. Do not mix the
// lender ID of one source with the name of another lender, or choose by array order.
export function resolveSanctionContext({ caseData, sanction, form = {}, lenders = [] }) {
  function identity(source) {
    if (!source) return null;
    const id = text(source.tenant_lender_id);
    let name = text(source.lender_name);
    const byId = id && lenders.find(l => text(l.id) === id);
    if (!name && byId) name = text(byId.lender_name);
    const byName = !id && name ? lenders.filter(l => nameKey(l.lender_name) === nameKey(name)) : [];
    return { tenant_lender_id: id || (byName.length === 1 ? text(byName[0].id) : ''), lender_name: name };
  }
  const saved = identity(sanction);
  const assigned = identity(caseData);
  // Older sanctions can carry only an ID; the case name is a safe fallback
  // only when it refers to that same ID (or the case has no ID).
  if (saved?.tenant_lender_id && !saved.lender_name && assigned?.lender_name
      && (!assigned.tenant_lender_id || assigned.tenant_lender_id === saved.tenant_lender_id)) {
    saved.lender_name = assigned.lender_name;
  }
  const locked = saved?.lender_name ? saved : !saved?.tenant_lender_id && assigned?.lender_name ? assigned : null;
  const selected = identity(form);
  const lender = locked || (selected?.lender_name ? selected
    : saved?.tenant_lender_id ? saved : assigned?.tenant_lender_id ? assigned : selected)
    || { tenant_lender_id: '', lender_name: '' };
  const product = text(sanction?.product_type) || text(caseData?.product_type);
  return { ...lender, product_type: product || text(form.product_type),
    isLenderLocked: !!locked, isProductTypeLocked: !!product };
}
