import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  ChevronLeft, Send, Save, CheckCircle2, Clock, XCircle,
  AlertCircle, TrendingUp, ChevronDown, ChevronUp, CheckSquare, Square, UploadCloud,
  X, Mail, Phone
} from 'lucide-react';
import { getTenantLenders, sendCaseToOtherLender } from '../api/tenantLenderService';
import { uploadDocument } from '../api/documentHelper';

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

const STATUS_CFG = {
  draft: { label: 'Draft', color: '#718096', bg: '#EDF2F7', Icon: Clock },
  submitted: { label: 'Submitted', color: '#2B6CB0', bg: '#EBF8FF', Icon: Send },
  accepted: { label: 'Accepted', color: '#276749', bg: '#F0FFF4', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#C53030', bg: '#FFF5F5', Icon: XCircle },
  query_raised: { label: 'Query', color: '#C05621', bg: '#FFFBEB', Icon: AlertCircle },
};

function Badge({ status, size = 12 }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.color, padding: '4px 12px', borderRadius: 20,
      fontSize: size, fontWeight: 700, border: `1px solid ${c.color}30`
    }}>
      <c.Icon size={size} /> {c.label}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ emoji, title, subtitle, children, rightSlot }) {
  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: 12, marginBottom: 20, overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 22px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{title}</span>
          </div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, marginLeft: 26 }}>{subtitle}</div>}
        </div>
        {rightSlot}
      </div>
      <div style={{ padding: '18px 22px' }}>{children}</div>
    </div>
  );
}

