import React, { useState, useEffect, useCallback } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '../components/ui/Skeleton';
import Panel from '../components/ui/Panel';
import { PlusCircle, Trash2, ChevronRight, User, Users } from 'lucide-react';

const INCOME_TYPES_MSME = [
  'Director Salary', "Partner's Salary", 'Interest on Capital',
  'Rental Income — Bank', 'Rental Income — Cash', 'Interest Income',
  'Dividend Income', 'Agriculture Income', 'Professional Fees', 'Other'
];
// A salaried employee has no business/directorial income concepts — swap
// those out for a plain Salary/Incentive/Bonus entry instead. Incentive and
// Bonus are kept as SEPARATE options (not one combined "Bonus / Incentive"
// choice): the ESR engine treats them differently (incentive is a recurring
// 3-month average, bonus is a single latest-year figure) and a combined
// label couldn't be matched to either bucket, so it was silently excluded
// from every lender's income calculation. Agriculture Income was previously
// only offered on the MSME side even though a salaried applicant can
// legitimately have agricultural land income too.
const INCOME_TYPES_SALARIED = [
  'Salary', 'Incentive', 'Bonus', 'Agriculture Income',
  'Rental Income — Bank', 'Rental Income — Cash',
  'Interest Income', 'Dividend Income', 'Other'
];
const DOC_TYPES = ['CA Certificate', 'Salary Slip', 'Form 16', 'ITR', 'Bank Credit', 'None'];

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

