import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Send, Save, CheckCircle2, Clock, XCircle,
  AlertCircle, TrendingUp, ChevronDown, ChevronUp, CheckSquare, UploadCloud,
  X, Mail, Phone, IndianRupee, Users, BarChart3, MapPin, FolderOpen, MessageSquare,
  Contact, Landmark, Info, Home, Briefcase, Building2, FileText, ScrollText, Trash2
} from 'lucide-react';
import { getTenantLenders } from '../api/tenantLenderService';
import { uploadDocument, deleteDocument } from '../api/documentHelper';
import { useAuth } from '../context/AuthContext';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR = (n, fallback = '—') => {
  if (n == null || n === '') return fallback;
  const num = Number(n);
  if (isNaN(num)) return fallback;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};
const fmtNum = (n, fallback = '—') => (n == null ? fallback : Number(n).toLocaleString('en-IN'));

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

const STATUS_CFG = {
  draft: { label: 'Draft', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)', Icon: Clock },
  submitted: { label: 'Submitted', color: 'var(--info)', bg: 'var(--info-bg)', Icon: Send },
  accepted: { label: 'Accepted', color: 'var(--success)', bg: 'var(--success-bg)', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'var(--error)', bg: 'var(--error-bg)', Icon: XCircle },
  query_raised: { label: 'Query', color: 'var(--warning)', bg: 'var(--warning-bg)', Icon: AlertCircle },
};

function ProposalStatusBadge({ status, size = 12 }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.color, padding: '4px 12px', borderRadius: 0,
      fontSize: size, fontWeight: 700, border: `1px solid ${c.color}`
    }}>
      <c.Icon size={size} /> {c.label}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, rightSlot }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 0, marginBottom: 20, overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 22px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon size={16} color="var(--primary)" />}
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{title}</span>
          </div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, marginLeft: 24 }}>{subtitle}</div>}
        </div>
        {rightSlot}
      </div>
      <div style={{ padding: '18px 22px' }}>{children}</div>
    </div>
  );
}

const hintStyle = { fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 };

// ─── EMI Calculator ───────────────────────────────────────────────────────────
// `initialAmount`/`initialTenorYears` seed the editable fields and must come
// from what's actually SAVED on the proposal (requested_amount/tenure_months)
// — falling back to the ESR ceiling only when nothing has been saved yet.
// `maxEligibleAmount`/`maxTenure` are a SEPARATE, fixed reference (the ESR
// ceiling) shown only as the "Max eligible" hint below each field. These were
// previously conflated into one prop each, which meant the fields silently
// re-displayed the ESR ceiling instead of the DSA's saved edits on every
// reload — a save always worked, it just never showed.
function EMICalculator({ initialAmount, maxEligibleAmount, roi, monthlyIncome, initialTenorYears, maxTenure, canOverrideRoi, onChange }) {
  const [amount, setAmount] = useState(initialAmount ? (initialAmount / 100000).toFixed(2) : '');
  const [tenor, setTenor] = useState(() => initialTenorYears ? String(initialTenorYears) : (maxTenure ? String(maxTenure) : '12'));
  const [rate, setRate] = useState(roi || '');
  const [showAmort, setShowAmort] = useState(false);

  useEffect(() => {
    if (initialAmount) setAmount((initialAmount / 100000).toFixed(2));
  }, [initialAmount]);

  // Surface every amount/tenor/rate edit to the parent (previously only the
  // amount field's onChange fired this, with a stale `tenor` closed over —
  // and the parent ignored it anyway — so editing Loan Details here never
  // actually reached the saved proposal; the "Loan Tenor Required" field in
  // the sent-to-lender email stayed blank no matter what a DSA typed here).
  useEffect(() => {
    onChange?.({ amount_lakhs: amount, tenor_years: tenor, roi_percent: rate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, tenor, rate]);

  const { emi, totalInterest, schedule } = useMemo(() => {
    const P = parseFloat(amount) * 100000 || 0;
    const r = parseFloat(rate) / 12 / 100 || 0;
    const n = parseInt(tenor, 10) * 12 || 0;
    if (!P || !r || !n) return { emi: 0, totalInterest: 0, totalRepayment: 0, emiFoirPct: 0, schedule: [] };
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalRepayment = emi * n;
    const totalInterest = totalRepayment - P;
    const emiFoirPct = monthlyIncome > 0 ? ((emi / monthlyIncome) * 100).toFixed(0) : null;
    const schedule = [];
    let bal = P;
    for (let i = 1; i <= Math.min(n, 24); i++) {
      const interest = bal * r;
      const principal = emi - interest;
      bal -= principal;
      schedule.push({ month: i, emi: emi.toFixed(0), interest: interest.toFixed(0), principal: principal.toFixed(0), balance: Math.max(0, bal).toFixed(0) });
    }
    return { emi, totalInterest, totalRepayment, emiFoirPct, schedule };
  }, [amount, tenor, rate, monthlyIncome]);

  return (
    <div>
      {/* Inputs */}
      <div className="pp-grid-3" style={{ marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>LOAN AMOUNT (₹ LAKHS) *</label>
          <input value={amount} onChange={e => setAmount(e.target.value)}
            type="number" placeholder="e.g. 39"
            style={inputStyle} />
          {maxEligibleAmount != null && (
            <div style={hintStyle}>Max eligible: ₹{(maxEligibleAmount / 100000).toFixed(2)} Lakhs</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>TENOR (YEARS) *</label>
          <input value={tenor} onChange={e => setTenor(e.target.value)}
            type="number" min="1" step="1" placeholder="e.g. 15"
            style={inputStyle} />
          {maxTenure && (
            <div style={hintStyle}>Max eligible: {maxTenure} years</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>INDICATIVE RATE (% P.A.)</label>
          <input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.01" placeholder="e.g. 10.50"
            style={inputStyle} />
          {roi != null && (
            <div style={hintStyle}>ESR indicative: {roi}% p.a.</div>
          )}
          {!canOverrideRoi && (
            <div style={hintStyle}>Calculator preview only — admin permission required to save a rate change</div>
          )}
        </div>
      </div>

      {/* EMI Result Cards */}
      <div className="pp-grid-2">
        <div style={{
          background: 'var(--primary-subtle)',
          border: '2px solid var(--primary)', borderRadius: 0, padding: '14px 18px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginBottom: 4 }}>Monthly EMI</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary-dark)' }}>
            {emi > 0 ? `₹${Math.round(emi).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 0, padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>Total Interest</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtINR(totalInterest)}</div>
        </div>
      </div>

      {/* Amortization toggle */}
      {schedule.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowAmort(!showAmort)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0
            }}>
            {showAmort ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAmort ? 'Hide' : 'Show'} Amortization Schedule
          </button>
          {showAmort && (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Month', 'EMI', 'Principal', 'Interest', 'Balance'].map(h => (
                      <th key={h} style={{
                        padding: '6px 10px', textAlign: 'right', fontWeight: 700,
                        color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(row => (
                    <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{row.month}</td>
                      <td style={tdStyle}>{fmtINR(row.emi)}</td>
                      <td style={tdStyle}>{fmtINR(row.principal)}</td>
                      <td style={{ ...tdStyle, color: 'var(--warning)' }}>{fmtINR(row.interest)}</td>
                      <td style={tdStyle}>{fmtINR(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseInt(tenor, 10) * 12 > 24 && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
                  Showing first 24 months. Full schedule available after submission.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Co-Applicant Card ────────────────────────────────────────────────────────
function ApplicantCard({ applicant, isPrimary, index }) {
  const bureauStatus = applicant.cibil_score ? 'KYC ✓' : null;
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 0, padding: '14px 18px',
      marginBottom: 14, background: isPrimary ? 'var(--bg-elevated)' : 'var(--bg-surface)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{applicant.name || `Applicant ${index + 1}`}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {isPrimary ? 'Primary Borrower / Promoter' : `Co-Applicant ${index}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isPrimary && (
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 0, background: 'none',
              border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 600
            }}>Primary</span>
          )}
          {bureauStatus && (
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 0,
              background: 'var(--success-bg)', color: 'var(--success)', fontWeight: 600, border: '1px solid var(--success)'
            }}>
              {bureauStatus}
            </span>
          )}
        </div>
      </div>

      <div className="pp-grid-4-sm">
        <InfoCell label="PAN" value={applicant.pan_number || '—'} />
        <InfoCell label="Mobile" value={applicant.mobile || '—'} />
        <InfoCell label="Bureau Score" value={applicant.cibil_score || '—'} />
        <InfoCell label="KYC Status" value={applicant.otp_verified ? '✓ Verified' : 'Pending'} valueColor={applicant.otp_verified ? 'var(--success)' : 'var(--warning)'} />
      </div>
    </div>
  );
}

function InfoCell({ label, value, valueColor }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: 3
      }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: valueColor || 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}

// ─── Financial Summary ────────────────────────────────────────────────────────
function FinancialSummary({ summary, prefill, isSalaried = false }) {
  const { gst, itr_years, bank_accounts } = summary || {};

  return (
    <div>
      {/* GST — never applicable to a salaried employee, who has no business turnover to report */}
      {!isSalaried && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: 'var(--success)', background: 'var(--success-bg)',
              padding: '3px 10px', borderRadius: 0, letterSpacing: '1px'
            }}>GST</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>GST TURNOVER SUMMARY</span>
          </div>
          <div className="pp-grid-5">
            {[
              { label: 'Avg Monthly Turnover', value: fmtINR(gst?.avg_monthly_turnover) },
              { label: `Annual Turnover (${gst?.fy_latest || 'FY Latest'})`, value: fmtINR(gst?.turnover_latest) },
              { label: `Annual Turnover (${gst?.fy_previous || 'FY Previous'})`, value: fmtINR(gst?.turnover_previous) },
              { label: 'Months Filed (12M)', value: gst?.months_filed != null ? `${gst.months_filed} / 12` : '—' },
              {
                label: 'Nil Return Months', value: gst?.nil_months != null ? String(gst.nil_months) : '—',
                red: gst?.nil_months > 0
              },
            ].map(({ label, value, red }) => (
              <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 0, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: red ? 'var(--error)' : 'var(--success)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ITR */}
      {itr_years?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: 'var(--info)', background: 'var(--info-bg)',
              padding: '3px 10px', borderRadius: 0, letterSpacing: '1px'
            }}>ITR</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>INCOME TAX RETURN SUMMARY</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                {['Assessment Year', 'Gross Turnover / Receipts', 'Net Profit (After Tax)', 'Filing Status'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left', fontWeight: 700,
                    color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itr_years.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.ay}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtINR(row.gross_receipts)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--success)' }}>{fmtINR(row.net_profit)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 11 }}>✓ {row.filing_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Bank */}
      {bank_accounts?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: 'var(--primary-dark)', background: 'var(--primary-subtle)',
              padding: '3px 10px', borderRadius: 0, letterSpacing: '1px'
            }}>BANK</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>BANKING SUMMARY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {bank_accounts.map((acc, i) => (
              <div key={i} style={{
                border: `1px solid ${i === 0 ? 'var(--info)' : 'var(--border)'}`,
                borderRadius: 0, padding: '14px 16px',
                background: i === 0 ? 'var(--info-bg)' : 'var(--bg-elevated)'
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--info)' : 'var(--text-secondary)',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6
                }}><Landmark size={13} /> {i === 0 ? 'Primary Current Account' : acc.label}</div>
                {[
                  ['Bank & Branch', acc.bank_name],
                  ['Account Number', acc.account_number],
                  ['Avg Monthly Credit', fmtINR(acc.avg_monthly_credit)],
                  ['Avg Monthly Debit', fmtINR(acc.avg_monthly_debit)],
                  ['Avg Closing Balance', fmtINR(acc.avg_closing_balance || acc.avg_balance_latest)],
                  ['Cheque Bounces (12M)', acc.cheque_bounces != null ? (acc.cheque_bounces === 0 ? 'Nil' : acc.cheque_bounces) : '—'],
                  ['Statement Period', acc.statement_period],
                ].map(([label, val]) => val != null && val !== '—' ? (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12
                  }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: label.includes('Bounce') && val !== 'Nil' ? 'var(--error)' : 'var(--text-primary)' }}>
                      {val === 0 ? 'Nil' : val}
                    </span>
                  </div>
                ) : null)}
              </div>
            ))}
          </div>
        </div>
      )}

      {(isSalaried || !gst?.turnover_latest) && !itr_years?.length && !bank_accounts?.length && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          <Info size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {isSalaried
            ? 'Financial data will appear here once ITR/Bank analytics are completed for this case.'
            : 'Financial data will appear here once GST/ITR/Bank analytics are completed for this case.'}
        </div>
      )}
    </div>
  );
}

