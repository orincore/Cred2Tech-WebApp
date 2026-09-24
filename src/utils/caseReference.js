// Display reference for a case. A lender-clone child case (parent_case_id set)
// is shown as "CASE-<parent>.<child_sequence>" — the parent's own reference with
// a .1/.2/.3 suffix — instead of its unrelated autoincrement id. Mirrors the
// backend's src/utils/caseReference.js, so an on-screen reference matches what
// reports, emails and MIS exports print. Children cloned before child_sequence
// existed have no sequence and fall back to the plain "CASE-<id>", same as the
// backend. The DB id itself is unchanged — this is display only.
export function childCaseSuffix(c) {
  return c && c.parent_case_id && c.child_sequence ? `${c.parent_case_id}.${c.child_sequence}` : null;
}

export function formatCaseReference(c) {
  if (!c) return '';
  const suffix = childCaseSuffix(c);
  return suffix ? `CASE-${suffix}` : `CASE-${c.id}`;
}