// ─── EMI Calculator ───────────────────────────────────────────────────────────
function EMICalculator({ loanAmount, roi, monthlyIncome, onChange }) {
  const [amount, setAmount] = useState(loanAmount ? (loanAmount / 100000).toFixed(2) : '');
  const [tenor, setTenor] = useState('12');
  const [rate, setRate] = useState(roi || '');
  const [showAmort, setShowAmort] = useState(false);

  useEffect(() => {
    if (loanAmount) setAmount((loanAmount / 100000).toFixed(2));
  }, [loanAmount]);

  const { emi, totalInterest, totalRepayment, emiFoirPct, schedule } = useMemo(() => {
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

  const TENOR_OPTIONS = [1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 30];

  return (
    <div>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>LOAN AMOUNT (₹ LAKHS) *</label>
          <input value={amount} onChange={e => { setAmount(e.target.value); onChange?.({ amount_lakhs: e.target.value, tenor_years: tenor }); }}
            type="number" placeholder="e.g. 39"
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>TENOR (YEARS) *</label>
          <select value={tenor} onChange={e => setTenor(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {TENOR_OPTIONS.map(t => <option key={t} value={t}>{t} Years</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>INDICATIVE RATE (% P.A.)</label>
          <input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.01" placeholder="e.g. 10.50"
            style={inputStyle} />
        </div>
      </div>

      {/* EMI Result Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{
          gridColumn: 'span 1', background: 'linear-gradient(135deg,#FAF0FF,#EBF4FF)',
          border: '2px solid #C6A7F7', borderRadius: 10, padding: '14px 18px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, color: '#6B46C1', fontWeight: 700, marginBottom: 4 }}>Monthly EMI</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#553C9A' }}>
            {emi > 0 ? `₹${Math.round(emi).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>Total Interest</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtINR(totalInterest)}</div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>Total Repayment</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtINR(totalRepayment)}</div>
        </div>
        <div style={{
          background: emiFoirPct > 50 ? '#FFF5F5' : '#F0FFF4', borderRadius: 10,
          padding: '14px 18px', textAlign: 'center', border: `1px solid ${emiFoirPct > 50 ? '#FEB2B2' : '#9AE6B4'}`
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, marginBottom: 4,
            color: emiFoirPct > 50 ? '#C53030' : '#276749'
          }}>EMI to Income Ratio</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: emiFoirPct > 50 ? '#C53030' : '#276749' }}>
            {emiFoirPct ? `~${emiFoirPct}%` : '—'}
          </div>
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
                      <td style={{ ...tdStyle, color: '#C05621' }}>{fmtINR(row.interest)}</td>
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
      border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px',
      marginBottom: 14, background: isPrimary ? 'var(--bg-elevated)' : 'var(--bg-primary)'
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
              fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'none',
              border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 600
            }}>Primary</span>
          )}
          {bureauStatus && (
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12,
              background: '#F0FFF4', color: '#276749', fontWeight: 600, border: '1px solid #9AE6B4'
            }}>
              {bureauStatus}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <InfoCell label="PAN" value={applicant.pan_number || '—'} />
        <InfoCell label="Mobile" value={applicant.mobile || '—'} />
        <InfoCell label="CIBIL Score" value={applicant.cibil_score || '—'} />
        <InfoCell label="KYC Status" value={applicant.otp_verified ? '✓ Verified' : 'Pending'} valueColor={applicant.otp_verified ? '#276749' : '#C05621'} />
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
function FinancialSummary({ summary, prefill }) {
  const { gst, itr_years, bank_accounts } = summary || {};

  return (
    <div>
      {/* GST */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: '#276749', background: '#F0FFF4',
            padding: '3px 10px', borderRadius: 4, letterSpacing: '1px'
          }}>GST</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>GST TURNOVER SUMMARY</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
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
            <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, lineHeight: 1.3 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: red ? '#C53030' : '#276749' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ITR */}
      {itr_years?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: '#2B6CB0', background: '#EBF8FF',
              padding: '3px 10px', borderRadius: 4, letterSpacing: '1px'
            }}>ITR</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>INCOME TAX RETURN SUMMARY</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#276749' }}>{fmtINR(row.net_profit)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: '#276749', fontWeight: 700, fontSize: 11 }}>✓ {row.filing_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bank */}
      {bank_accounts?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: '#553C9A', background: '#FAF5FF',
              padding: '3px 10px', borderRadius: 4, letterSpacing: '1px'
            }}>BANK</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>BANKING SUMMARY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {bank_accounts.map((acc, i) => (
              <div key={i} style={{
                border: `1px solid ${i === 0 ? '#BEE3F8' : 'var(--border)'}`,
                borderRadius: 8, padding: '14px 16px',
                background: i === 0 ? '#F0F8FF' : 'var(--bg-elevated)'
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: i === 0 ? '#2B6CB0' : 'var(--text-secondary)',
                  marginBottom: 10
                }}>{i === 0 ? '🏦 Primary Current Account' : `🏦 ${acc.label}`}</div>
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
                    <span style={{ fontWeight: 600, color: label.includes('Bounce') && val !== 'Nil' ? '#C53030' : 'var(--text-primary)' }}>
                      {val === 0 ? 'Nil' : val}
                    </span>
                  </div>
                ) : null)}
              </div>
            ))}
          </div>
        </div>
      )}

      {!gst?.turnover_latest && !itr_years?.length && !bank_accounts?.length && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          ℹ️ Financial data will appear here once GST/ITR/Bank analytics are completed for this case.
        </div>
      )}
    </div>
  );
}