// ─── Address Section ──────────────────────────────────────────────────────────
// Each field a reported address can be assigned to gets its own icon + accent
// color, used consistently for both the toggle chips and the field badges
// below — so "this chip is Office" reads the same way everywhere on screen.
const ADDRESS_FIELD_META = {
  residential: { label: 'Residential', icon: Home, color: 'var(--info)', bg: 'var(--info-bg)' },
  office:      { label: 'Office',      icon: Briefcase, color: 'var(--success)', bg: 'var(--success-bg)' },
  property:    { label: 'Property',    icon: Building2, color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

function AddressSection({ addresses, onChange, readOnly, isSalaried = false, candidates = [] }) {
  // Bureau data reports one address per tradeline/employer it ever saw — it
  // never says which is "residential" vs "office" — and GST's principal
  // address is only ever a business address. None of these are authoritative
  // on their own, so the user picks which reported address (if any) is
  // actually the residential/office address; unrelated to manual override,
  // which always stays available in the textareas below.
  const toggleCandidate = (candidate, field) => {
    const isSelected = addresses[field] === candidate.text;
    onChange({ ...addresses, [field]: isSelected ? '' : candidate.text });
  };

  const residentialSource = candidates.find(c => c.text === addresses.residential)?.source;
  const officeSource = candidates.find(c => c.text === addresses.office)?.source;
  const propertySource = candidates.find(c => c.text === addresses.property)?.source;
  const sourceBadge = (source) => source === 'GST'
    ? { label: 'FROM GST', color: 'var(--success)', bg: 'var(--success-bg)' }
    : source === 'BUREAU'
      ? { label: 'FROM BUREAU', color: 'var(--info)', bg: 'var(--info-bg)' }
      : { label: 'MANUAL ENTRY', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
  const residentialBadge = sourceBadge(residentialSource);
  const officeBadge = sourceBadge(officeSource);
  const propertyBadge = sourceBadge(propertySource);

  return (
    <div>
      {candidates.length > 0 && (
        <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reported Addresses
              </span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--bg-surface)',
              border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999
            }}>{candidates.length} found</span>
          </div>
          <div style={{ padding: '6px 16px 4px', fontSize: 11, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
            Tick which field each address applies to — one address can cover more than one field.
          </div>
          {candidates.map(c => {
            const isActive = ['residential', 'office', 'property'].some(f => addresses[f] === c.text);
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
                borderLeft: `3px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                background: isActive ? 'var(--primary-subtle)' : 'transparent',
                transition: 'background 0.15s ease, border-color 0.15s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 220 }}>
                  {c.source === 'GST' ? <ScrollText size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} /> : <FileText size={14} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />}
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{c.text}</span>
                    <div style={{ marginTop: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        color: c.source === 'GST' ? 'var(--success)' : 'var(--info)',
                        background: c.source === 'GST' ? 'var(--success-bg)' : 'var(--info-bg)',
                      }}>{c.source}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {Object.entries(ADDRESS_FIELD_META).map(([field, meta]) => {
                    const checked = addresses[field] === c.text;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={field}
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggleCandidate(c, field)}
                        title={`Use as ${meta.label} address`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                          border: `1px solid ${checked ? meta.color : 'var(--border)'}`,
                          background: checked ? meta.color : 'var(--bg-surface)',
                          color: checked ? '#fff' : 'var(--text-secondary)',
                          borderRadius: 0, fontSize: 11, fontWeight: 600,
                          cursor: readOnly ? 'default' : 'pointer',
                          transition: 'all 0.12s ease'
                        }}
                      >
                        {checked ? <CheckSquare size={13} /> : <Icon size={13} />}
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pp-grid-2" style={{ marginBottom: 16 }}>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Home size={12} color="var(--info)" />
            CURRENT RESIDENTIAL ADDRESS
            <span style={{
              fontSize: 9, color: residentialBadge.color, fontWeight: 600,
              background: residentialBadge.bg, padding: '1px 6px', borderRadius: 0
            }}>{residentialBadge.label}</span>
          </label>
          <textarea rows={3} value={addresses.residential || ''} readOnly={readOnly}
            onChange={e => onChange({ ...addresses, residential: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Current residential address" />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {residentialSource ? 'Selected from reported addresses above — editable' : (candidates.length > 0 ? 'None selected above — enter manually' : 'Not available from bureau data — enter manually')}
          </div>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={12} color="var(--success)" />
            OFFICE / BUSINESS ADDRESS
            <span style={{
              fontSize: 9, color: officeBadge.color, fontWeight: 600,
              background: officeBadge.bg, padding: '1px 6px', borderRadius: 0
            }}>{officeBadge.label}</span>
          </label>
          <textarea rows={3} value={addresses.office || ''} readOnly={readOnly}
            onChange={e => onChange({ ...addresses, office: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Office / business address" />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {officeSource ? `Selected from reported addresses above — editable` : (candidates.length > 0 ? 'None selected above — enter manually' : (isSalaried ? 'No GST/bureau office address found — enter manually' : 'Not available — enter manually'))}
          </div>
        </div>
      </div>
      <div>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={12} color="var(--warning)" />
          PROPERTY ADDRESS (COLLATERAL) *
          <span style={{
            fontSize: 9, color: propertyBadge.color, fontWeight: 600,
            background: propertyBadge.bg, padding: '1px 6px', borderRadius: 0
          }}>{propertyBadge.label}</span>
        </label>
        <textarea rows={3} value={addresses.property || ''} readOnly={readOnly}
          onChange={e => onChange({ ...addresses, property: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder="Survey no., plot no., full address of the collateral property" />
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
          {propertySource ? 'Selected from reported addresses above — editable' : (candidates.length > 0 ? 'None selected above — enter manually' : 'Not available — enter manually')}
        </div>
      </div>
    </div>
  );
}

// ─── KYC Documents Grid ───────────────────────────────────────────────────────
// ─── KYC Document Categories (Proposal stage) ─────────────────────────────────
// Each category groups related document sub-types under one section. Adding a
// document picks one of `options` (or, for the plain "Others" bucket, just
// names it) then uploads — multiple documents can be added per category (e.g.
// both MOA and AOA under Incorporation), unlike the old one-fixed-slot-per-type
// scheme. `perApplicant` categories (ID Proof, Residence Address Proof) render
// once per applicant; everything else is entity-level, shared by the case.
const KYC_CATEGORIES = [
  {
    id: 'id_proof', label: 'ID Proof', perApplicant: true, required: true,
    options: [
      { type: 'PAN_CARD', label: 'PAN Card' },
      { type: 'DRIVING_LICENSE', label: 'Driving Licence' },
      { type: 'VOTER_ID', label: 'Voter ID Card' },
      { type: 'PASSPORT', label: 'Passport' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  {
    id: 'residence_address_proof', label: 'Residence Address Proof', perApplicant: true, required: true,
    options: [
      { type: 'UTILITY_BILL', label: 'Utility Bill' },
      { type: 'RENT_AGREEMENT', label: 'Rent Agreement' },
      { type: 'VOTER_ID', label: 'Voter ID Card' },
      { type: 'PASSPORT', label: 'Passport' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Business/self-employed only — never applicable to a salaried case.
  {
    id: 'incorporation', label: 'Incorporation Document', perApplicant: false, msmeOnly: true, required: false,
    options: [
      { type: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation' },
      { type: 'MOA', label: 'MOA (Memorandum of Association)' },
      { type: 'AOA', label: 'AOA (Articles of Association)' },
      { type: 'PARTNERSHIP_DEED', label: 'Partnership Deed' },
    ],
  },
  {
    id: 'office_address_proof', label: 'Office Address Proof', perApplicant: false, msmeOnly: true, required: false,
    options: [
      { type: 'UTILITY_BILL', label: 'Utility Bill' },
      { type: 'RENT_AGREEMENT', label: 'Rent Agreement / Lease Deed' },
      { type: 'TRADE_LICENSE', label: 'Trade License' },
      { type: 'GST_PDF', label: 'GST Registration Certificate' },
    ],
  },
  {
    id: 'income_documents', label: 'Income Documents', perApplicant: false, required: true,
    options: [
      { type: 'ITR', label: 'ITR' },
      { type: 'BANK_STATEMENT', label: 'Bank Statement' },
      { type: 'GST_RETURNS', label: 'GST Returns' },
      { type: 'SALARY_SLIP', label: 'Salary Slip' },
      { type: 'FORM_16', label: 'Form 16' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Kept separate from Income Documents (manual uploads) — these are the
  // exact document_type values the automated pull pipeline saves
  // (pullSync.service.js / document.service.js). A document only renders at
  // all if its type matches one of a category's options
  // (docBelongsToCategory below), so without these exact values these
  // auto-pulled documents were invisible on this page entirely, not just
  // miscategorized. JSON variants (GST_REPORT_JSON/BANK_JSON) are
  // deliberately excluded — raw data files, not required in the proposal.
  {
    id: 'api_fetched_documents', label: 'Fetched from API', perApplicant: false, required: false,
    options: [
      { type: 'ITR_EXCEL', label: 'ITR (Excel)' },
      { type: 'BANK_EXCEL', label: 'Bank Statement (Excel)' },
      { type: 'GST_REPORT_PDF', label: 'GST Report (PDF)' },
      { type: 'GST_REPORT_EXCEL', label: 'GST Report (Excel)' },
    ],
  },
  {
    id: 'property_documents', label: 'Property Documents', perApplicant: false, required: false,
    options: [
      { type: 'SALE_DEED', label: 'Sale Deed' },
      { type: 'ENCUMBRANCE_CERTIFICATE', label: 'Encumbrance Certificate (EC)' },
      { type: 'KHATA', label: 'Khata / Property Tax Receipt' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Freeform catch-all — no fixed sub-type list, just a name + upload.
  { id: 'others', label: 'Other Documents', perApplicant: false, required: false, freeform: true },
];

// Master dropdown offered on any user-created custom category — every
// sub-type across the fixed categories, deduped, plus an Others entry.
const ALL_DOCUMENT_OPTIONS = (() => {
  const seen = new Map();
  for (const cat of KYC_CATEGORIES) {
    for (const opt of cat.options || []) {
      if (opt.type !== 'OTHER' && !seen.has(opt.type)) seen.set(opt.type, opt.label);
    }
  }
  return [
    ...[...seen.entries()].map(([type, label]) => ({ type, label })),
    { type: 'OTHER', label: 'Others', customLabel: true },
  ];
})();

// A doc belongs to a category if its type is one of the category's fixed
// options — except type OTHER, which is shared by several categories'
// "Others" sub-option, the freeform bucket, and every custom category (custom
// categories always upload as OTHER regardless of which dropdown sub-type was
// picked, so they never collide with a fixed category that happens to share
// the same sub-type label), so those are disambiguated by metadata.category
// (stamped at upload time). Legacy/foreign OTHER docs with no such tag fall
// back to the freeform "Other Documents" bucket.
function docBelongsToCategory(doc, category) {
  if (doc.document_type === 'OTHER' || category.custom) {
    return (doc.metadata?.category || 'others') === category.id;
  }
  return (category.options || []).some(o => o.type === doc.document_type);
}

function KYCDocumentsSection({ applicationApplicants, docs, onToggle, isSubmitted, caseId, onUploaded, isSalaried = false }) {
  const primary = applicationApplicants.find(a => a.type === 'PRIMARY');
  const coApplicants = applicationApplicants.filter(a => a.type !== 'PRIMARY');
  const allApplicants = [primary, ...coApplicants].filter(Boolean);

  const allDocs = Object.values(docs).flat();
  const fixedCategories = KYC_CATEGORIES.filter(cat => !(cat.msmeOnly && isSalaried));
  const fixedIds = new Set(fixedCategories.map(c => c.id));

  // Custom categories a user already uploaded something into (in this or an
  // earlier session) — recovered from doc metadata so they survive a reload
  // even though they aren't in the fixed KYC_CATEGORIES list.
  const discoveredCustomCategories = [];
  const seenCustomIds = new Set();
  for (const d of allDocs) {
    const catId = d.metadata?.category;
    if (!catId || fixedIds.has(catId) || seenCustomIds.has(catId)) continue;
    seenCustomIds.add(catId);
    discoveredCustomCategories.push({
      id: catId,
      label: d.metadata?.category_label || catId,
      perApplicant: false, required: false, custom: true,
      options: ALL_DOCUMENT_OPTIONS,
    });
  }

  // Custom categories created this session but with nothing uploaded to them
  // yet (so they wouldn't otherwise show up via the discovery pass above).
  const [draftCustomCategories, setDraftCustomCategories] = useState([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setDraftCustomCategories(prev => [...prev, {
      id, label: name, perApplicant: false, required: false, custom: true,
      options: ALL_DOCUMENT_OPTIONS,
    }]);
    setNewCategoryName('');
    setAddingCategory(false);
  };

  const customCategories = [
    ...discoveredCustomCategories,
    ...draftCustomCategories.filter(c => !seenCustomIds.has(c.id)),
  ];
  const categories = [...fixedCategories, ...customCategories];

  const findCategoryDocs = (category, applicantId) => allDocs.filter(d =>
    (applicantId === undefined || d.applicant_id === applicantId) && docBelongsToCategory(d, category)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {categories.map(category => (
        <KYCCategoryBlock
          key={category.id}
          category={category}
          applicants={category.perApplicant ? allApplicants : [null]}
          findCategoryDocs={findCategoryDocs}
          onToggle={onToggle}
          isSubmitted={isSubmitted}
          caseId={caseId}
          onUploaded={onUploaded}
        />
      ))}

      {!isSubmitted && (
        addingCategory ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              autoFocus
              className="form-control"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setAddingCategory(false); }}
              placeholder="New category name (e.g. Vehicle Documents)"
              style={{ maxWidth: 260, fontSize: 12, padding: '6px 4px' }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCategory} style={{ borderRadius: 0 }}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAddingCategory(false); setNewCategoryName(''); }} style={{ borderRadius: 0 }}>Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: 'transparent', color: 'var(--primary)',
              border: '1px dashed var(--primary)', borderRadius: 0, fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}
          >
            + Add Custom Category
          </button>
        )
      )}
    </div>
  );
}

// Counts required categories still missing at least one document — for
// perApplicant categories, missing for ANY applicant counts as one pending
// item. Used by the "X Pending" badge above this section.
function countKycPending(applicants, allDocs, isSalaried) {
  const categories = KYC_CATEGORIES.filter(cat => !(cat.msmeOnly && isSalaried) && cat.required);
  const primary = applicants.find(a => a.type === 'PRIMARY');
  const coApplicants = applicants.filter(a => a.type !== 'PRIMARY');
  const allApplicants = [primary, ...coApplicants].filter(Boolean);

  return categories.reduce((count, category) => {
    if (category.perApplicant) {
      const missing = allApplicants.filter(app =>
        !allDocs.some(d => d.applicant_id === app.id && docBelongsToCategory(d, category))
      ).length;
      return count + missing;
    }
    return count + (allDocs.some(d => docBelongsToCategory(d, category)) ? 0 : 1);
  }, 0);
}

function KYCCategoryBlock({ category, applicants, findCategoryDocs, onToggle, isSubmitted, caseId, onUploaded }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{category.label}</span>
        {category.required && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--error)', background: 'var(--error-bg)', padding: '2px 6px', borderRadius: 4 }}>REQUIRED</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {applicants.map((app, idx) => {
          const docList = findCategoryDocs(category, app?.id);
          const applicantLabel = app ? (app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Borrower ${idx}`) : null;
          return (
            <div key={app?.id ?? 'entity'}>
              {applicantLabel && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{applicantLabel}</div>
              )}
              {docList.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10, marginBottom: 8 }}>
                  {docList.map(doc => (
                    <DocCard key={doc.id}
                      label={doc.document_type === 'OTHER' ? (doc.metadata?.custom_label || 'Other Document') : (category.options?.find(o => o.type === doc.document_type)?.label || doc.document_type)}
                      uploaded
                      doc={doc}
                      onToggle={onToggle ? () => onToggle(doc) : null}
                      required={category.required}
                      isSubmitted={isSubmitted}
                      caseId={caseId}
                      docType={doc.document_type}
                      applicantId={app?.id}
                      onUploaded={onUploaded}
                    />
                  ))}
                </div>
              )}
              <AddDocumentRow
                category={category}
                applicantId={app?.id}
                caseId={caseId}
                isSubmitted={isSubmitted}
                onUploaded={onUploaded}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddDocumentRow({ category, applicantId, caseId, isSubmitted, onUploaded }) {
  const [selectedType, setSelectedType] = useState(category.options?.[0]?.type || 'OTHER');
  const [customLabel, setCustomLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef(null);

  const selectedOption = category.options?.find(o => o.type === selectedType);
  const needsCustomLabel = category.freeform || !!selectedOption?.customLabel;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (needsCustomLabel && !customLabel.trim()) {
      toast.error('Enter a document name first');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      // A custom (user-created) category always uploads as document_type
      // OTHER, tagged with its own category id/label — regardless of which
      // sub-type was picked from the master dropdown, since that dropdown is
      // just for a descriptive label here, not a real per-type slot (picking
      // "PAN Card" in a custom category must never make the doc also show up
      // under the fixed "ID Proof" category).
      const docType = (category.freeform || category.custom) ? 'OTHER' : selectedType;
      const label = needsCustomLabel
        ? customLabel.trim()
        : (category.custom ? selectedOption?.label : undefined);
      await uploadDocument(file, caseId, docType, {
        applicantId,
        label,
        category: (needsCustomLabel || category.custom) ? category.id : undefined,
        categoryLabel: category.custom ? category.label : undefined,
      });
      toast.success(`${file.name} uploaded ✓`);
      setCustomLabel('');
      onUploaded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (isSubmitted) return null;

  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 0
    }}>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.docx,.doc,.zip"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {!category.freeform && (
        <select
          className="form-control"
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          style={{ maxWidth: 220, fontSize: 12, padding: '6px 4px' }}
          disabled={uploading}
        >
          {category.options.map(o => <option key={o.type} value={o.type}>{o.label}</option>)}
        </select>
      )}
      {needsCustomLabel && (
        <input
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          placeholder={category.freeform ? 'Document name (e.g. Udyam Registration)' : 'Document name'}
          className="form-control"
          style={{ maxWidth: 220, fontSize: 12, padding: '6px 4px' }}
          disabled={uploading}
        />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn btn-secondary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 5, borderRadius: 0 }}
      >
        <UploadCloud size={12} /> {uploading ? 'Uploading…' : 'Add Document'}
      </button>
    </div>
  );
}

function DocCard({ label, uploaded, doc, onToggle, required = true, isSubmitted, caseId, docType, applicantId, onUploaded }) {
  const isAttached = doc?.is_attached;
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = React.useRef(null);

  const handleRemove = async () => {
    if (!doc?.id) return;
    const name = doc.original_file_name || label;
    if (!window.confirm(`Remove "${name}"? You can upload a replacement afterwards.`)) return;
    setRemoving(true);
    try {
      await deleteDocument(doc.id);
      toast.success('Document removed');
      // Re-list from the server rather than mutating locally: the doc is
      // soft-deleted, so the refreshed list simply no longer contains it, and
      // the category's required/pending state recomputes on its own.
      onUploaded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to remove document');
    } finally {
      setRemoving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file, caseId, docType || 'OTHER', {
        applicantId,
        label: doc?.document_type === 'OTHER' ? doc?.metadata?.custom_label : undefined,
        category: doc?.metadata?.category,
        categoryLabel: doc?.metadata?.category_label,
      });
      toast.success(`${file.name} uploaded ✓`);
      onUploaded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{
      border: `1px solid ${!uploaded && required ? 'var(--error)' : uploaded ? 'var(--success)' : 'var(--border)'}`,
      borderRadius: 0, overflow: 'hidden'
    }}>
      <div style={{ padding: '10px 12px', background: uploaded ? 'var(--success-bg)' : !required ? 'var(--bg-elevated)' : 'var(--error-bg)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: uploaded ? 'var(--success)' : required ? 'var(--error)' : 'var(--text-tertiary)' }}>
          {uploaded
            ? `✓ ${doc?.original_file_name || 'Uploaded'}`
            : required ? '△ Pending' : '— Optional'}
        </div>
      </div>
      <div style={{ padding: '6px 8px', borderTop: `1px solid var(--border)`, background: 'var(--bg-elevated)' }}>
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.docx,.doc,.zip"
          onChange={handleFileChange}
          disabled={isSubmitted || uploading}
        />
        {uploaded && doc ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onToggle?.()}
              disabled={isSubmitted}
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: isAttached ? '1px solid var(--success)' : '1px solid var(--border)',
                borderRadius: 0, background: isAttached ? 'var(--success-bg)' : 'var(--bg-surface)',
                color: isAttached ? 'var(--success)' : 'var(--text-secondary)'
              }}>
              {isAttached ? '✓ Included' : 'Include'}
            </button>
            {!isSubmitted && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading || removing}
                style={{
                  padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border)', borderRadius: 0,
                  background: 'var(--bg-surface)', color: 'var(--text-secondary)'
                }}
                title="Replace file">
                ↑
              </button>
            )}
            {!isSubmitted && (
              <button
                onClick={handleRemove}
                disabled={uploading || removing}
                style={{
                  padding: '5px 8px', fontSize: 11, fontWeight: 600,
                  cursor: uploading || removing ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--error)', borderRadius: 0,
                  background: 'var(--bg-surface)', color: 'var(--error)',
                  display: 'flex', alignItems: 'center'
                }}
                title="Remove this file">
                {removing ? '…' : <Trash2 size={12} />}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isSubmitted || uploading}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 11, fontWeight: 700,
              cursor: isSubmitted || uploading ? 'not-allowed' : 'pointer',
              border: 'none', borderRadius: 0,
              background: uploading ? 'var(--text-tertiary)' : required ? 'var(--primary)' : 'var(--text-tertiary)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}>
            <UploadCloud size={12} />
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5
};
const inputStyle = {
  width: '100%', padding: '8px 0', borderRadius: 0,
  border: 'none', borderBottom: '2px solid var(--border)', fontSize: 14, fontWeight: 600,
  background: 'transparent', color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box'
};
const tdStyle = { padding: '6px 10px', textAlign: 'right', fontSize: 11 };