// Shared by every applicant block (and the Entity-Level block) below — same
// inline form markup the page always had, just no longer needing its own
// "Applicant" dropdown: whoever renders this already knows which
// applicant_id (or null, for Entity Level) the entry belongs to.
const AddEntryInlineForm = ({ show, incomeTypes, saving, isMobile, onSubmit }) => {
  const [draft, setDraft] = useState({ income_type: '', annual_amount: '', supporting_doc_type: 'CA Certificate', remarks: '' });
  const gridCols = isMobile ? '1fr' : '2fr 1fr 1.5fr 2fr auto';

  const submit = async () => {
    if (!draft.income_type) return toast.error('Select income type');
    if (!draft.annual_amount) return toast.error('Enter annual amount');
    const ok = await onSubmit(draft);
    if (ok) setDraft({ income_type: '', annual_amount: '', supporting_doc_type: 'CA Certificate', remarks: '' });
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="add-entry-form"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div className="add-entry-row" style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>INCOME TYPE *</label>
                <select className="form-control" value={draft.income_type} onChange={e => setDraft({ ...draft, income_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {incomeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ANNUAL AMOUNT (₹) *</label>
                <input type="number" className="form-control" placeholder="e.g. 840000" value={draft.annual_amount} onChange={e => setDraft({ ...draft, annual_amount: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SUPPORTING DOC</label>
                <select className="form-control" value={draft.supporting_doc_type} onChange={e => setDraft({ ...draft, supporting_doc_type: e.target.value })}>
                  {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>REMARKS</label>
                <input className="form-control" placeholder="Optional note" value={draft.remarks} onChange={e => setDraft({ ...draft, remarks: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ whiteSpace: 'nowrap', height: 38 }}>
                {saving ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// One block per applicant on the case, reusing the exact same two tables
// (API Pulls, Manual Entries) the page always had — just repeated once per
// applicant instead of shown once for the whole case. Income used to be a
// single blended figure (the primary/business's own API-pulled numbers,
// with every applicant's manual entries mixed into one flat table
// distinguished only by a text label column); a co-applicant's own salary/
// GST/ITR/bank data had no place to show up at all. `data.applicants`
// (income.service.js#getIncomeSummary) already scopes every figure to the
// one applicant it actually belongs to — this renders that per applicant.
const ApplicantIncomeBlock = ({ app, isMobile, delay, onDelete, onAdd, incomeTypes, saving }) => {
  const [adding, setAdding] = useState(false);
  const isSalariedApp = String(app.employment_type || '').toUpperCase() === 'SALARIED';

  const apiRows = isSalariedApp
    ? [{
        label: 'Salary (Annual)', latest: app.salary?.latest, prev: null,
        source: app.salary?.source === 'OCR' ? 'Salary OCR' : (app.salary?.source === 'MANUAL' ? 'Manual' : '—'),
        color: 'var(--success)', bg: 'var(--success-bg)'
      }]
    : [
        { label: 'Gross Turnover / Receipts', latest: app.gst_turnover?.latest, prev: app.gst_turnover?.prev, source: 'GST', color: 'var(--info)', bg: 'var(--info-bg)' },
        { label: 'Net Profit (PAT)', latest: app.net_profit?.latest, prev: app.net_profit?.prev, source: 'ITR', color: 'var(--success)', bg: 'var(--success-bg)' },
        { label: 'Average Monthly Bank Balance', latest: app.avg_bank_balance?.latest, prev: app.avg_bank_balance?.prev, source: 'Bank Stmt', color: 'var(--warning)', bg: 'var(--warning-bg)' }
      ];

  const fyLatestLabel = app.gst_turnover?.fy_latest || app.net_profit?.fy_latest || app.avg_bank_balance?.fy_latest || 'Latest Year';
  const fyPrevLabel   = app.gst_turnover?.fy_prev   || app.net_profit?.fy_prev   || app.avg_bank_balance?.fy_prev   || 'Previous Year';

  const manualEntries = app.manual_entries || [];

  return (
    <Panel
      icon={app.type === 'PRIMARY' ? User : Users}
      accentColor={app.type === 'PRIMARY' ? 'var(--success)' : 'var(--info)'}
      title={app.name}
      subtitle={`${app.type === 'PRIMARY' ? 'Primary Applicant' : 'Co-Applicant'} · ${isSalariedApp ? 'Salaried' : 'Self-Employed'}`}
      bodyPadding={0}
      delay={delay}
      className="mb-24"
      style={{ marginBottom: 24 }}
      headerRight={
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(v => !v)}>
          <PlusCircle size={14} /> {adding ? 'Cancel' : 'Add Entry'}
        </button>
      }
    >
      {/* Income from API Pulls — same table as before, this applicant's own rows only. */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {apiRows.map((row, i) => (
              <div key={i} style={{ padding: '14px 12px', borderBottom: i < apiRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{row.label}</span>
                  <span style={{ background: row.bg, color: row.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{row.source}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Latest Year ({fyLatestLabel})</span>
                  <strong style={{ color: row.latest ? 'var(--success)' : 'var(--text-tertiary)' }}>{fmt(row.latest)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Previous Year ({fyPrevLabel})</span>
                  <strong>{fmt(row.prev)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Item', `Latest Year (${fyLatestLabel})`, `Previous Year (${fyPrevLabel})`, 'Source'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: row.latest ? 'var(--success)' : 'var(--text-tertiary)' }}>{fmt(row.latest)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fmt(row.prev)}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: row.bg, color: row.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{row.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddEntryInlineForm
        show={adding}
        incomeTypes={incomeTypes}
        saving={saving}
        isMobile={isMobile}
        onSubmit={async (draft) => {
          const ok = await onAdd(app.applicant_id, draft);
          if (ok) setAdding(false);
          return ok;
        }}
      />

      {/* Manual Income Addition — same table as before, this applicant's own entries only. */}
      {manualEntries.length > 0 ? (
        isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence initial={false}>
              {manualEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: '14px 12px', borderBottom: i < manualEntries.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{entry.income_type}</span>
                    <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, flexShrink: 0 }} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Annual Amount</span>
                    <strong style={{ color: 'var(--success)' }}>{fmt(entry.annual_amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: entry.remarks ? 4 : 0 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Supporting Doc</span>
                    <span>{entry.supporting_doc_type || '—'}</span>
                  </div>
                  {entry.remarks && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{entry.remarks}</div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Income Type', 'Annual Amount', 'Supporting Doc', 'Remarks', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {manualEntries.map(entry => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{entry.income_type}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--success)' }}>{fmt(entry.annual_amount)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{entry.supporting_doc_type || '—'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>{entry.remarks || '—'}</td>
                      <td style={{ padding: '8px 16px' }}>
                        <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No manual entries yet for {app.name}.
        </div>
      )}

      {manualEntries.length > 0 && (
        <div className="manual-total-row" style={{ padding: '12px 24px', background: 'var(--success-bg)', borderTop: '1px solid var(--success)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
            Manual Income Total: {fmt(app.manual_total)}
          </span>
        </div>
      )}
    </Panel>
  );
};


// Step 4 of the case journey — rendered inline by AddCustomerWizardPage
// (not its own route), so it takes caseId/onNext as props instead of
// reading useParams()/navigating itself.
export default function IncomeSummaryPage({ caseId, onNext, isSalaried = false }) {
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await caseService.getIncomeSummary(caseId);
      setData(summary);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load income summary');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  // Each applicant block (and the Entity-Level block) has its own Add Entry
  // control now — applicant_id is implicit (whichever block called this, or
  // null for Entity Level) instead of a shared dropdown. Returns whether it
  // succeeded so the calling block knows whether to close its own form.
  const handleAddEntryForApplicant = async (applicantId, draft) => {
    try {
      setSaving(true);
      await caseService.addIncomeEntry(caseId, {
        income_type: draft.income_type,
        applicant_id: applicantId,
        annual_amount: parseFloat(draft.annual_amount),
        supporting_doc_type: draft.supporting_doc_type,
        remarks: draft.remarks
      });
      toast.success('Entry added');
      await load();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add entry');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    try {
      await caseService.deleteIncomeEntry(caseId, entryId);
      toast.success('Entry removed');
      await load();
    } catch (e) {
      toast.error('Failed to remove entry');
    }
  };

  const handleNext = async () => {
    try {
      setSaving(true);
      await caseService.confirmIncomeSummary(caseId);
      onNext();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to confirm');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    // Sharp corners set inline here, not via the page's own scoped
    // `.income-summary-page .card { border-radius: 0 }` <style> block below
    // — that block only exists in the loaded return, so a cold first load
    // briefly rendered these with the global .card class's default rounded
    // corners (var(--radius-lg)) instead. Matches BureauObligationsPage's
    // loading skeleton, which has the same fix for the same reason.
    return (
      <div className="income-summary-page">
        <div className="card mb-24" style={{ marginBottom: 24, borderRadius: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width={200} height={15} />
          </div>
          <div style={{ padding: 0 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ padding: '14px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                <Skeleton width={140} height={13} />
                <Skeleton width={90} height={13} style={{ marginLeft: 'auto' }} />
                <Skeleton width={90} height={13} />
                <Skeleton width={60} height={20} />
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width={160} height={15} />
          </div>
          <div style={{ padding: 16 }}>
            <Skeleton height={40} style={{ marginBottom: 10 }} />
            <Skeleton height={40} />
          </div>
        </div>
      </div>
    );
  }

  const combined = data?.combined_annual_income || 0;

  const incomeTypes = isSalaried ? INCOME_TYPES_SALARIED : INCOME_TYPES_MSME;

  return (
    <div className="income-summary-page">
      <style>{`
        .income-summary-page .card,
        .income-summary-page .btn,
        .income-summary-page .form-control { border-radius: 0 !important; }
        /* Dark mode: the shared grey text tokens read too low-contrast on
           this data-heavy page — bump them to white here specifically,
           without touching the global theme. */
        :root.dark .income-summary-page {
          --text-secondary: #ffffff;
          --text-tertiary: #ffffff;
        }
        /* Light mode: same low-contrast grey complaint — use black instead. */
        :root:not(.dark) .income-summary-page {
          --text-secondary: #000000;
          --text-tertiary: #000000;
        }
        /* One card per applicant now (was one card total) — the same
           padding/row-height that felt right for a single table reads as
           bloated repeated N times, so this page overrides it tighter than
           Panel's own defaults everywhere, not just on mobile. The
           !important on each rule beats the inline styles the table
           cells/header set directly. */
        .income-summary-page .card.mb-24 { margin-bottom: 14px !important; }
        .income-summary-page .card > div:first-child { padding: 12px 16px !important; }
        .income-summary-page table th,
        .income-summary-page table td { padding: 7px 12px !important; }
        .income-summary-page table th { font-size: 11px !important; }
        .income-summary-page table td { font-size: 12px !important; }
        .income-summary-page .add-entry-row { padding: 14px !important; }
        .income-summary-page .manual-total-row { padding: 8px 16px !important; }
        @media (max-width: 768px) {
          /* Matches the JS isMobile breakpoint (also 768px) that switches
             tables to stacked cards below. */
          .income-summary-page .card > div:first-child { padding: 12px !important; }
          .income-summary-page .add-entry-row { padding: 12px !important; }
          .income-summary-page .manual-total-row { padding: 8px 12px !important; }
        }
      `}</style>

      {/* One block per applicant — each shows only that applicant's own
          income (salary for a salaried applicant, GST/ITR/bank for a
          self-employed one) plus their own manual entries, instead of one
          blended entity-level table that only ever reflected the primary. */}
      {(data?.applicants || []).map((app, i) => (
        <ApplicantIncomeBlock
          key={app.applicant_id}
          app={app}
          isMobile={isMobile}
          delay={i * 0.05}
          onDelete={handleDelete}
          onAdd={handleAddEntryForApplicant}
          incomeTypes={incomeTypes}
          saving={saving}
        />
      ))}

      {/* Combined ESR income — the actual eligibility input, computed
          case-wide from every applicant's income together (not a simple
          sum of the per-applicant figures above — see
          income.service.js#getIncomeSummary for the real dedup rules). */}
      <div style={{ padding: '14px 20px', marginBottom: 24, background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
          Combined ESR Income: {fmt(combined)}
        </span>
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleNext}
          disabled={saving}
          style={{ padding: '14px 36px', width: isMobile ? '100%' : undefined, justifyContent: 'center' }}
        >
          {saving ? 'Saving...' : <>Next: Bureau Details <ChevronRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}
