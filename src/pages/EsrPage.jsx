import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MetricTile from '../components/ui/MetricTile';
import {
  CheckCircle, XCircle, RefreshCw, Calculator,
  Send, Clock, CheckCircle2, AlertCircle,
  BarChart3, ClipboardList, Percent, TrendingDown, TrendingUp,
  Home, ChevronUp, ChevronDown, Zap, IndianRupee,
  ListFilter,
} from 'lucide-react';

const easeOut = [0.22, 1, 0.36, 1];

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : null;

const formatDynamicCurrency = (n) => {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (num >= 10000000) return `₹${(num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatDynamicTenure = (months) => {
  if (months === null || months === undefined) return '—';
  const m = Number(months);
  if (m % 12 === 0) return `${m / 12} Years`;
  return `${(m / 12).toFixed(1)} Years`;
};

const fmtPct = (v) => v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—';

// Full step-by-step calculation trace is dev-only for now — it surfaces
// internal field names and legacy-parser warnings not meant for a DSA/
// customer-facing view yet. Gated on the build-time API target rather than
// NODE_ENV, since a Vite production build (which is what even the dev
// server runs) always bakes NODE_ENV as 'production' regardless of which
// backend it points at. `import.meta.env.DEV` covers the other case this
// misses — running `vite dev` locally against localhost, which is a real
// build-time dev flag (unlike NODE_ENV) but doesn't match the dev-server URL
// check since local dev usually points at a local backend, not
// dev.api.cred2tech.com.
const IS_DEV_BUILD = import.meta.env.DEV || String(import.meta.env.VITE_API_BASE_URL || '').includes('dev.api.cred2tech.com');

// ─── Ineligibility reason humanizer ───────────────────────────────────────────
// The eligibility engine (dynamicEligibility.service.js) emits a mix of plain
// sentences and internal SCREAMING_SNAKE_CASE codes (e.g. LIP_REQUIRES_MANUAL_REVIEW,
// PRIMARY_APPLICANT_NOT_SALARIED: employment type is NA), joined with " | ".
// This maps the known codes to plain-English explanations, and falls back to
// turning any unmapped code into readable words rather than showing raw jargon.
const REASON_ACRONYMS = new Set(['LTV', 'FOIR', 'DBR', 'KYC', 'CIBIL', 'GST', 'PAN', 'ROI', 'NWM', 'LIP', 'GRP', 'CA', 'ICICI', 'TATA', 'EMI']);

const humanizeReasonCode = (code) => code
  .split('_')
  .filter(Boolean)
  .map(w => REASON_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join(' ');

const REASON_PATTERNS = [
  [/^PRIMARY_APPLICANT_NOT_SALARIED:\s*employment type is\s*(.+)$/i,
    (m) => `This scheme needs the primary applicant to be salaried${m[1] && m[1].toUpperCase() !== 'NA' ? ` (current employment type: ${m[1]})` : ''}.`],
  [/^Composed eligible income is 0 or missing\.?$/i,
    () => 'Your eligible income could not be calculated — required income details may be missing.'],
  [/^GRP eligibility is 0.*$/i,
    () => 'Based on your gross receipts, the eligible loan amount works out to zero for this scheme.'],
  [/^GRP gross receipt not available$/i,
    () => 'Gross receipts details are not available for this business.'],
  [/^PROFESSION_REQUIRED_FOR_GRP$/i,
    () => 'Profession details are required to evaluate this scheme.'],
  [/^POLICY_VALUE_REQUIRES_CONFIRMATION:?\s*(.*)$/i,
    (m) => `This scheme needs confirmation of a policy value${m[1] ? ` (${m[1]})` : ''}.`],
  [/^LIP_REQUIRES_MANUAL_REVIEW$/i,
    () => 'This scheme requires manual review by our credit team.'],
  [/^LOW_LTV_REQUIRES_MANUAL_REVIEW$/i,
    () => 'This scheme requires manual review due to a low loan-to-value ratio.'],
  [/^NWM_CUSTOMER_SELECTION_FAILED$/i,
    () => 'Additional details are required to evaluate this scheme.'],
  [/^NWM inactive.*$/i,
    () => 'This scheme is currently unavailable with this lender.'],
  [/^TATA_LIP_CURRENT_YEAR_NET_PROFIT_REQUIRED$/i,
    () => 'Current year net profit details are required for this scheme.'],
  [/^CA_ASSESSED_ELIGIBLE_AMOUNT_REQUIRED_FOR_TATA_LIP$/i,
    () => 'A CA-assessed eligible loan amount is required for this scheme.'],
  [/^PIRAMAL_LIP_LATEST_YEAR_NET_PROFIT_REQUIRED$/i,
    () => 'Latest year net profit details are required for this scheme.'],
  [/^CA_ASSESSED_ELIGIBLE_AMOUNT_REQUIRED_FOR_PIRAMAL_LIP$/i,
    () => 'A CA-assessed eligible loan amount is required for this scheme.'],
  [/^Bureau score missing\.?$/i,
    () => 'Your bureau score is missing, so this lender could not be evaluated.'],
  [/^Lowest CIBIL score (\d+) is below bureau cutoff (\d+)$/i,
    (m) => `Your bureau score (${m[1]}) is below this lender's minimum requirement (${m[2]}).`],
  [/^No valid ROI configured.*$/i,
    () => 'This scheme is not fully set up yet, so eligibility could not be calculated.'],
  [/^No valid tenure configured.*$/i,
    () => 'This scheme is not fully set up yet, so eligibility could not be calculated.'],
  [/is a manual\/deviation method\..*$/i,
    () => 'This scheme requires manual review by our credit team.'],
  [/requires manual override\.?$/i,
    () => 'This scheme requires manual review by our credit team.'],
  [/^Manual \/ Low LTV \/ LIP method requires.*$/i,
    () => 'This scheme requires manual underwriting review.'],
  [/^Invalid lender configuration for.*$/i,
    () => "This lender's eligibility criteria could not be evaluated due to a setup issue."],
  [/^Missing required lender configuration for.*$/i,
    () => "This lender's eligibility criteria could not be evaluated due to a setup issue."],
  [/FOIR\/DBR not configured.*$/i,
    () => 'This scheme is not fully set up yet, so eligibility could not be calculated.'],
  [/FOIR config missing.*$/i,
    () => 'This scheme is not fully set up yet, so eligibility could not be calculated.'],
  [/^Maximum eligible loan (₹[\d,]+) is below lender minimum (₹[\d,]+)$/i,
    (m) => `Your maximum eligible loan (${m[1]}) is below this lender's minimum loan amount (${m[2]}).`],
];

