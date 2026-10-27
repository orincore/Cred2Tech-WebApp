import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getDirectMsmeCaseDetail } from '../../api/adminMsmeService';
import { formatDate, toTitleCase, resolveEntityName, maskPan } from '../../utils/helpers';
import CaseStageBadge from './CaseStageBadge';
import LoadingSpinner from '../ui/LoadingSpinner';

const Field = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', overflowWrap: 'anywhere' }}>{value || '—'}</div>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ border: '1px solid var(--outline)', marginBottom: 12 }}>
    <div style={{ padding: '8px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--outline)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-muted)' }}>
      {title}
    </div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);

// Placeholder login address given to direct-signup (mobile-only) accounts.
const PLACEHOLDER_EMAIL = /@direct\.cred2tech\.local$/i;

// 40 -> "3 yrs 4 mos"
const formatMonths = (total) => {
  const years = Math.floor(total / 12);
  const months = total % 12;
  return [years ? `${years} yr${years === 1 ? '' : 's'}` : '', months ? `${months} mo${months === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
};

// Applicant.employment_type enum -> label. NA (not set) has no entry on purpose.
const EMPLOYMENT_LABELS = {
  SALARIED: 'Salaried',
  SELF_EMPLOYED: 'Self-employed',
  INCOME_NOT_CONSIDERED: 'Income not considered',
};

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 };

/**
 * Admin "View" for a Direct MSME lead: who the customer is and what they asked
 * for, so the admin can pick the right Sourcing Partner before allocating.
 * Read-only, and sharp-cornered like the rest of the admin portal. The PAN is
 * shown masked (last 3 characters only); applicant PANs / dates of birth are
 * deliberately not shown at all.
 */
const AdminMsmeLeadDetailModal = ({ caseId, onClose, onAllocate }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDirectMsmeCaseDetail(caseId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) { toast.error('Failed to load lead details'); onClose(); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const customer = data?.customer;
  const user = data?.msme_customer_user;
  const allocated = !!data?.assigned_dsa_tenant_id;
  // The terms the customer asked for, one line per lender, written at submit time.
  const requestedTerms = (data?.dsa_notes || '')
    .split('\n')
    .filter((l) => l.startsWith('[MSME Requested Terms]'))
    .map((l) => l.replace('[MSME Requested Terms]', '').trim());
  const applicants = data?.applicants || [];

  // The customer's email is the one they entered on stage 1 (the primary
  // applicant's), then the business email. The login account's own email is
  // last, and only if it is real: direct-signup accounts are created with a
  // generated "<mobile>@direct.cred2tech.local" address that must never be
  // shown as if it were the customer's.
  const primaryApplicant = applicants.find((a) => a.is_primary || a.type === 'PRIMARY');
  const email = [primaryApplicant?.email, customer?.business_email, user?.email]
    .find((e) => e && !PLACEHOLDER_EMAIL.test(String(e).trim())) || '';

  // The customer's own profile is usually empty for these two. Fall back to what
  // the GST / ESR pulls recorded: the GST nature of business reads like
  // "WORKS CONTRACT | PROPRIETORSHIP" - the part before the bar is the industry.
  const fin = data?.esr_financials;
  const industry = toTitleCase(customer?.industry || String(fin?.gst_industry_type || '').split('|')[0].trim());
  const vintageMonths = Number(fin?.business_vintage_months) || 0;
  const vintage = customer?.business_vintage
    || (vintageMonths > 0 ? formatMonths(vintageMonths) : '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
              {caseId}{data &&` · ${toTitleCase(resolveEntityName(customer)) || 'N/A'}`}
            </h2>
            {data && <div style={{ marginTop: 6 }}><CaseStageBadge stage={data.stage} /></div>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close" style={{ borderRadius: 0 }}>
            <X size={18} />
          </button>
        </div>

        {!data ? (
          <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={32} /></div>
        ) : (
          <>
            <Section title="Customer">
              <div style={grid}>
                <Field label="Name" value={toTitleCase(user?.name || '')} />
                <Field label="Mobile" value={user?.mobile} />
                <Field label="Email" value={email} />
                <Field label="Registered" value={formatDate(data.created_at)} />
              </div>
            </Section>

            <Section title="Business">
              <div style={grid}>
                <Field label="Business Name" value={toTitleCase(resolveEntityName(customer))} />
                <Field label="PAN" value={maskPan(customer?.business_pan)} />
                <Field label="Entity Type" value={toTitleCase(customer?.entity_type || data.entity_type || '')} />
                {/* Only shown when known - an always-empty "—" tells the admin nothing. */}
                {industry && <Field label="Industry" value={industry} />}
                {vintage && <Field label="Business Vintage" value={vintage} />}
              </div>
            </Section>

            <Section title="Loan Request">
              <div style={grid}>
                <Field label="Lender" value={data.lender_name} />
                <Field label="Product" value={data.product_type} />
                <Field label="Requested Loan" value={(data.loan_amount || data.sanctioned_amount) ? `₹${Number(data.loan_amount || data.sanctioned_amount).toLocaleString('en-IN')}` : 'Not specified'} />
                <Field label="CIBIL Score" value={data.cibil_score} />
              </div>
              {requestedTerms.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Requested terms</div>
                  {requestedTerms.map((t) => <div key={t} style={{ fontSize: 13, color: 'var(--on-surface)', lineHeight: 1.6 }}>{t}</div>)}
                </div>
              )}
            </Section>

            {applicants.length > 0 && (
              <Section title={`Applicants (${applicants.length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {applicants.map((a) => {
                    const isPrimary = a.is_primary || a.type === 'PRIMARY';
                    // `name` is empty for direct MSME customers - their name is the
                    // one verified against the PAN. The primary applicant is also
                    // the customer, so the case / customer name is the last resort.
                    const name = toTitleCase(
                      a.name || a.pan_verified_name
                      || (isPrimary ? (data.customer_name || resolveEntityName(customer)) : '')
                      || ''
                    ) || 'Unnamed';
                    // 'NA' is the enum's "not set", not a value to display.
                    const employment = EMPLOYMENT_LABELS[a.employment_type] || '';
                    const detail = [employment, a.cibil_score ? `CIBIL ${a.cibil_score}` : ''].filter(Boolean).join(' · ');
                    return (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>
                          {name}
                          <span style={{ fontWeight: 500, color: 'var(--on-muted)' }}> · {isPrimary ? 'Primary' : 'Co-applicant'}</span>
                        </span>
                        {detail && <span style={{ color: 'var(--on-muted)' }}>{detail}</span>}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section title="Payment & Allocation">
              <div style={grid}>
                <Field label="Payment" value={data.case_payment?.status === 'PAID' ? 'Paid' : 'Pending'} />
                <Field
                  label="Allocation"
                  value={allocated
                    ? `${toTitleCase(data.assigned_dsa_user?.name || '')}${data.assigned_dsa_user?.tenant?.name ? ` (${data.assigned_dsa_user.tenant.name})` : ''}`
                    : 'Unallocated'}
                />
                {allocated && <Field label="Allocated" value={data.allocated_at ? formatDate(data.allocated_at) : ''} />}
              </div>
            </Section>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" style={{ borderRadius: 0 }} onClick={onClose}>Close</button>
          {data && (
            <button className="btn btn-primary" style={{ borderRadius: 0 }} onClick={() => onAllocate(data)}>
              {allocated ? 'Reallocate' : 'Allocate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMsmeLeadDetailModal;
