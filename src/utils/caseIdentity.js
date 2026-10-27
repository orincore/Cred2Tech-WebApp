/**
 * Does the shared Customer record's plain identity (name / DOB / mobile / email)
 * describe a DIFFERENT, prior case rather than this one? If so the wizard must not
 * show it on stage 1.
 *
 * A primary applicant carries `source_applicant_id` in two situations:
 *  - "Continue as New Case": a brand-new, UNCONSENTED applicant started next to an
 *    existing customer (no name / mobile / email of its own). The customer record then
 *    belongs to the earlier case, so it stays hidden until this case's own consent
 *    confirms it.
 *  - A copy of a case - e.g. the case Cred2Tech creates for a lender and allocates to a
 *    Sourcing Partner. The copy keeps the original applicant's consent (`otp_verified`),
 *    and the identity IS this case's own: the customer who applied.
 *
 * So the link alone is not enough - it only means "carried over" while this case has not
 * been consented yet. (The previous rule, the link alone, blanked name / DOB / mobile /
 * email on every Cred2Tech lead's stage 1.) This is the same gate the PAN profile
 * already uses: only reused once this case's own primary applicant is consented.
 */
export const hasCarriedOverIdentity = (primaryApp) =>
  !!primaryApp?.source_applicant_id && !primaryApp?.otp_verified;