const humanizeReason = (raw) => {
  const text = (raw || '').trim();
  if (!text) return text;

  for (const [pattern, format] of REASON_PATTERNS) {
    const m = text.match(pattern);
    if (m) return format(m);
  }

  // "SOME_CODE: extra detail" — humanize the code, keep the human-written detail
  const codeWithDetail = text.match(/^([A-Z][A-Z0-9_]{3,}):\s*(.+)$/);
  if (codeWithDetail) return `${humanizeReasonCode(codeWithDetail[1])} — ${codeWithDetail[2]}`;

  // A bare "SOME_CODE" with no known mapping and no detail
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(text)) return `${humanizeReasonCode(text)}.`;

  // Already a plain sentence — leave as-is
  return text;
};

// Splits the " | "-joined raw reason string into de-duplicated, humanized reasons.
const parseIneligibilityReasons = (raw) => {
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  for (const part of raw.split(' | ')) {
    const humanized = humanizeReason(part);
    if (humanized && !seen.has(humanized)) {
      seen.add(humanized);
      out.push(humanized);
    }
  }
  return out;
};

// ─── Proposal status badge config ─────────────────────────────────────────────
const PROPOSAL_STATUS = {
  draft:              { label: 'Draft',      color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)', icon: Clock },
  submitted:          { label: 'Submitted',  color: 'var(--info)', bg: 'var(--info-bg)', icon: Send },
  accepted:           { label: 'Accepted',   color: 'var(--success)', bg: 'var(--success-bg)', icon: CheckCircle2 },
  rejected:           { label: 'Rejected',   color: 'var(--error)', bg: 'var(--error-bg)', icon: XCircle },
  query_raised:       { label: 'Query',      color: 'var(--warning)', bg: 'var(--warning-bg)', icon: AlertCircle },
  resent:             { label: 'Resent',     color: 'var(--role-admin)', bg: 'var(--role-admin-bg)', icon: Send },
};

function ProposalBadge({ status }) {
  const cfg = PROPOSAL_STATUS[status] || PROPOSAL_STATUS.draft;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}`
    }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

// ─── Income Sources Panel (dev-only) ──────────────────────────────────────────
// Case-level (not per-lender) — shows every raw income input the ESR engine
// had available: the case_esr_financials snapshot, the data-pull status for
// each vendor source (GST/ITR/Bank/Bureau), and any manual income entries.
// This is the *input* side; FullCalculationTrace below (per lender/scheme)
// is the *output* side of the same calculation.
const PULL_STATUS_COLOR = {
  COMPLETE: 'var(--success)', COMPLETED: 'var(--success)', REPORT_READY: 'var(--success)', CALLBACK_RECEIVED: 'var(--success)',
  PENDING: 'var(--text-tertiary)', IN_PROGRESS: 'var(--info)', FAILED: 'var(--error)',
};
function PullStatusBadge({ label, status }) {
  const color = PULL_STATUS_COLOR[status] || 'var(--text-tertiary)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', border: `1px solid ${color}`, color }}>
      {label}: {status || 'PENDING'}
    </span>
  );
}
function IncomeRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return <div style={TRACE_ROW_STYLE}><span>{label}</span><span style={{ fontWeight: 700 }}>{value}</span></div>;
}

function IncomeSourcesPanel({ caseDetail }) {
  if (!caseDetail) return null;
  const esr = caseDetail.esr_financials;
  const pull = caseDetail.data_pull_status;
  const primaryApplicant = (caseDetail.applicants || []).find(a => a.type === 'PRIMARY') || caseDetail.applicants?.[0];
  const allIncomeEntries = (caseDetail.applicants || []).flatMap(a =>
    (a.income_entries || []).map(e => ({ ...e, applicantName: a.name || a.type }))
  );
  const allSalarySlips = (caseDetail.applicants || []).flatMap(a => a.salary_ocr_results || []);

  if (!esr) {
    return (
      <div style={{ ...TRACE_SECTION_STYLE, marginBottom: 20, background: 'var(--bg-elevated)' }}>
        <div style={{ ...TRACE_TITLE_STYLE, color: 'var(--warning)' }}>Income Sources (dev build only)</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No case_esr_financials snapshot yet — run ESR extraction first.</div>
      </div>
    );
  }

  // The status strip is meant to describe the SAME snapshot rendered below it
  // ("what was captured for this calculation"). `data_pull_status` is a live,
  // separately-mutable table though — re-triggering a source's pull resets its
  // status back to PENDING immediately, even while the ESR snapshot below is
  // still (correctly) using an earlier COMPLETED pull's data. Left as a raw
  // passthrough, that produces exactly the confusing state a user reported:
  // "ITR: PENDING" next to a fully-populated, in-use ITR/Net Profit section.
  // So: a source reads as COMPLETE here whenever the snapshot actually has
  // data for it, regardless of whether a newer re-pull is mid-flight; the raw
  // live status is only shown when the snapshot has nothing for that source.
  const effectiveStatus = (raw, hasSnapshotData) => (hasSnapshotData ? 'COMPLETE' : raw);
  const gstEffective = effectiveStatus(pull?.gst_status, esr.gst_avg_monthly_sales != null);
  const itrEffective = effectiveStatus(pull?.itr_status, esr.itr_pat != null || esr.itr_gross_receipts != null);
  const bankEffective = effectiveStatus(pull?.bank_status, esr.bank_avg_balance != null || esr.bank_avg_monthly_credit != null);

  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--warning)' }}>
      <div style={{ padding: '8px 12px', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={13} color="var(--warning)" />
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Income Sources — what was captured for this calculation (dev build only)
        </span>
      </div>

      <div style={{ padding: 12 }}>
        {/* Data pull status strip */}
        {pull && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <PullStatusBadge label="GST" status={gstEffective} />
            <PullStatusBadge label="ITR" status={itrEffective} />
            <PullStatusBadge label="Bank" status={bankEffective} />
            <PullStatusBadge label="Bureau" status={pull.bureau_status} />
            <PullStatusBadge label="PAN" status={pull.pan_status} />
          </div>
        )}

        {/* Primary selection */}
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>Primary Income Selected</div>
          <IncomeRow label="Method" value={esr.selected_income_method} />
          <IncomeRow label="Monthly income used" value={fmt(esr.selected_monthly_income)} />
          <IncomeRow label="Employment type" value={esr.employment_type} />
          <IncomeRow label="Constitution" value={esr.constitution_type} />
          <IncomeRow label="Business vintage" value={esr.business_vintage_months != null ? `${esr.business_vintage_months} months` : null} />
        </div>

        {/* Salaried */}
        {(esr.salaried_gross_monthly || esr.salaried_net_monthly || esr.salaried_income) && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>Salaried Income</div>
            <IncomeRow label="Source" value={esr.salaried_income_source} />
            <IncomeRow label="Salary slips used" value={esr.salaried_slip_count} />
            <IncomeRow label="Gross monthly" value={fmt(esr.salaried_gross_monthly)} />
            <IncomeRow label="Net monthly" value={fmt(esr.salaried_net_monthly)} />
            <IncomeRow label="Bank-verified net salary" value={fmt(esr.bank_net_salary_monthly)} />
            <IncomeRow label="Incentive income (3mo avg)" value={fmt(esr.salaried_incentive_income)} />
            <IncomeRow label="Annual bonus" value={fmt(esr.salaried_annual_bonus)} />
            <IncomeRow label="Other income" value={fmt(esr.salaried_other_income)} />
            {allSalarySlips.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {allSalarySlips.length} salary slip OCR result(s) on file
              </div>
            )}
          </div>
        )}

        {/* ITR / Net Profit */}
        {(esr.itr_pat || esr.itr_gross_receipts) && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>ITR / Net Profit</div>
            <IncomeRow label="PAT (latest year)" value={fmt(esr.itr_pat)} />
            <IncomeRow label="PAT (previous year)" value={fmt(esr.itr_pat_previous_year)} />
            <IncomeRow label="Gross receipts (latest year)" value={fmt(esr.itr_gross_receipts)} />
            <IncomeRow label="Gross receipts (previous year)" value={fmt(esr.itr_gross_receipts_previous_year)} />
            <IncomeRow label="Depreciation addback" value={fmt(esr.itr_depreciation)} />
            <IncomeRow label="Finance cost (interest) addback" value={fmt(esr.itr_finance_cost)} />
            <IncomeRow label="Director remuneration addback" value={fmt(esr.itr_remuneration)} />
            <IncomeRow label="Computed net profit income" value={fmt(esr.net_profit_income)} />
          </div>
        )}

        {/* GST */}
        {esr.gst_avg_monthly_sales != null && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>GST</div>
            <IncomeRow label="Average monthly sales" value={fmt(esr.gst_avg_monthly_sales)} />
            <IncomeRow label="Industry type" value={esr.gst_industry_type} />
            <IncomeRow label="Industry margin (stored)" value={fmtPct(esr.gst_industry_margin)} />
            <IncomeRow label="Computed GST income" value={fmt(esr.gst_income)} />
          </div>
        )}

        {/* Banking */}
        {(esr.bank_avg_balance || esr.bank_avg_monthly_credit) && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>Bank Statement Analysis</div>
            <IncomeRow label="Average balance (ABB)" value={fmt(esr.bank_avg_balance)} />
            <IncomeRow label="Average monthly credit" value={fmt(esr.bank_avg_monthly_credit)} />
            <IncomeRow label="Total credits" value={fmt(esr.bank_total_credits)} />
            <IncomeRow label="Computed monthly income" value={fmt(esr.bank_monthly_income)} />
            <IncomeRow label="Computed banking income" value={fmt(esr.banking_income)} />
          </div>
        )}

        {/* Net worth */}
        {esr.net_worth != null && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>Net Worth</div>
            <IncomeRow label="Net worth" value={fmt(esr.net_worth)} />
          </div>
        )}

        {/* Manual / other income entries */}
        {allIncomeEntries.length > 0 && (
          <div style={TRACE_SECTION_STYLE}>
            <div style={TRACE_TITLE_STYLE}>Manual / Other Income Entries</div>
            {allIncomeEntries.map((e, i) => (
              <div key={i} style={TRACE_ROW_STYLE}>
                <span>{e.income_type || e.description || 'Entry'} ({e.applicantName})</span>
                <span style={{ fontWeight: 700 }}>{fmt(e.annual_amount)}/yr</span>
              </div>
            ))}
          </div>
        )}

        {/* Existing obligations */}
        <div style={{ ...TRACE_SECTION_STYLE, borderBottom: 'none' }}>
          <div style={TRACE_TITLE_STYLE}>Obligations</div>
          <IncomeRow label="Existing obligations (monthly EMI)" value={fmt(esr.existing_obligations)} />
        </div>
      </div>
    </div>
  );
}

// ─── Full Calculation Trace (dev-only) ────────────────────────────────────────
// Surfaces the complete scheme_evaluations object the engine actually
// computed — income composition, FOIR/DSCR resolution, LTV resolution,
// obligation handling, and every other field the backend populated — not
// just the six summary tiles CalcBreakdownPanel shows above it. A catch-all
// section at the end renders any remaining populated field generically, so
// a lender-specific field (GRP multiplier, double-whammy breakdown, DSCR
// ratio, etc.) is never silently hidden just because this component didn't
// special-case it by name.
const TRACE_SECTION_STYLE = { border: '1px solid var(--border)', padding: 10, marginTop: 8 };
const TRACE_TITLE_STYLE = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 6 };
const TRACE_ROW_STYLE = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, padding: '2px 0', borderBottom: '1px dotted var(--border)' };

function humanizeFieldName(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatTraceValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('en-IN') : value.toFixed(4);
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} entries`;
  if (typeof value === 'object') return null; // rendered separately, not inline
  return String(value);
}