// ─── Main ProposalPage ─────────────────────────────────────────────────────────
// Step 7 of the case journey — rendered inline by AddCustomerWizardPage (not
// its own route), so it takes caseId/proposalId/onBack as props instead of
// reading useParams()/navigating itself.
export default function ProposalPage({ caseId, proposalId, onBack, isMsme = false, isSalaried = false }) {
  const isMobile = useIsMobile();
  const { hasRole } = useAuth();
  // roi_min/roi_max are backend-enforced override fields (see
  // updateProposalDraft's overrideFields check) — only DSA_ADMIN/SUPER_ADMIN
  // may persist them. Sending roi_min as anyone else rejects the *entire*
  // PATCH (amount/tenor included), so the Rate field must only be included
  // in the save payload for users who actually have this permission.
  const canOverrideRoi = hasRole(['DSA_ADMIN', 'SUPER_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [showOtherLenderModal, setShowOtherLenderModal] = useState(false);
  const [sendConfirmResult, setSendConfirmResult] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [form, setForm] = useState({
    loan_purpose: '', remarks: '', preferred_banking_program: ''
  });
  // Loan Details (EMICalculator amount/tenor) — kept separate from `form`
  // since it's persisted as requested_amount (paise-equivalent rupees) /
  // tenure_months, not the raw lakhs/years the calculator edits in.
  const [loanTerms, setLoanTerms] = useState({ amount_lakhs: '', tenor_years: '', roi_percent: '' });
  const [addresses, setAddresses] = useState({ residential: '', office: '', property: '' });
  const emptyRef = () => ({ name: '', mobile: '', relationship: '', address: '' });
  const [references, setReferences] = useState([emptyRef(), emptyRef()]);

  /**
   * @param {{silent?: boolean}} opts - `silent` refreshes server data in place:
   *   it skips the page-level `loading` flag and leaves the user-editable form
   *   state alone. Used after document upload/replace/delete/toggle, where the
   *   only thing that changed is `documents_by_category`.
   *
   *   Without it, those actions called the full loader, which did two damaging
   *   things: `setLoading(true)` hit the `if (loading) return <spinner>` below
   *   and unmounted the entire page — losing scroll position and every piece of
   *   local state in the KYC section (draft custom categories, the
   *   add-category input) — and the form/address/reference setters below
   *   overwrote any edits the user had typed but not yet saved.
   */
  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await caseService.getProposal(caseId, proposalId);
      setData(res);
      // A silent refresh stops here: `data` (and therefore the document lists)
      // is current, and nothing the user is editing gets touched.
      if (silent) return;
      const p = res.proposal;
      setForm({
        loan_purpose: p.loan_purpose || '',
        remarks: p.remarks || '',
        additional_notes: p.additional_notes || '',
        preferred_banking_program: p.preferred_banking_program || '',
      });
      // Parse addresses + references from additional_notes JSON; fall back to
      // prefill defaults when nothing was saved yet — office from the
      // GST-registered principal address (self-employed only; a salaried case
      // has no GST registration, so this is always empty for them), and
      // residential from the bureau's most-recently-reported address. Both
      // are just best-guess defaults — the user confirms/corrects them via
      // the address_candidates checkbox picker or manual entry.
      try {
        const stored = p.additional_notes ? JSON.parse(p.additional_notes) : null;
        setAddresses({
          residential: stored?.__addresses?.residential || res.prefill?.residential_address || '',
          office: stored?.__addresses?.office || res.prefill?.office_address || '',
          property: stored?.__addresses?.property || '',
        });
        if (stored?.__references) setReferences(stored.__references);
        setForm(f => ({ ...f }));
      } catch { }
    } catch (e) {
      toast.error('Failed to load proposal');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [caseId, proposalId]);

  useEffect(() => { load(); }, [load]);

  // Refresh only what a document action changes. Stable identity so it doesn't
  // retrigger effects or re-render the KYC tree unnecessarily.
  const refreshDocuments = useCallback(() => load({ silent: true }), [load]);

  const handleSave = async (silent = false) => {
    try {
      setSaving(true);
      // Store addresses + references inside additional_notes as a JSON blob
      const additionalNotesPayload = JSON.stringify({
        __addresses: addresses,
        __references: references,
      });
      // Loan Details (amount/tenor) only gets sent once the calculator has
      // produced a real value — an empty/partial field must never overwrite
      // a previously-saved requested_amount/tenure_months with 0.
      const amountLakhsNum = parseFloat(loanTerms.amount_lakhs);
      const tenorYearsNum = parseFloat(loanTerms.tenor_years);
      const roiPercentNum = parseFloat(loanTerms.roi_percent);
      const loanTermsPayload = {};
      if (!isNaN(amountLakhsNum) && amountLakhsNum > 0) loanTermsPayload.requested_amount = Math.round(amountLakhsNum * 100000);
      if (!isNaN(tenorYearsNum) && tenorYearsNum > 0) loanTermsPayload.tenure_months = Math.round(tenorYearsNum * 12);
      // Only admins are allowed to persist ROI (see canOverrideRoi above) —
      // everyone else can still play with the Rate field for their own EMI
      // preview, it just never leaves the browser.
      if (canOverrideRoi && !isNaN(roiPercentNum) && roiPercentNum > 0) {
        loanTermsPayload.roi_min = roiPercentNum;
        loanTermsPayload.roi_max = roiPercentNum;
      }

      await caseService.updateProposal(caseId, proposalId, {
        loan_purpose: form.loan_purpose,
        remarks: form.remarks,
        additional_notes: additionalNotesPayload,
        preferred_banking_program: form.preferred_banking_program,
        ...loanTermsPayload,
      });
      if (!silent) toast.success('Draft saved');
    } catch (e) {
      if (!silent) toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => setShowSubmitConfirm(true);

  const performSubmit = async () => {
    // The dialog stays open through the whole send — its body swaps to
    // <SendingStatus /> below (driven by `submitting`) instead of closing
    // and handing off to a separate overlay.
    try {
      setSubmitting(true);
      await handleSave(true);
      // sendProposal actually dispatches the email to the lender's contact
      // (and marks the proposal submitted on success) — the old
      // submitProposal call here only flipped status with no email ever
      // sent, so clicking "Send to {lender}" silently did nothing.
      const result = await caseService.sendProposal(caseId, proposalId);
      setSendConfirmResult(result);
      setShowSubmitConfirm(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send proposal');
      setShowSubmitConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDoc = async (doc) => {
    if (data?.proposal?.proposal_status === 'submitted') {
      toast.error('Cannot modify a submitted proposal'); return;
    }
    try {
      if (doc.is_attached) await caseService.detachProposalDoc(caseId, proposalId, doc.id);
      else await caseService.attachProposalDocs(caseId, proposalId, [doc.id]);
      // Attach/detach only flips is_attached — refresh in place rather than
      // reloading the page and discarding unsaved form edits.
      await refreshDocuments();
    } catch { toast.error('Failed to update document'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <LoadingSpinner size={40} />
    </div>
  );
  if (!data) return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <h3>Proposal not found</h3>
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
    </div>
  );

  const { proposal, prefill, applicants = [], co_applicants = [],
    financial_summary, documents_by_category, lender_eligibility } = data;
  const lenderName = proposal.lender_name || 'Lender';
  // "Max eligible" reference (hint only) — the ESR ceiling, fixed regardless
  // of what's actually been saved/edited on the proposal.
  const maxTenureMonths = lender_eligibility?.max_tenure_months ?? proposal.tenure_months ?? null;
  const maxTenureYears = maxTenureMonths
    ? (maxTenureMonths % 12 === 0 ? String(maxTenureMonths / 12) : (maxTenureMonths / 12).toFixed(1))
    : null;
  // Editable field's starting value — must prefer what's actually saved on
  // the proposal (requested_amount/tenure_months) over the ESR ceiling,
  // otherwise every reload re-shows the ceiling and any saved edit appears
  // to have silently reverted even though it persisted correctly.
  const initialLoanAmount = proposal.requested_amount || proposal.eligible_amount || null;
  const maxEligibleAmount = proposal.eligible_amount || null;
  const initialTenureMonths = proposal.tenure_months || lender_eligibility?.max_tenure_months || null;
  const initialTenorYears = initialTenureMonths
    ? (initialTenureMonths % 12 === 0 ? String(initialTenureMonths / 12) : (initialTenureMonths / 12).toFixed(1))
    : null;
  // Was `proposal.proposal_status === 'submitted'` — a frontend-only lock the
  // backend never actually enforced (updateProposalDraft has no status
  // check, and submitProposal's own re-submission guard is commented out
  // server-side already). This whole journey stays editable at every stage,
  // including after a proposal has been submitted to the lender.
  const isSubmitted = false;
  const allDocs = Object.values(documents_by_category || {}).flat();
  const pendingKyc = countKycPending(applicants, allDocs, isSalaried);

  return (
    <div className="proposal-page">
      <style>{`
        /* Responsive grids — collapse fixed columns on smaller screens */
        .proposal-page .pp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .proposal-page .pp-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .proposal-page .pp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .proposal-page .pp-grid-4-sm { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .proposal-page .pp-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .proposal-page .pp-ref-row { display: grid; grid-template-columns: 1fr 180px 220px; gap: 12px; margin-bottom: 10px; }
        .proposal-page .pp-span-2 { grid-column: span 2; }
        @media (max-width: 900px) {
          .proposal-page .pp-grid-4, .proposal-page .pp-grid-4-sm { grid-template-columns: repeat(2, 1fr); }
          .proposal-page .pp-grid-5 { grid-template-columns: repeat(3, 1fr); }
          .proposal-page .pp-ref-row { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .proposal-page .pp-grid-2, .proposal-page .pp-grid-3, .proposal-page .pp-ref-row { grid-template-columns: 1fr; }
          .proposal-page .pp-grid-5 { grid-template-columns: repeat(2, 1fr); }
          .proposal-page .pp-span-2 { grid-column: auto; }
          /* Sticky footer at the bottom of the viewport needs its own
             mobile clearance regardless of the wizard's own container
             padding, since it's fixed to the viewport, not this scroll
             container. */
          .proposal-page { padding-bottom: 220px !important; }
        }
      `}</style>
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 22, flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Prepare Proposal</h1>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Step 7 of 7 — Loan details, documents, addresses &amp; references
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{prefill?.entity_name || 'Entity'}</strong>
            {' '}—{' '}
            <span style={{ color: 'var(--text-tertiary)' }}>CASE-{caseId}</span>
            {' · '}
            Sending to:{' '}
            <strong style={{ color: 'var(--primary)' }}>{lenderName}</strong>
          </div>
        </div>
        <ProposalStatusBadge status={proposal.lender_submission_status || proposal.proposal_status} />
      </div>

      {/* ── 1. Loan Details (EMI Calculator) ────────────────────────── */}
      <Section icon={IndianRupee} title="Loan Details"
        subtitle="Enter the Proposed loan amount and tenor for this application">
        <EMICalculator
          initialAmount={initialLoanAmount}
          maxEligibleAmount={maxEligibleAmount}
          roi={proposal.roi_min}
          monthlyIncome={prefill?.monthly_income}
          initialTenorYears={initialTenorYears}
          maxTenure={maxTenureYears}
          canOverrideRoi={canOverrideRoi}
          onChange={v => setLoanTerms(lt => ({ ...lt, ...v }))}
        />
      </Section>

      {/* ── 2. Co-Applicant Profiles ─────────────────────────────────── */}
      <Section icon={Users} title="Co-Applicant Profiles"
        subtitle="Relationship with the company / promoter — included in proposal"
        rightSlot={co_applicants.length > 0 ? (
          <span style={{
            fontSize: 12, color: 'var(--info)', fontWeight: 700, background: 'var(--info-bg)',
            padding: '3px 10px', borderRadius: 0, border: '1px solid var(--info)'
          }}>
            {co_applicants.length} Co-Applicant{co_applicants.length > 1 ? 's' : ''}
          </span>
        ) : null}>
        {applicants.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            No applicant profiles found for this case.
          </div>
        ) : (
          <>
            {applicants.filter(a => a.type === 'PRIMARY').map((a, i) => (
              <ApplicantCard key={a.id} applicant={a} isPrimary={true} index={i} />
            ))}
            {co_applicants.map((a, i) => (
              <ApplicantCard key={a.id} applicant={a} isPrimary={false} index={i + 1} />
            ))}
          </>
        )}
      </Section>

      {/* ── 3. Financial Summary ─────────────────────────────────────── */}
      <Section icon={BarChart3} title="Financial Summary"
        subtitle={isSalaried ? 'Auto-compiled from ITR and Bank Statement data' : 'Auto-compiled from GST, ITR and Bank Statement data'}>
        <FinancialSummary summary={financial_summary} prefill={prefill} isSalaried={isSalaried} />
      </Section>

      {/* ── 4. Addresses ─────────────────────────────────────────────── */}
      <Section icon={MapPin} title="Addresses"
        subtitle="Select from reported bureau/GST addresses, or enter manually">
        <AddressSection
          addresses={addresses}
          onChange={setAddresses}
          readOnly={isSubmitted}
          isSalaried={isSalaried}
          candidates={prefill?.address_candidates || []}
        />
      </Section>

      {/* ── 5. KYC Documents ─────────────────────────────────────────── */}
      <Section icon={FolderOpen} title="KYC Documents"
        rightSlot={pendingKyc > 0 ? (
          <span style={{
            fontSize: 11, color: 'var(--error)', fontWeight: 700,
            background: 'var(--error-bg)', padding: '3px 10px', borderRadius: 0, border: '1px solid var(--error)'
          }}>
            {pendingKyc} Pending
          </span>
        ) : (
          <span style={{
            fontSize: 11, color: 'var(--success)', fontWeight: 700,
            background: 'var(--success-bg)', padding: '3px 10px', borderRadius: 0, border: '1px solid var(--success)'
          }}>
            All uploaded
          </span>
        )}>
        <KYCDocumentsSection
          applicationApplicants={applicants}
          docs={documents_by_category || {}}
          onToggle={isSubmitted ? null : handleToggleDoc}
          isSubmitted={isSubmitted}
          caseId={caseId}
          onUploaded={refreshDocuments}
          isSalaried={isSalaried}
        />
      </Section>

      {/* ── 6. Remarks ───────────────────────────────────────────────── */}
      <Section icon={MessageSquare} title="Remarks &amp; Loan Purpose">
        <div className="pp-grid-2">
          <div>
            <label style={labelStyle}>LOAN PURPOSE</label>
            <textarea rows={3} value={form.loan_purpose}
              onChange={e => setForm(f => ({ ...f, loan_purpose: e.target.value }))}
              disabled={isSubmitted} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="e.g. Purchase of residential property at Survey No..." />
          </div>
          <div>
            <label style={labelStyle}>PREFERRED BANKING PROGRAM</label>
            <input value={form.preferred_banking_program}
              onChange={e => setForm(f => ({ ...f, preferred_banking_program: e.target.value }))}
              disabled={isSubmitted} style={inputStyle}
              placeholder="e.g. Salaried, SENP, SEP, NRI..." />
          </div>
          <div className="pp-span-2">
            <label style={labelStyle}>ADDITIONAL REMARKS / NOTES FOR LENDER</label>
            <textarea rows={4} value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              disabled={isSubmitted} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Any special instructions, references, case-specific context..." />
          </div>
        </div>
      </Section>

      {/* ── 7. References ────────────────────────────────────────────── */}
      <Section icon={Contact} title="References"
        subtitle="Personal or professional references for the applicant"
        rightSlot={
          <span style={{
            fontSize: 11, color: 'var(--warning)', fontWeight: 700,
            background: 'var(--warning-bg)', padding: '3px 10px', borderRadius: 0,
            border: '1px solid var(--warning)'
          }}>2 required</span>
        }>
        {references.map((ref, idx) => (
          <div key={idx} style={{ marginBottom: idx === 0 ? 24 : 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10
            }}>
              Reference {idx + 1}
            </div>
            <div className="pp-ref-row">
              <div>
                <label style={labelStyle}>FULL NAME</label>
                <input
                  value={ref.name}
                  onChange={e => setReferences(rs => rs.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                  disabled={isSubmitted}
                  placeholder={idx === 0 ? 'e.g. Suhas Kulkarni' : 'e.g. Deepika Nair'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>MOBILE</label>
                <input
                  value={ref.mobile}
                  onChange={e => setReferences(rs => rs.map((r, i) => i === idx ? { ...r, mobile: e.target.value } : r))}
                  disabled={isSubmitted}
                  placeholder="e.g. 9823456781"
                  maxLength={10}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>RELATIONSHIP</label>
                <select
                  value={ref.relationship}
                  onChange={e => setReferences(rs => rs.map((r, i) => i === idx ? { ...r, relationship: e.target.value } : r))}
                  disabled={isSubmitted}
                  style={{ ...inputStyle, cursor: isSubmitted ? 'default' : 'pointer' }}
                >
                  <option value="">Select...</option>
                  <option>Business Associate</option>
                  <option>Colleague</option>
                  <option>Friend</option>
                  <option>Family Member</option>
                  <option>CA / Accountant</option>
                  <option>Lawyer</option>
                  <option>Banker</option>
                  <option>Customer</option>
                  <option>Vendor / Supplier</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>ADDRESS</label>
              <input
                value={ref.address}
                onChange={e => setReferences(rs => rs.map((r, i) => i === idx ? { ...r, address: e.target.value } : r))}
                disabled={isSubmitted}
                placeholder={idx === 0 ? 'e.g. 12, Kothrud, Pune – 411 038' : 'e.g. Flat 5B, Viman Nagar, Pune – 411 014'}
                style={inputStyle}
              />
            </div>
          </div>
        ))}
      </Section>

      {/* ── Sticky Footer ─────────────────────────────────────────────── */}
      {!isSubmitted ? (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)'
        }}>
          {/* Lender branding bar — on mobile this collapses to a single ~40px
              row: lender name + Cancel share a line, and Save/Other-lender
              shrink to icon-only buttons so the primary Send CTA can flex to
              fill the remaining width. Desktop keeps the original spelled-out
              layout since height isn't at a premium there. */}
          {isMobile ? (
            <div style={{
              background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
              padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Send to <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{lenderName}</strong>
                </div>
                <button onClick={onBack} aria-label="Cancel"
                  style={{
                    flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    fontSize: 12, fontWeight: 600, padding: '2px 4px', cursor: 'pointer'
                  }}>Cancel</button>
              </div>
              {!isMsme && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <button onClick={() => handleSave()} disabled={saving} aria-label="Save draft"
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, padding: '0 12px', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Save size={14} />
                  </button>
                  <button onClick={() => setShowOtherLenderModal(true)} aria-label="Send to another lender"
                    style={{
                      flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', color: 'var(--primary)',
                      border: '1px solid var(--primary)', borderRadius: 0, cursor: 'pointer'
                    }}>
                    <Send size={14} style={{ transform: 'rotate(-45deg)' }} />
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="btn btn-primary"
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 8px', borderRadius: 0, fontWeight: 800, fontSize: 12
                    }}>
                    <Send size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {submitting ? 'Sending…' : `Send to ${lenderName}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '10px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Ready to send to</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {lenderName}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={onBack}
                  style={{ borderRadius: 0, fontSize: 12 }}>Cancel</button>
                {!isMsme && (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleSave()} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 0 }}>
                      <Save size={13} /> {saving ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button onClick={() => setShowOtherLenderModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                        background: 'transparent', color: 'var(--primary)',
                        border: '1px solid var(--primary)', borderRadius: 0,
                        fontWeight: 700, fontSize: 13, cursor: 'pointer'
                      }}>
                      ↗ Send to Another Lender
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                      className="btn btn-primary"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px',
                        borderRadius: 0, fontWeight: 800, fontSize: 14
                      }}>
                      <Send size={15} />
                      {submitting ? 'Submitting…' : `Send Lead to ${lenderName} →`}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '14px 22px', background: 'var(--success-bg)', borderRadius: 0,
          border: '1px solid var(--success)', textAlign: 'center', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-primary)'
        }}>
          <CheckCircle2 size={16} color="var(--success)" /> Proposal submitted on {proposal.submitted_at
            ? new Date(proposal.submitted_at).toLocaleString('en-IN') : '—'}
        </div>
      )}
      <SendToOtherLenderModal
        isOpen={showOtherLenderModal}
        onClose={() => setShowOtherLenderModal(false)}
        caseId={caseId}
        proposalId={proposalId}
        beforeSend={() => handleSave(true)}
        onSuccess={r => { setShowOtherLenderModal(false); setSendConfirmResult(r); }}
      />
      <SendConfirmationModal
        isOpen={!!sendConfirmResult}
        onClose={() => setSendConfirmResult(null)}
        result={sendConfirmResult}
      />
      <SendConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={performSubmit}
        sending={submitting}
        proposalNumber={data?.proposal?.proposal_number}
        lenderName={lenderName}
      />
    </div>
  );
}

// ─── SendToOtherLenderModal (inline in ProposalPage) ──────────────────────────
function SendToOtherLenderModal({ isOpen, onClose, caseId, proposalId, beforeSend, onSuccess }) {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelectedLender(null); setSelectedContact(null);
    getTenantLenders()
      .then(d => setLenders(d.filter(l => l.is_active && l.contacts?.length > 0)))
      .catch(() => toast.error('Failed to load lenders'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedContact) { toast.error('Select a contact first'); return; }
    const contactName = selectedContact.contact_name;
    setSending(true);
    try {
      await beforeSend?.();
      const result = await caseService.sendProposal(caseId, proposalId, selectedContact.id);
      toast.success(`Proposal sent to ${contactName}!`);
      onSuccess(result);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const contacts = selectedLender?.contacts || [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', width: '94%', maxWidth: 500, borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{sending ? 'Sending Proposal…' : 'Send to Another Lender'}</h3>
            {!sending && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>Choose a contact from your lender directory</p>
            )}
          </div>
          {!sending && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}><X size={18} /></button>
          )}
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {sending ? (
            <SendingStatus />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 30 }}><LoadingSpinner size={30} /></div>
          ) : lenders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>No lender contacts configured yet.</p>
              <a href='/settings/lender-contacts' style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>+ Configure Lender Contacts →</a>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Select Lender</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lenders.map(l => (
                    <button key={l.id} onClick={() => { setSelectedLender(l); setSelectedContact(null); }}
                      style={{
                        padding: '11px 14px', borderRadius: 0, textAlign: 'left', cursor: 'pointer',
                        border: `2px solid ${selectedLender?.id === l.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedLender?.id === l.id ? 'var(--primary-subtle)' : 'var(--bg-elevated)',
                        color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                      <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Landmark size={14} /> {l.lender_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.contacts.length} contact(s)</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedLender && contacts.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Select Contact</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contacts.map(c => (
                      <button key={c.id} onClick={() => setSelectedContact(c)}
                        style={{
                          padding: '12px 14px', borderRadius: 0, textAlign: 'left', cursor: 'pointer',
                          border: `2px solid ${selectedContact?.id === c.id ? 'var(--success)' : 'var(--border)'}`,
                          background: selectedContact?.id === c.id ? 'var(--success-bg)' : 'var(--bg-elevated)',
                          color: 'var(--text-primary)'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{c.contact_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 0 }}>{c.product_type}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {c.contact_email}</span>
                          {c.contact_mobile && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {c.contact_mobile}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!sending && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-elevated)' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 0, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cancel</button>
            <button onClick={handleSend} disabled={!selectedContact}
              style={{
                padding: '10px 22px', borderRadius: 0, fontWeight: 700, fontSize: 13,
                background: selectedContact ? 'var(--success)' : 'var(--border)',
                color: '#fff', border: 'none',
                cursor: selectedContact ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Send size={14} /> Send Proposal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SendingStatus ──────────────────────────────────────────────────────────
// Sending a proposal genuinely takes a few seconds (resolve lender contact,
// pull documents from storage, dispatch email) — without feedback, the DSA
// just sees a disabled button, which reads as a frozen screen. This renders
// *inside* whichever confirm dialog triggered the send (swapped in for that
// dialog's own body/footer) rather than popping a separate overlay on top of
// it, and cycles through a fixed sequence of status lines on a timer — not
// tied to real backend progress (the send is a single request/response), so
// this is deliberately a "perceived progress" indicator. Loops rather than
// stopping at the last line, so a slow send never looks stalled.
const SEND_STAGES = [
  'Preparing proposal…',
  'Attaching documents…',
  'Resolving lender contact…',
  'Sending email…',
  'Almost done…',
  'Still working…',
  'Hang tight, finishing up…',
];

function SendingStatus() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex(i => (i + 1) % SEND_STAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={stageIndex}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}
        >
          {SEND_STAGES[stageIndex]}
        </motion.div>
      </AnimatePresence>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        This might take a few seconds, please wait…
      </div>
    </div>
  );
}

// ─── SendConfirmDialog ──────────────────────────────────────────────────────
// Replaces the generic ConfirmModal for this one flow — that component has
// no way to swap in custom body content, and the send needs to show
// <SendingStatus /> in place of the confirmation question once confirmed,
// within the same dialog, rather than closing it and opening something else.
function SendConfirmDialog({ isOpen, onClose, onConfirm, sending, proposalNumber, lenderName }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', width: '94%', maxWidth: 440, borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{sending ? 'Sending Proposal…' : 'Send this proposal?'}</h3>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {sending ? (
            <SendingStatus />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Email proposal {proposalNumber || ''} with its attached documents to {lenderName}'s configured contact?
            </p>
          )}
        </div>
        {!sending && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-elevated)' }}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={onConfirm} className="btn btn-primary btn-sm">Send</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SendConfirmationModal ─────────────────────────────────────────────────────
function SendConfirmationModal({ isOpen, onClose, result }) {
  if (!isOpen || !result) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', width: '94%', maxWidth: 500, borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background: 'var(--success-bg)', padding: '28px 24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <CheckCircle2 size={40} color="var(--success)" style={{ marginBottom: 10 }} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>Lead Sent Successfully!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>Proposal dispatched to {result.contact_name}</p>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid var(--info)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--info-bg)', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> EMAIL SENT
            </div>
            <div style={{ padding: '12px 16px', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>To:</span>
                <span style={{ fontWeight: 600 }}>{result.to}</span>
              </div>
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Subject:</strong>
                {result.subject}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 0, fontWeight: 700, fontSize: 14, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