// ─── Address Section ──────────────────────────────────────────────────────────
function AddressSection({ addresses, onChange, readOnly }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            CURRENT RESIDENTIAL ADDRESS
            <span style={{
              fontSize: 9, color: '#276749', fontWeight: 600,
              background: '#F0FFF4', padding: '1px 6px', borderRadius: 4
            }}>AUTO-FETCHED · EDITABLE</span>
          </label>
          <textarea rows={3} value={addresses.residential || ''} readOnly={readOnly}
            onChange={e => onChange({ ...addresses, residential: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Current residential address" />
          <div style={{ fontSize: 10, color: '#276749', marginTop: 3 }}>✓ Auto-fetched from Aadhaar OTP</div>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            OFFICE / BUSINESS ADDRESS
            <span style={{
              fontSize: 9, color: '#276749', fontWeight: 600,
              background: '#F0FFF4', padding: '1px 6px', borderRadius: 4
            }}>AUTO-FETCHED · EDITABLE</span>
          </label>
          <textarea rows={3} value={addresses.office || ''} readOnly={readOnly}
            onChange={e => onChange({ ...addresses, office: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Office / business address" />
          <div style={{ fontSize: 10, color: '#276749', marginTop: 3 }}>✓ Auto-fetched from bureau / GST registration</div>
        </div>
      </div>
      <div>
        <label style={labelStyle}>PROPERTY ADDRESS (COLLATERAL) *</label>
        <textarea rows={3} value={addresses.property || ''} readOnly={readOnly}
          onChange={e => onChange({ ...addresses, property: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder="Survey no., plot no., full address of the collateral property" />
      </div>
    </div>
  );
}

// ─── KYC Documents Grid ───────────────────────────────────────────────────────
const KYC_REQUIREMENTS = [
  { type: 'PAN_CARD', label: 'PAN Card', required: true },
  { type: 'AADHAAR', label: 'Aadhaar', required: true },
];
const OTHER_REQUIRED_DOCS = [
  { type: 'GST_PDF', label: 'GST Registration Certificate', required: true },
  { type: 'ITR', label: 'ITR / Income Documents', required: true },
  { type: 'BANK_STATEMENT', label: 'Bank Statements', required: true },
  { type: 'PROPERTY_DOCUMENT', label: 'Property / Title Documents', required: false },
  { type: 'SALE_DEED', label: 'Partnership Deed / MOA', required: false },
];

function KYCDocumentsSection({ applicationApplicants, docs, onToggle, isSubmitted, caseId, onUploaded }) {
  const getPrimary = () => applicationApplicants.find(a => a.type === 'PRIMARY');
  const getCoApplicants = () => applicationApplicants.filter(a => a.type !== 'PRIMARY');

  const allDocs = Object.values(docs).flat();
  const findDoc = (type) => allDocs.filter(d => d.document_type === type);
  const pendingCount = [...KYC_REQUIREMENTS, ...OTHER_REQUIRED_DOCS]
    .filter(r => r.required && findDoc(r.type).length === 0).length;

  const primary = getPrimary();
  const coApplicants = getCoApplicants();

  return (
    <div>
      {/* KYC per applicant */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
        {/* Primary */}
        {primary && KYC_REQUIREMENTS.map(req => {
          const docList = findDoc(req.type);
          const uploaded = docList.length > 0;
          return (
            <DocCard key={`primary_${req.type}`}
              label={`${req.label} — Primary`}
              uploaded={uploaded}
              doc={docList[0]}
              onToggle={onToggle && docList[0] ? () => onToggle(docList[0]) : null}
              isSubmitted={isSubmitted}
              caseId={caseId}
              docType={req.type}
              onUploaded={onUploaded}
            />
          );
        })}
        {/* Co-applicants */}
        {coApplicants.map((ca, ci) =>
          KYC_REQUIREMENTS.map(req => {
            const docList = findDoc(req.type).slice(ci + 1, ci + 2);
            const uploaded = docList.length > 0;
            return (
              <DocCard key={`ca${ci}_${req.type}`}
                label={`${req.label} — Co-Borrower ${ci + 1}`}
                uploaded={uploaded}
                doc={docList[0]}
                onToggle={onToggle && docList[0] ? () => onToggle(docList[0]) : null}
                isSubmitted={isSubmitted}
                caseId={caseId}
                docType={req.type}
                onUploaded={onUploaded}
              />
            );
          })
        )}
      </div>

      {/* Other required docs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {OTHER_REQUIRED_DOCS.map(req => {
          const docList = findDoc(req.type);
          const uploaded = docList.length > 0;
          return (
            <DocCard key={req.type}
              label={req.label}
              uploaded={uploaded}
              doc={docList[0]}
              onToggle={onToggle && docList[0] ? () => onToggle(docList[0]) : null}
              required={req.required}
              isSubmitted={isSubmitted}
              caseId={caseId}
              docType={req.type}
              onUploaded={onUploaded}
            />
          );
        })}
      </div>

      {pendingCount > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 14px', background: '#FFFBEB',
          borderRadius: 6, fontSize: 12, color: '#92400E', border: '1px solid #FDE68A'
        }}>
          ⚠️ {pendingCount} required document(s) not yet uploaded. Please upload before submitting.
        </div>
      )}
    </div>
  );
}

function DocCard({ label, uploaded, doc, onToggle, required = true, isSubmitted, caseId, docType, onUploaded }) {
  const isAttached = doc?.is_attached;
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file, caseId, docType || 'OTHER');
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
      border: `1px solid ${!uploaded && required ? '#FEB2B2' : uploaded ? '#9AE6B4' : 'var(--border)'}`,
      borderRadius: 8, overflow: 'hidden'
    }}>
      <div style={{ padding: '10px 12px', background: uploaded ? '#FAFFFD' : !required ? 'var(--bg-elevated)' : '#FFF5F5' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: uploaded ? '#276749' : required ? '#C53030' : '#718096' }}>
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
                border: isAttached ? '1px solid #9AE6B4' : '1px solid var(--border)',
                borderRadius: 5, background: isAttached ? '#F0FFF4' : 'var(--bg-primary)',
                color: isAttached ? '#276749' : 'var(--text-secondary)'
              }}>
              {isAttached ? '✓ Included' : 'Include'}
            </button>
            {!isSubmitted && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border)', borderRadius: 5,
                  background: 'var(--bg-primary)', color: 'var(--text-secondary)'
                }}
                title="Replace file">
                ↑
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
              border: 'none', borderRadius: 5,
              background: uploading ? '#718096' : required ? 'var(--primary)' : '#718096',
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
  width: '100%', padding: '9px 12px', borderRadius: 6,
  border: '1px solid var(--border)', fontSize: 14,
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  fontFamily: 'inherit', boxSizing: 'border-box'
};
const tdStyle = { padding: '6px 10px', textAlign: 'right', fontSize: 11 };

// ─── Main ProposalPage ─────────────────────────────────────────────────────────
export default function ProposalPage() {
  const { id: caseId, pid: proposalId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [showOtherLenderModal, setShowOtherLenderModal] = useState(false);
  const [sendConfirmResult, setSendConfirmResult] = useState(null);
  const [form, setForm] = useState({
    loan_purpose: '', remarks: '', preferred_banking_program: ''
  });
  const [addresses, setAddresses] = useState({ residential: '', office: '', property: '' });
  const emptyRef = () => ({ name: '', mobile: '', relationship: '', address: '' });
  const [references, setReferences] = useState([emptyRef(), emptyRef()]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await caseService.getProposal(caseId, proposalId);
      setData(res);
      const p = res.proposal;
      setForm({
        loan_purpose: p.loan_purpose || '',
        remarks: p.remarks || '',
        additional_notes: p.additional_notes || '',
        preferred_banking_program: p.preferred_banking_program || '',
      });
      // Parse addresses + references from additional_notes JSON
      try {
        const stored = p.additional_notes ? JSON.parse(p.additional_notes) : null;
        if (stored?.__addresses) setAddresses(stored.__addresses);
        if (stored?.__references) setReferences(stored.__references);
        setForm(f => ({ ...f }));
      } catch { }
    } catch (e) {
      toast.error('Failed to load proposal');
    } finally {
      setLoading(false);
    }
  }, [caseId, proposalId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (silent = false) => {
    try {
      setSaving(true);
      // Store addresses + references inside additional_notes as a JSON blob
      const additionalNotesPayload = JSON.stringify({
        __addresses: addresses,
        __references: references,
      });
      await caseService.updateProposal(caseId, proposalId, {
        loan_purpose: form.loan_purpose,
        remarks: form.remarks,
        additional_notes: additionalNotesPayload,
        preferred_banking_program: form.preferred_banking_program,
      });
      if (!silent) toast.success('Draft saved');
    } catch (e) {
      if (!silent) toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm(`Submit this proposal (${data?.proposal?.proposal_number}) to ${data?.lender?.name}?\n\nThis will record the lead as sent to lender.`)) return;
    try {
      setSubmitting(true);
      await handleSave(true);
      await caseService.submitProposal(caseId, proposalId);
      toast.success('✅ Proposal submitted! Lead sent to lender.');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to submit');
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
      await load();
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
      <button className="btn btn-ghost" onClick={() => navigate(`/cases/${caseId}/esr`)}>← Back</button>
    </div>
  );

  const { proposal, lender, scheme_name, prefill, applicants = [], co_applicants = [],
    financial_summary, documents_by_category, lender_eligibility } = data;
  const isSubmitted = proposal.proposal_status === 'submitted';
  const allDocs = Object.values(documents_by_category || {}).flat();
  const pendingKyc = allDocs.filter(d => !d.is_attached && ['PAN_CARD', 'AADHAAR'].includes(d.document_type)).length;

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', paddingBottom: 100 }}>
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
          Prepare Proposal · Loan details, documents, addresses &amp; references
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 22, flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button className="btn btn-ghost" onClick={() => navigate(`/cases/${caseId}/esr`)}
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <ChevronLeft size={14} /> Back
            </button>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Prepare Proposal</h1>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{prefill?.entity_name || 'Entity'}</strong>
            {' '}—{' '}
            <span style={{ color: 'var(--text-tertiary)' }}>CASE-{caseId}</span>
            {' · '}
            Sending to:{' '}
            <strong style={{ color: 'var(--primary)' }}>{lender?.name || proposal.lender_id}</strong>
            {scheme_name && <span style={{ color: 'var(--text-tertiary)' }}> · {scheme_name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge status={proposal.lender_submission_status || proposal.proposal_status} />
          {!isSubmitted && (
            <>
              <button className="btn btn-secondary" onClick={() => handleSave()} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg,#2B6CB0,#553C9A)', padding: '9px 20px'
                }}>
                <Send size={14} /> {submitting ? 'Submitting…' : 'Submit to Lender'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 1. Loan Details (EMI Calculator) ────────────────────────── */}
      <Section emoji="💰" title="Loan Details"
        subtitle="Enter the loan amount and tenor for this application">
        <EMICalculator
          loanAmount={proposal.eligible_amount || proposal.requested_amount}
          roi={proposal.roi_min}
          monthlyIncome={prefill?.monthly_income}
          onChange={() => { }}
        />
      </Section>

      {/* ── 2. Co-Applicant Profiles ─────────────────────────────────── */}
      <Section emoji="👤" title="Co-Applicant Profiles"
        subtitle="Relationship with the company / promoter — included in proposal"
        rightSlot={co_applicants.length > 0 ? (
          <span style={{
            fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: '#EBF8FF',
            padding: '3px 10px', borderRadius: 12, border: '1px solid #BEE3F8'
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
      <Section emoji="📊" title="Financial Summary"
        subtitle="Auto-compiled from GST, ITR and Bank Statement data">
        <FinancialSummary summary={financial_summary} prefill={prefill} />
      </Section>

      {/* ── 4. Addresses ─────────────────────────────────────────────── */}
      <Section emoji="📍" title="Addresses"
        subtitle="auto-fetched from Aadhaar / bureau, editable">
        <AddressSection
          addresses={addresses}
          onChange={setAddresses}
          readOnly={isSubmitted}
        />
      </Section>

      {/* ── 5. KYC Documents ─────────────────────────────────────────── */}
      <Section emoji="🗂️" title="KYC Documents"
        rightSlot={pendingKyc > 0 ? (
          <span style={{
            fontSize: 11, color: '#C53030', fontWeight: 700,
            background: '#FFF5F5', padding: '3px 10px', borderRadius: 12, border: '1px solid #FEB2B2'
          }}>
            {pendingKyc} Pending
          </span>
        ) : (
          <span style={{
            fontSize: 11, color: '#276749', fontWeight: 700,
            background: '#F0FFF4', padding: '3px 10px', borderRadius: 12, border: '1px solid #9AE6B4'
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
          onUploaded={load}
        />
      </Section>

      {/* ── 6. Remarks ───────────────────────────────────────────────── */}
      <Section emoji="📝" title="Remarks &amp; Loan Purpose">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>ADDITIONAL REMARKS / NOTES FOR LENDER</label>
            <textarea rows={4} value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              disabled={isSubmitted} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Any special instructions, references, case-specific context..." />
          </div>
        </div>
      </Section>

      {/* ── 7. References ────────────────────────────────────────────── */}
      <Section emoji="👥" title="References"
        subtitle="Personal or professional references for the applicant"
        rightSlot={
          <span style={{
            fontSize: 11, color: '#C05621', fontWeight: 700,
            background: '#FFFBEB', padding: '3px 10px', borderRadius: 12,
            border: '1px solid #FDE68A'
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 220px', gap: 12, marginBottom: 10 }}>
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
          {/* Lender branding bar */}
          <div style={{
            background: '#1A202C', padding: '10px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#A0AEC0', marginBottom: 2 }}>Ready to send to</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                {lender?.name || 'Lender'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => navigate(`/cases/${caseId}/esr`)}
                style={{ color: '#A0AEC0', fontSize: 12 }}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => handleSave()} disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                <Save size={13} /> {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button onClick={() => setShowOtherLenderModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                  background: 'transparent', color: '#A78BFA',
                  border: '1px solid #A78BFA', borderRadius: 8,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer'
                }}>
                ↗ Send to Another Lender
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px',
                  background: 'linear-gradient(135deg,#D69E2E,#B7791F)',
                  color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800,
                  fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 12px rgba(214,158,46,0.4)'
                }}>
                <Send size={15} />
                {submitting ? 'Submitting…' : `Send Lead to ${lender?.name || 'Lender'} →`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '14px 22px', background: '#F0FFF4', borderRadius: 10,
          border: '1px solid #9AE6B4', textAlign: 'center', fontSize: 13
        }}>
          ✅ Proposal submitted on {proposal.submitted_at
            ? new Date(proposal.submitted_at).toLocaleString('en-IN') : '—'}
        </div>
      )}
      <SendToOtherLenderModal
        isOpen={showOtherLenderModal}
        onClose={() => setShowOtherLenderModal(false)}
        caseId={caseId}
        onSuccess={r => { setShowOtherLenderModal(false); setSendConfirmResult(r); }}
      />
      <SendConfirmationModal
        isOpen={!!sendConfirmResult}
        onClose={() => setSendConfirmResult(null)}
        result={sendConfirmResult}
      />
    </div>
  );
}

// ─── SendToOtherLenderModal (inline in ProposalPage) ──────────────────────────
function SendToOtherLenderModal({ isOpen, onClose, caseId, onSuccess }) {
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
    setSending(true);
    try {
      const result = await sendCaseToOtherLender(caseId, { contact_id: selectedContact.id });
      toast.success(`Proposal sent to ${selectedContact.contact_name}!`);
      onSuccess(result);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send');
    } finally { setSending(false); }
  };

  const contacts = selectedLender?.contacts || [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-primary)', width: '94%', maxWidth: 500, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Send to Another Lender</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>Choose a contact from your lender directory</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
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
                        padding: '11px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        border: `2px solid ${selectedLender?.id === l.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedLender?.id === l.id ? '#EEF2FF' : 'var(--bg-elevated)',
                        color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>🏦 {l.lender_name}</span>
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
                          padding: '12px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                          border: `2px solid ${selectedContact?.id === c.id ? '#276749' : 'var(--border)'}`,
                          background: selectedContact?.id === c.id ? '#F0FFF4' : 'var(--bg-elevated)',
                          color: 'var(--text-primary)'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{c.contact_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: 10 }}>{c.product_type}</span>
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

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-elevated)' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cancel</button>
          <button onClick={handleSend} disabled={!selectedContact || sending}
            style={{
              padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13,
              background: selectedContact ? '#276749' : 'var(--border)',
              color: '#fff', border: 'none',
              cursor: selectedContact ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: sending ? 0.75 : 1
            }}>
            <Send size={14} /> {sending ? 'Sending…' : 'Send Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SendConfirmationModal ─────────────────────────────────────────────────────
function SendConfirmationModal({ isOpen, onClose, result }) {
  if (!isOpen || !result) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-primary)', width: '94%', maxWidth: 500, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background: 'linear-gradient(135deg,#F0FFF4,#EBF8FF)', padding: '28px 24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#276749' }}>Lead Sent Successfully!</h3>
          <p style={{ color: '#4A5568', fontSize: 13, marginTop: 6 }}>Proposal dispatched to {result.contact_name}</p>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid #BEE3F8', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#EBF8FF', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#2B6CB0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> EMAIL SENT
            </div>
            <div style={{ padding: '12px 16px', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>To:</span>
                <span style={{ fontWeight: 600 }}>{result.to}</span>
              </div>
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Subject:</strong>
                {result.subject}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