// Fields already shown elsewhere (top summary tiles, or rendered as their
// own dedicated section below) — excluded from the generic catch-all so
// nothing appears twice.
const TRACE_HANDLED_KEYS = new Set([
  'scheme_id', 'scheme_name', 'lender_policy_key', 'lender_policy_name', 'product_id', 'product_type',
  'product_display_name', 'is_eligible', 'status', 'configuration_status', 'income_method_matched',
  'manual_review_required', 'reason_code', 'ineligibility_reason', 'failure_reasons', 'warnings', 'policy_warnings',
  'eligible_income_breakdown', 'foir_breakdown', 'dscr_breakdown',
  'final_eligible_loan_amount', 'eligible_loan_amount', 'foir_based_eligible_loan_amount', 'ltv_based_eligible_loan_amount',
  'requested_loan_cap', 'product_cap', 'max_loan_by_ltv',
  'applicable_ltv_key', 'applicable_ltv_percent', 'actual_final_ltv_percent', 'property_value',
  'monthly_income_used', 'primary_monthly_income_used', 'monthly_income_note',
  'maximum_eligible_emi', 'max_eligible_emi', 'proposed_emi', 'foir_allowed_percent', 'foir_actual_percent',
  'dscr_min_ratio', 'dscr_actual_ratio', 'dscr_eligible_loan_amount', 'dscr_status',
  'final_tenure_used', 'lender_max_tenure_months', 'max_tenure_months', 'age_based_tenure_limit_months',
  'underwriting_roi_used', 'roi_min', 'roi_max', 'pf_min', 'pf_max',
  'hdfc_pos_deduction_entries', 'obligation_exclusion_notes', 'hdfc_unsecured_pos_deduction',
  'surrogate_program_notes', 'raw_trace_text',
]);

function FullCalculationTrace({ ev }) {
  const income = ev.eligible_income_breakdown || [];
  const foir = ev.foir_breakdown;
  const dscr = ev.dscr_breakdown;
  const legacyWarnings = (ev.warnings || []).filter((w) => w.startsWith('Parser warning'));
  const realWarnings = (ev.warnings || []).filter((w) => !w.startsWith('Parser warning'));
  const [showLegacy, setShowLegacy] = useState(false);
  const [showRawTrace, setShowRawTrace] = useState(false);

  const otherFields = Object.entries(ev)
    .filter(([k, v]) => !TRACE_HANDLED_KEYS.has(k) && v !== null && v !== undefined && v !== '' && formatTraceValue(v) !== null)
    .filter(([, v]) => !(Array.isArray(v) && v.length === 0));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Zap size={11} /> FULL CALCULATION TRACE (dev build only)
      </div>

      {ev.failure_reasons?.length > 0 && (
        <div style={{ ...TRACE_SECTION_STYLE, background: 'var(--error-bg)', borderColor: 'var(--error)' }}>
          <div style={{ ...TRACE_TITLE_STYLE, color: 'var(--error)' }}>Why this scheme is not eligible</div>
          {ev.failure_reasons.map((r, i) => <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>• {r}</div>)}
        </div>
      )}

      {income.length > 0 && (
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>Income Composition</div>
          {income.map((row, i) => (
            <div key={i} style={TRACE_ROW_STYLE}>
              <span>{row.type}{row.source ? ` (${row.source})` : ''}{row.rule ? <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{row.rule}</div> : null}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(row.eligible_monthly)}{row.raw_monthly != null && row.raw_monthly !== row.eligible_monthly ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (raw {fmt(row.raw_monthly)})</span> : null}</span>
            </div>
          ))}
          <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none', fontWeight: 700, marginTop: 4 }}>
            <span>Total monthly income used</span><span>{fmt(ev.monthly_income_used)}</span>
          </div>
        </div>
      )}

      {foir && (
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>FOIR Resolution</div>
          <div style={TRACE_ROW_STYLE}><span>Composed income</span><span>{fmt(foir.composed_income)}</span></div>
          <div style={TRACE_ROW_STYLE}><span>Net obligations</span><span>{fmt(foir.net_obligations)}</span></div>
          <div style={TRACE_ROW_STYLE}><span>FOIR allowed / actual</span><span>{fmtPct(foir.foir_allowed_percent)} / {fmtPct(foir.foir_actual_percent)}</span></div>
          {foir.foir_rule && (
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', padding: '2px 0 6px' }}>{foir.foir_rule}</div>
          )}
          <div style={TRACE_ROW_STYLE}><span>Maximum eligible EMI</span><span>{fmt(foir.maximum_eligible_emi)}</span></div>
          <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none' }}><span>Proposed EMI</span><span>{fmt(foir.proposed_emi)}</span></div>
        </div>
      )}

      {dscr && (
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>DSCR Resolution</div>
          {Object.entries(dscr).map(([k, v]) => (
            <div key={k} style={TRACE_ROW_STYLE}><span>{humanizeFieldName(k)}</span><span>{formatTraceValue(v) ?? JSON.stringify(v)}</span></div>
          ))}
        </div>
      )}

      <div style={TRACE_SECTION_STYLE}>
        <div style={TRACE_TITLE_STYLE}>LTV Resolution</div>
        <div style={TRACE_ROW_STYLE}><span>Applicable LTV ({ev.applicable_ltv_key || '—'})</span><span>{fmtPct(ev.applicable_ltv_percent)}</span></div>
        <div style={TRACE_ROW_STYLE}><span>Property value</span><span>{fmt(ev.property_value)}</span></div>
        <div style={TRACE_ROW_STYLE}><span>Max loan by LTV</span><span>{fmt(ev.max_loan_by_ltv)}</span></div>
        <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none' }}><span>Actual final LTV%</span><span>{fmtPct(ev.actual_final_ltv_percent)}</span></div>
      </div>

      <div style={TRACE_SECTION_STYLE}>
        <div style={TRACE_TITLE_STYLE}>Tenure / ROI / PF</div>
        <div style={TRACE_ROW_STYLE}><span>Tenure used (age-capped / lender max)</span><span>{ev.final_tenure_used} mo ({ev.age_based_tenure_limit_months} / {ev.lender_max_tenure_months})</span></div>
        <div style={TRACE_ROW_STYLE}><span>Underwriting ROI used</span><span>{ev.underwriting_roi_used}%</span></div>
        <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none' }}><span>PF range</span><span>{fmtPct(ev.pf_min)}–{fmtPct(ev.pf_max)}</span></div>
      </div>

      {(ev.hdfc_pos_deduction_entries?.length > 0 || ev.obligation_exclusion_notes?.length > 0) && (
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>Obligation Handling</div>
          {(ev.obligation_exclusion_notes || []).map((n, i) => <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>• {n}</div>)}
          {ev.hdfc_unsecured_pos_deduction ? (
            <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none' }}><span>POS deducted from final amount</span><span>{fmt(ev.hdfc_unsecured_pos_deduction)}</span></div>
          ) : null}
        </div>
      )}

      <div style={TRACE_SECTION_STYLE}>
        <div style={TRACE_TITLE_STYLE}>Final Amount Resolution</div>
        <div style={TRACE_ROW_STYLE}><span>FOIR-based eligible amount</span><span>{fmt(ev.foir_based_eligible_loan_amount)}</span></div>
        <div style={TRACE_ROW_STYLE}><span>LTV-based eligible amount</span><span>{fmt(ev.ltv_based_eligible_loan_amount)}</span></div>
        {ev.requested_loan_cap != null && <div style={TRACE_ROW_STYLE}><span>Requested loan cap</span><span>{fmt(ev.requested_loan_cap)}</span></div>}
        {ev.product_cap != null && <div style={TRACE_ROW_STYLE}><span>Product cap</span><span>{fmt(ev.product_cap)}</span></div>}
        <div style={{ ...TRACE_ROW_STYLE, borderBottom: 'none', fontWeight: 800 }}><span>Final eligible amount (min of the above)</span><span>{fmt(ev.final_eligible_loan_amount)}</span></div>
      </div>

      {otherFields.length > 0 && (
        <div style={TRACE_SECTION_STYLE}>
          <div style={TRACE_TITLE_STYLE}>Other Fields</div>
          {otherFields.map(([k, v]) => (
            <div key={k} style={TRACE_ROW_STYLE}><span>{humanizeFieldName(k)}</span><span>{formatTraceValue(v)}</span></div>
          ))}
        </div>
      )}

      {realWarnings.length > 0 && (
        <div style={{ ...TRACE_SECTION_STYLE, background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
          <div style={{ ...TRACE_TITLE_STYLE, color: 'var(--warning)' }}>Warnings</div>
          {realWarnings.map((w, i) => <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>• {w}</div>)}
        </div>
      )}

      {legacyWarnings.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowLegacy(!showLegacy)} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showLegacy ? 'Hide' : 'Show'} {legacyWarnings.length} legacy parameter-parsing notes
          </button>
          {showLegacy && legacyWarnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>• {w}</div>)}
        </div>
      )}

      {ev.raw_trace_text && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowRawTrace(!showRawTrace)} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showRawTrace ? 'Hide' : 'Show'} complete raw calculation log for this method
          </button>
          {showRawTrace && (
            <pre style={{
              marginTop: 6,
              padding: 10,
              fontSize: 10.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 480,
              overflowY: 'auto',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)'
            }}>
              {ev.raw_trace_text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calculation Breakdown Panel ──────────────────────────────────────────────
const CalcBreakdownPanel = ({ evaluations }) => {
  const [open, setOpen] = useState(false);
  const [activeScheme, setActiveScheme] = useState(0);

  // The API returns scheme_evaluations in evaluation order, not merit order —
  // the backend sorts only a filtered copy when picking `best_scheme_name`
  // (dynamicEligibility.service), so the raw array the client gets is unsorted
  // and the panel used to open on an arbitrary (often ineligible) scheme.
  //
  // Mirror that same comparator here — eligible first, then loan amount ↓,
  // ROI ↑, tenure ↓ — so tab one is always the scheme the card advertises as
  // best. Sorted copy: never mutate the prop array.
  const orderedEvaluations = useMemo(() => {
    if (!evaluations || evaluations.length === 0) return [];
    return [...evaluations].sort((a, b) => {
      if (a.is_eligible !== b.is_eligible) return a.is_eligible ? -1 : 1;

      const loanA = a.final_eligible_loan_amount || 0;
      const loanB = b.final_eligible_loan_amount || 0;
      if (loanB !== loanA) return loanB - loanA;

      const roiA = a.roi_min || Infinity;
      const roiB = b.roi_min || Infinity;
      if (roiB !== roiA) return roiA - roiB;

      return (b.max_tenure_months || 0) - (a.max_tenure_months || 0);
    });
  }, [evaluations]);

  // On an "Any product type" case, the same scheme name (e.g. "Net Profit
  // Method") is commonly configured separately per product (HL and LAP each
  // have their own copy, with different LTV/tenure/ROI) — every product the
  // lender offers gets evaluated, so both show up here as distinct entries.
  // That reads as an accidental duplicate unless disambiguated: only append
  // the product name to a tab label when its scheme_name isn't unique in
  // this list, so the normal single-product-type case stays unchanged.
  const schemeNameCounts = useMemo(() => {
    const counts = {};
    for (const e of orderedEvaluations) {
      counts[e.scheme_name] = (counts[e.scheme_name] || 0) + 1;
    }
    return counts;
  }, [orderedEvaluations]);

  if (orderedEvaluations.length === 0) return null;

  const ev = orderedEvaluations[activeScheme] || orderedEvaluations[0];

  // Actuals only — the policy-allowed/cap variants (FOIR Allowed, LTV Applied
  // key, intermediate EMI/loan-by-LTV steps) took up more space than they
  // were worth here. Loan Amount is back per the lender card's top MetricTile
  // only ever shows the *best* scheme's amount (orderedEvaluations is sorted
  // best-first) — switching to a different scheme tab here has no other way
  // to see that specific method's own eligible amount. DSCR-method schemes
  // show their actual ratio in place of FOIR — the two are mutually
  // exclusive per scheme (dscr_actual_ratio is only ever populated for
  // DSCR-method schemes).
  const isDscrMethod = ev.dscr_actual_ratio != null;
  const steps = [
    { label: 'Loan Amount', value: ev.final_eligible_loan_amount != null ? formatDynamicCurrency(ev.final_eligible_loan_amount) : '—', icon: IndianRupee, color: 'var(--success)', bg: 'var(--success-bg)' },
    // Range per this specific method/scheme (roi_min/roi_max), not just the
    // single underwriting value used for its own EMI calc — same min–max
    // display pattern already used on the lender card's top ROI tile, just
    // scoped to the currently selected scheme instead of the lender overall.
    { label: 'ROI', value: ev.roi_min != null ? `${ev.roi_min}%${ev.roi_max != null && ev.roi_max !== ev.roi_min ? `–${ev.roi_max}%` : ''}` : '—', icon: TrendingUp, color: 'var(--info)', bg: 'var(--info-bg)' },
    { label: 'Tenure', value: ev.final_tenure_used != null ? formatDynamicTenure(ev.final_tenure_used) : '—', icon: Clock, color: 'var(--role-cred2tech)', bg: 'var(--role-cred2tech-bg)' },
    isDscrMethod
      ? { label: 'DSCR', value: `${Number(ev.dscr_actual_ratio).toFixed(2)}x`, icon: TrendingDown,
          color: ev.dscr_min_ratio != null && ev.dscr_actual_ratio < ev.dscr_min_ratio ? 'var(--error)' : 'var(--success)',
          bg: ev.dscr_min_ratio != null && ev.dscr_actual_ratio < ev.dscr_min_ratio ? 'var(--error-bg)' : 'var(--success-bg)' }
      : { label: 'FOIR', value: fmtPct(ev.foir_actual_percent), icon: TrendingDown,
          color: ev.foir_actual_percent > ev.foir_allowed_percent ? 'var(--error)' : 'var(--success)',
          bg: ev.foir_actual_percent > ev.foir_allowed_percent ? 'var(--error-bg)' : 'var(--success-bg)' },
    { label: 'LTV', value: ev.actual_final_ltv_percent != null ? `${(ev.actual_final_ltv_percent * 100).toFixed(0)}%` : '—', icon: Home, color: 'var(--role-admin)', bg: 'var(--role-admin-bg)' },
    { label: 'PF', value: (ev.pf_min != null || ev.pf_max != null)
        ? `${ev.pf_min != null ? (ev.pf_min * 100).toFixed(2) : '—'}%–${ev.pf_max != null ? (ev.pf_max * 100).toFixed(2) : '—'}%`
        : '—', icon: Percent, color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 0 }}>
        <Calculator size={12} />
        {open ? 'Hide Calculation' : 'View Calculation'}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: easeOut }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 10, borderRadius: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* Scheme tabs scroll horizontally rather than wrapping. With
                  `flex: 1` + wrap, every scheme was squeezed into an equal
                  share of one row, so with more than a few schemes the names
                  were crushed and some options unreadable. Tabs now keep their
                  natural width and the strip scrolls — nothing is hidden or
                  truncated. Best scheme is first, so the default selection is
                  always in view. */}
              {orderedEvaluations.length > 1 && (
                <div
                  className="scheme-tabs"
                  style={{
                    display: 'flex', background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden',
                    scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {orderedEvaluations.map((e, i) => (
                    <button key={i} onClick={() => setActiveScheme(i)} style={{
                      flex: '0 0 auto', padding: '8px 12px', fontSize: 11, fontWeight: 600,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      whiteSpace: 'nowrap',
                      background: activeScheme === i ? 'var(--primary)' : 'transparent',
                      color: activeScheme === i ? '#fff' : 'var(--text-secondary)',
                    }}>
                      {e.scheme_name}
                      {schemeNameCounts[e.scheme_name] > 1 && e.product_display_name ? ` (${e.product_display_name})` : ''}
                      {e.is_eligible ? <CheckCircle2 size={11} color={activeScheme === i ? '#fff' : 'var(--success)'} /> : <XCircle size={11} color={activeScheme === i ? '#fff' : 'var(--error)'} />}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 6 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ background: step.bg, borderRadius: 0, padding: '7px 8px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        <step.icon size={10} /> {step.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: step.color }}>
                        {step.value}
                      </div>
                    </div>
                  ))}
                </div>
                {IS_DEV_BUILD && <FullCalculationTrace ev={ev} />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Lender Action Button (multi-proposal aware) ───────────────────────────────
// Every action button on a lender card renders at one height.
//
// Their vertical padding, font sizes and icon sizes all differ by design
// (9px vs 10px padding, 11/12/14px text, 13 vs 15px icons, some with a border
// and some without), so intrinsic heights ranged from ~32px to ~39px and the
// rows looked uneven across the eligible-lender grid. Pinning the height and
// dropping vertical padding — flex centring already handles the alignment —
// makes them uniform without flattening the intentional visual differences
// between primary and secondary actions.
const LENDER_CARD_BTN_H = 38;   // card (non-compact) layout
const LENDER_ROW_BTN_H = 30;    // compact list/table row

const LENDER_ACTION_BTN = {
  borderRadius: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  height: LENDER_ROW_BTN_H,
  paddingTop: 0,
  paddingBottom: 0,
};

function LenderActions({ lender, caseId, proposals, onProposalCreated, onOpenProposal, compact = false, isMsme = false, onApplyForLoan }) {
  const [creating, setCreating] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  // Find existing proposals for this lender
  const lenderProposals = proposals.filter(p => String(p.lender_id) === String(lender.lender_id));
  const latestProposal = lenderProposals[lenderProposals.length - 1] || null;

  // Find the most recent submitted proposal from any other lender for clone
  const otherSubmitted = proposals.find(p =>
    String(p.lender_id) !== String(lender.lender_id) && p.proposal_status === 'submitted'
  ) || proposals.find(p => String(p.lender_id) !== String(lender.lender_id));

  // MSME self-service customers never create/send proposals directly - picking
  // a bank here moves to step 7, a dedicated loan-terms page where they state
  // how much they need before the case goes to the Cred2Tech admin queue (the
  // assigned DSA creates the actual proposal for that lender after allocation).
  if (isMsme) {
    return (
      <button
        className={`btn ${compact ? 'btn-sm' : ''}`}
        style={{
          borderRadius: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          padding: compact ? undefined : '10px', width: compact ? undefined : '100%', justifyContent: 'center',
          background: 'linear-gradient(135deg,#2B6CB0,#553C9A)', color: '#fff', border: 'none', cursor: 'pointer'
        }}
        onClick={() => onApplyForLoan(lender)}
      >
        <Send size={compact ? 12 : 15} />
        Apply for this Loan
      </button>
    );
  }

  const handlePrepare = async () => {
    // If there are proposals from other lenders, ask to clone
    if (otherSubmitted && lenderProposals.length === 0) {
      setShowCloneDialog(true);
      return;
    }
    await doCreate(null);
  };

  const doCreate = async (cloneSourceId) => {
    try {
      setCreating(true);
      let result;
      if (cloneSourceId) {
        result = await caseService.cloneProposal(caseId, cloneSourceId, {
          new_lender_id: lender.lender_id,
          new_scheme_id: lender.scheme_evaluations?.[0]?.scheme_id || null,
        });
        result = result.proposal;
      } else {
        // Prefer an eligible scheme's id; for a "Not Eligible" lender none
        // will match, so fall back to whatever scheme was evaluated rather
        // than leaving the proposal with no scheme reference at all.
        const r = await caseService.createProposal(caseId, {
          lender_id: lender.lender_id,
          scheme_id: lender.scheme_evaluations?.find(s => s.is_eligible)?.scheme_id
            || lender.scheme_evaluations?.[0]?.scheme_id
            || null,
        });
        result = r.proposal;
      }
      onProposalCreated();
      toast.success(`Proposal created: ${result.proposal_number}`);
      onOpenProposal(result.id);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create proposal');
    } finally {
      setCreating(false);
      setShowCloneDialog(false);
    }
  };

  // Proposal status badges are deliberately NOT rendered here — they live in
  // the card's identity row, immediately left of the Eligible badge, so status
  // reads alongside eligibility rather than being buried in the action cluster.
  if (compact) {
    return (
      <div className="lender-actions-compact" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
        {latestProposal ? (
          <button className="btn btn-primary btn-sm" style={LENDER_ACTION_BTN}
            onClick={() => onOpenProposal(latestProposal.id)}>
            View →
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" style={LENDER_ACTION_BTN}
            onClick={handlePrepare} disabled={creating}>
            <ClipboardList size={12} /> {creating ? '...' : 'Prepare'}
          </button>
        )}

        <AnimatePresence initial={false}>
          {showCloneDialog && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: easeOut }}
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 260, zIndex: 20,
                padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--info)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={13} /> Reuse existing proposal?
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Reuse proposal #{otherSubmitted?.proposal_number}'s data and documents for {lender.lender_name}?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => doCreate(otherSubmitted.id)}
                  disabled={creating}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, borderRadius: 0, justifyContent: 'center' }}>
                  {creating ? 'Cloning...' : 'Clone'}
                </button>
                <button
                  onClick={() => { setShowCloneDialog(false); doCreate(null); }}
                  disabled={creating}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, borderRadius: 0, justifyContent: 'center' }}>
                  Fresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      {/* Clone dialog */}
      <AnimatePresence initial={false}>
        {showCloneDialog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: easeOut }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '14px', background: 'var(--info-bg)', borderRadius: 0,
              border: '1px solid var(--info)', marginBottom: 10
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={13} /> Reuse existing proposal?
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                A proposal was already prepared (#{otherSubmitted?.proposal_number}).
                Reuse its data and documents for {lender.lender_name}?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => doCreate(otherSubmitted.id)}
                  disabled={creating}
                  style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                           background: '#2B6CB0', color: '#fff', border: 'none',
                           borderRadius: 0, cursor: 'pointer' }}>
                  <CheckCircle2 size={13} /> {creating ? 'Cloning...' : 'Yes, Clone Proposal'}
                </button>
                <button
                  onClick={() => { setShowCloneDialog(false); doCreate(null); }}
                  disabled={creating}
                  style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                           background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                           border: '1px solid var(--border)', borderRadius: 0, cursor: 'pointer' }}>
                  No, Start Fresh
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing proposal badges + view button */}
      {lenderProposals.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {lenderProposals.map(p => (
            <ProposalBadge key={p.id} status={p.lender_submission_status || p.proposal_status} />
          ))}
        </div>
      )}

      {/* Row 1: primary action — always full width, own row so its label never gets squeezed */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {latestProposal ? (
          <>
            <button
              className="btn btn-primary"
              style={{ flex: 1, height: LENDER_CARD_BTN_H, padding: '0 9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => onOpenProposal(latestProposal.id)}
            >
              View Proposal →
            </button>
            <button
              className="btn btn-secondary"
              style={{ height: LENDER_CARD_BTN_H, padding: '0 14px', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
              onClick={() => doCreate(latestProposal.id)}
              disabled={creating}
              title="Send to another lender"
            >
              + Resend
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            style={{ flex: 1, height: LENDER_CARD_BTN_H, padding: '0 10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                     background: 'linear-gradient(135deg,#2B6CB0,#553C9A)' }}
            onClick={handlePrepare}
            disabled={creating}
          >
            <ClipboardList size={15} /> {creating ? 'Creating...' : 'Prepare Proposal →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main EsrPage ─────────────────────────────────────────────────────────────
// Step 6 of the case journey — rendered inline by AddCustomerWizardPage (not
// its own route), so it takes caseId/onOpenProposal as props instead of
// reading useParams()/navigating itself. onOpenProposal(proposalId) is how a
// newly created (or existing) proposal hands off to step 7, since proposalId
// only ever exists once one has actually been created here.
export default function EsrPage({ caseId, onOpenProposal, isMsme = false, onApplyForLoan }) {

  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [esr, setEsr]               = useState(null);
  const [proposals, setProposals]   = useState([]);
  const [caseDetail, setCaseDetail] = useState(null); // dev-build only — raw income-source data (GST/ITR/Bank/Salaried)
  const [lenderFilter, setLenderFilter]         = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [showIneligible, setShowIneligible] = useState(true);

  // The card list is rendered from esr.raw_payload.lenders (a debugging
  // snapshot taken before the EligibilityReportLender rows were inserted, so
  // it has no real id) - resolve the real row id via lender_id so step 7 can
  // record msme_selected_lender_esr_id correctly on submit.
  const handleApplyForLoan = (lender) => {
    const dbLenderId = esr?.lenders?.find(l => String(l.lender_id) === String(lender.lender_id))?.id;
    if (!dbLenderId) {
      toast.error('Could not resolve this lender - please regenerate the ESR and try again.');
      return;
    }
    onApplyForLoan({ ...lender, dbLenderId });
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // getCaseById is a fairly heavy call (full applicant/customer income
      // sub-records) only needed to render IncomeSourcesPanel below — skip
      // it entirely outside dev builds rather than fetch data that never renders.
      const [esrResult, proposalsResult, caseResult] = await Promise.allSettled([
        caseService.getESR(caseId),
        caseService.listProposals(caseId),
        IS_DEV_BUILD ? caseService.getCaseById(caseId) : Promise.resolve(null),
      ]);
      if (esrResult.status === 'fulfilled') setEsr(esrResult.value);
      else if (esrResult.reason?.response?.status !== 404) toast.error('Failed to load ESR');
      if (proposalsResult.status === 'fulfilled') setProposals(proposalsResult.value.proposals || []);
      if (caseResult.status === 'fulfilled') setCaseDetail(caseResult.value);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await caseService.generateESR(caseId);
      await load();
      toast.success(`ESR generated! ${result.eligible_count} lender(s) eligible.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate ESR');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <LoadingSpinner size={40} />
    </div>
  );

  const lenders = esr?.raw_payload?.lenders || [];
  const eligibleCount   = lenders.filter(l => l.is_eligible).length;
  const ineligibleCount = lenders.filter(l => !l.is_eligible).length;

  const lenderNames = [...new Set(lenders.map(l => l.lender_name))].sort();
  const filteredLenders = lenders.filter(l =>
    (lenderFilter === 'all' || l.lender_name === lenderFilter) &&
    (eligibilityFilter === 'all' || (eligibilityFilter === 'eligible' ? l.is_eligible : !l.is_eligible))
  );

  return (
    <div className="esr-page">
      <style>{`
        .esr-page .card,
        .esr-page .btn,
        .esr-page .form-control { border-radius: 0 !important; }
        /* Scheme tab strip: slim scrollbar so it's clear the row scrolls when
           a lender has more schemes than fit, without a chunky OS bar sitting
           under the tabs. */
        .esr-page .scheme-tabs::-webkit-scrollbar { height: 4px; }
        .esr-page .scheme-tabs::-webkit-scrollbar-track { background: transparent; }
        .esr-page .scheme-tabs::-webkit-scrollbar-thumb {
          background: var(--border-strong, var(--border));
          border-radius: 0;
        }

        /* ── Mobile: lender card actions ──────────────────────────────────
           On a phone the action cluster ("View →" / "Prepare", "Send", and the
           other-lender arrow) sat in a nowrap row pinned to the right of the
           metric tiles, behind a vertical divider. There was never enough width,
           so the buttons overflowed the card and their labels were clipped.

           Below 640px the cluster drops onto its own full-width row under the
           metrics, the vertical divider becomes a horizontal rule, and the two
           labelled buttons share the width evenly while the icon-only action
           keeps a fixed square footprint. !important is needed throughout —
           these properties are set as inline styles on the elements. */
        @media (max-width: 640px) {
          .esr-page .lender-actions-wrap {
            width: 100%;
            flex-shrink: 1 !important;
            padding-left: 0 !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
            margin-top: 10px;
            padding-top: 10px;
          }
          .esr-page .lender-actions-compact {
            width: 100%;
            flex-wrap: nowrap !important;
          }
          /* Labelled actions split the row; the trailing icon button stays square.
             :last-of-type, not :last-child — an AnimatePresence <div> (the clone
             dialog) renders after the buttons whenever that dialog is open, so
             :last-child would silently stop matching. */
          .esr-page .lender-actions-compact > button {
            flex: 1 1 0 !important;
            min-width: 0;
          }
          .esr-page .lender-actions-compact > button:last-of-type {
            flex: 0 0 40px !important;
          }
        }
        /* Dark mode: the shared grey text tokens read too low-contrast on
           this data-heavy page — bump them to white here specifically,
           without touching the global theme. */
        :root.dark .esr-page {
          --text-secondary: #ffffff;
          --text-tertiary: #ffffff;
        }
        /* Light mode: same low-contrast grey complaint — use black instead. */
        :root:not(.dark) .esr-page {
          --text-secondary: #000000;
          --text-tertiary: #000000;
        }
      `}</style>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Your Loan Eligibility Results
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Here's what you qualify for across our lending partners.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {esr && (
            <button className="btn btn-secondary btn-sm" onClick={handleGenerate} disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} className={generating ? 'spin' : ''} />
              {generating ? 'Refreshing...' : 'Refresh Results'}
            </button>
          )}
        </div>
      </motion.div>



      {/* No ESR yet */}
      {!esr && !generating && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="card" style={{ padding: '60px 40px', textAlign: 'center', marginBottom: 24, borderRadius: 0 }}>
          <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-elevated)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <BarChart3 size={32} color="var(--text-tertiary)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Let's check your eligibility
          </h3>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>
            We'll instantly check your eligibility across all our lending partners.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating} style={{ padding: '14px 36px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} /> Check My Eligibility
          </button>
        </motion.div>
      )}

      {IS_DEV_BUILD && esr && <IncomeSourcesPanel caseDetail={caseDetail} />}

      {/* Filter bar */}
      {esr && lenders.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          marginBottom: 20, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700 }}>
            <ListFilter size={14} /> Filter Offers
          </div>
          <select className="form-control" value={lenderFilter} onChange={e => setLenderFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 180, padding: '9px 10px', fontSize: 13 }}>
            <option value="all">All Lenders ({lenders.length})</option>
            {lenderNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select className="form-control" value={eligibilityFilter} onChange={e => setEligibilityFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 160, padding: '9px 10px', fontSize: 13 }}>
            <option value="all">All Statuses</option>
            <option value="eligible">Eligible ({eligibleCount})</option>
            <option value="ineligible">Not Eligible ({ineligibleCount})</option>
          </select>
          {(lenderFilter !== 'all' || eligibilityFilter !== 'all') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setLenderFilter('all'); setEligibilityFilter('all'); }}>
              Clear filters
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Showing {filteredLenders.length} of {lenders.length}
          </div>
        </div>
      )}

      {/* Lenders — compact list view */}
      {esr && lenders.length > 0 && (() => {
        const renderRow = (lender, i) => {
          const eligible = lender.is_eligible;
          // Same derivation LenderActions uses — the status badges moved up
          // into the identity row, so the card needs them here too.
          const lenderProposals = proposals.filter(p => String(p.lender_id) === String(lender.lender_id));
          return (
            <motion.div key={lender.lender_id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.02 }}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: 0, marginBottom: 12 }}
            >
              <div style={{ padding: '12px 16px', opacity: eligible ? 1 : 0.75 }}>
                {/* Identity row: icon + name/product on the left, status badge anchored right */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                    {eligible ? <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
                              : <XCircle size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 1 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{lender.lender_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {lender.product_display_name || lender.product_type}
                        {eligible && lender.best_scheme_name ? ` · ${lender.best_scheme_name}` : ''}
                      </div>
                    </div>
                  </div>
                  {/* Proposal status sits immediately left of the eligibility
                      badge, so the two read together as one right-anchored
                      status group. Both are baseline-aligned and never shrink,
                      so a long lender name pushes them as a unit instead of
                      squeezing one into the other. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {lenderProposals.length > 0 && lenderProposals.map(p => (
                      <ProposalBadge key={p.id} status={p.lender_submission_status || p.proposal_status} />
                    ))}
                    <span style={{
                      background: eligible ? 'var(--success-bg)' : 'var(--bg-elevated)',
                      color: eligible ? 'var(--success)' : 'var(--text-tertiary)',
                      padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700,
                      border: `1px solid ${eligible ? 'var(--success)' : 'var(--border)'}`, flexShrink: 0
                    }}>
                      {eligible ? 'Eligible' : 'Not Eligible'}
                    </span>
                  </div>
                </div>

                {/* Stats + actions row: stats hug the left, actions form their own
                    right-anchored group behind a hairline divider — so the button
                    cluster never wraps into the middle of the metric tiles. */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 16, flexWrap: 'wrap', marginTop: 10, paddingLeft: 26
                }}>
                  {eligible ? (
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      <MetricTile size="sm" label="Loan" value={formatDynamicCurrency(lender.final_eligible_loan_amount)} color="var(--success)" />
                      <MetricTile size="sm" label="ROI" value={lender.roi_min ? `${lender.roi_min}%${lender.roi_max ? `–${lender.roi_max}%` : ''}` : '—'} />
                      <MetricTile size="sm" label="Tenure" value={formatDynamicTenure(lender.max_tenure_months)} />
                    </div>
                  ) : (
                    <div style={{ width: '100%' }}>
                      {(() => {
                        const reasons = parseIneligibilityReasons(lender.ineligibility_reason);
                        if (reasons.length === 0) {
                          return <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Not eligible</div>;
                        }
                        return (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <AlertCircle size={12} style={{ flexShrink: 0 }} /> Why not eligible
                            </div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {reasons.map((reason, ri) => (
                                <li key={ri} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.4 }}>
                                  <span style={{ color: 'var(--error)', fontWeight: 700, flexShrink: 0 }}>•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Preparing/sending a proposal is allowed for a "Not
                      Eligible" lender too, same as an eligible one — the
                      eligibility engine's verdict is a screening aid, not a
                      hard block, and a DSA may still want to submit for the
                      lender's own manual review/override. */}
                  <div className="lender-actions-wrap" style={{
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    paddingLeft: 16, borderLeft: '1px solid var(--border)'
                  }}>
                    <LenderActions
                      lender={lender}
                      caseId={caseId}
                      proposals={proposals}
                      onProposalCreated={load}
                      onOpenProposal={onOpenProposal}
                      isMsme={isMsme}
                      onApplyForLoan={handleApplyForLoan}
                      compact
                    />
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 16px 8px 42px' }}>
                <CalcBreakdownPanel evaluations={lender.scheme_evaluations} />
              </div>
            </motion.div>
          );
        };

        if (filteredLenders.length === 0) {
          return (
            <div className="card" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: 0 }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No lenders match the selected filters.</p>
            </div>
          );
        }

        const visibleEligible   = filteredLenders.filter(l => l.is_eligible);
        const visibleIneligible = filteredLenders.filter(l => !l.is_eligible);

        return (
          <div>
            {visibleEligible.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                padding: '8px 14px', background: 'var(--success-bg)', border: '1px solid var(--success)',
                color: 'var(--success)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <CheckCircle2 size={14} /> Eligible Loans ({visibleEligible.length})
              </div>
            )}
            {visibleEligible.map((lender, i) => renderRow(lender, i))}

            {visibleIneligible.length > 0 && (
              <button
                onClick={() => setShowIneligible(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                  marginTop: visibleEligible.length > 0 ? 16 : 0, marginBottom: showIneligible ? 10 : 0,
                  background: 'var(--error-bg)', border: '1px solid var(--error)',
                  fontSize: 13, fontWeight: 800, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer'
                }}
              >
                <XCircle size={14} />
                {showIneligible ? 'Hide' : 'Show'} {visibleIneligible.length} lender{visibleIneligible.length === 1 ? '' : 's'} you're not eligible with
                {showIneligible ? <ChevronUp size={13} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={13} style={{ marginLeft: 'auto' }} />}
              </button>
            )}
            {showIneligible && visibleIneligible.map((lender, i) => renderRow(lender, i))}
          </div>
        );
      })()}

    </div>
  );
}
