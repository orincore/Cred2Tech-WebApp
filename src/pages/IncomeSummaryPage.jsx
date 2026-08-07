import React, { useState, useEffect, useCallback } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '../components/ui/Skeleton';
import Panel from '../components/ui/Panel';
import { PlusCircle, Trash2, ChevronRight, BarChart3, PenLine } from 'lucide-react';

const INCOME_TYPES_MSME = [
  'Director Salary', "Partner's Salary", 'Interest on Capital',
  'Rental Income — Bank', 'Rental Income — Cash', 'Interest Income',
  'Dividend Income', 'Agriculture Income', 'Professional Fees', 'Other'
];
// A salaried employee has no business/directorial income concepts — swap
// those out for a plain Salary/Bonus entry instead.
const INCOME_TYPES_SALARIED = [
  'Salary', 'Bonus / Incentive', 'Rental Income — Bank', 'Rental Income — Cash',
  'Interest Income', 'Dividend Income', 'Other'
];
const DOC_TYPES = ['CA Certificate', 'Salary Slip', 'Form 16', 'Bank Credit', 'None'];

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

// Step 4 of the case journey — rendered inline by AddCustomerWizardPage
// (not its own route), so it takes caseId/onNext as props instead of
// reading useParams()/navigating itself.
export default function IncomeSummaryPage({ caseId, onNext, isSalaried = false }) {
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [newEntry, setNewEntry] = useState({
    income_type: '', applicant_id: '', applicant_label: '',
    annual_amount: '', supporting_doc_type: 'CA Certificate', remarks: ''
  });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [summary, caseData] = await Promise.all([
        caseService.getIncomeSummary(caseId),
        caseService.getCaseById(caseId)
      ]);
      setData(summary);
      setApplicants(caseData.applicants || []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load income summary');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAddEntry = async () => {
    if (!newEntry.income_type) return toast.error('Select income type');
    if (!newEntry.annual_amount) return toast.error('Enter annual amount');
    try {
      setSaving(true);
      const entry = {
        ...newEntry,
        applicant_id: newEntry.applicant_id || null,
        annual_amount: parseFloat(newEntry.annual_amount)
      };
      await caseService.addIncomeEntry(caseId, entry);
      toast.success('Entry added');
      setNewEntry({ income_type: '', applicant_id: '', applicant_label: '', annual_amount: '', supporting_doc_type: 'CA Certificate', remarks: '' });
      setAdding(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add entry');
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
    return (
      <div className="income-summary-page">
        <div className="card mb-24" style={{ marginBottom: 24 }}>
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
        <div className="card">
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

  const api = data?.api_data || {};
  const manualTotal = data?.manual_total || 0;
  const combined = data?.combined_annual_income || 0;

  // Derive FY labels from whichever source has them, with fallback defaults
  const fyLatestLabel = api.gst_turnover?.fy_latest || api.net_profit?.fy_latest || api.avg_bank_balance?.fy_latest || 'Latest Year';
  const fyPrevLabel   = api.gst_turnover?.fy_prev   || api.net_profit?.fy_prev   || api.avg_bank_balance?.fy_prev   || 'Previous Year';

  const incomeTypes = isSalaried ? INCOME_TYPES_SALARIED : INCOME_TYPES_MSME;

  const addEntryGridCols = isMobile ? '1fr' : '2fr 1.5fr 1fr 1.5fr 2fr auto';

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
        @media (max-width: 768px) {
          /* Matches the JS isMobile breakpoint (also 768px) that switches
             tables to stacked cards below — Panel header/body padding is
             fixed for desktop, so tighten it here too for the phone view. */
          .income-summary-page .card > div:first-child { padding: 14px 12px !important; }
          .income-summary-page .add-entry-row { padding: 14px 12px !important; }
          .income-summary-page .manual-total-row { padding: 10px 12px !important; }
        }
      `}</style>

      {/* API-Pulled Income Table — GST/ITR/Bank are self-employed/business
          concepts; a salaried employee's only income source is their salary,
          which is captured entirely via the salary-slip OCR step + Manual
          Income Addition below, so this panel doesn't apply to them at all. */}
      {!isSalaried && (
      <Panel
        icon={BarChart3}
        accentColor="var(--success)"
        title="Income from API Pulls"
        bodyPadding={0}
        delay={0}
        className="mb-24"
        style={{ marginBottom: 24 }}
      >
        {(() => {
          const rows = [
            { label: 'Gross Turnover / Receipts', latest: api.gst_turnover?.latest, prev: api.gst_turnover?.prev, source: 'GST', color: 'var(--info)', bg: 'var(--info-bg)' },
            { label: 'Net Profit (PAT)', latest: api.net_profit?.latest, prev: api.net_profit?.prev, source: 'ITR', color: 'var(--success)', bg: 'var(--success-bg)' },
            { label: 'Average Monthly Bank Balance', latest: api.avg_bank_balance?.latest, prev: api.avg_bank_balance?.prev, source: 'Bank Stmt', color: 'var(--warning)', bg: 'var(--warning-bg)' }
          ];
          // Phones get stacked label/value cards instead of a table — a table
          // that "fits" a phone by shrinking columns just becomes unreadable,
          // and one that scrolls sideways is easy to miss/mistake as cut off.
          if (isMobile) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((row, i) => (
                  <div key={i} style={{ padding: '14px 12px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
            );
          }
          return (
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
                  {rows.map((row, i) => (
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
          );
        })()}
      </Panel>
      )}

      {/* Manual Income Addition */}
      <Panel
        icon={PenLine}
        title="Manual Income Addition"
        subtitle={isSalaried
          ? 'Add income not captured via OCR — additional salary, bonus, rental, other'
          : 'Add income not captured via API — Director salary, rental, agriculture, other'}
        bodyPadding={0}
        delay={0.08}
        style={{ marginBottom: 24 }}
        headerRight={
          <button className="btn btn-secondary btn-sm" onClick={() => setAdding(v => !v)}>
            <PlusCircle size={14} /> {adding ? 'Cancel' : 'Add Entry'}
          </button>
        }
      >
        {/* Add new entry inline form */}
        <AnimatePresence initial={false}>
          {adding && (
            <motion.div
              key="add-entry-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="add-entry-row" style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: addEntryGridCols, gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>INCOME TYPE *</label>
                    <select className="form-control" value={newEntry.income_type} onChange={e => setNewEntry({ ...newEntry, income_type: e.target.value })}>
                      <option value="">— Select —</option>
                      {incomeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>APPLICANT</label>
                    <select className="form-control" value={newEntry.applicant_id} onChange={e => {
                      const app = applicants.find(a => a.id === parseInt(e.target.value));
                      setNewEntry({ ...newEntry, applicant_id: e.target.value, applicant_label: app ? (app.name || app.pan_number || app.type) : '' });
                    }}>
                      <option value="">Entity Level</option>
                      {applicants.map(a => <option key={a.id} value={a.id}>{a.name || a.pan_number || a.type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ANNUAL AMOUNT (₹) *</label>
                    <input type="number" className="form-control" placeholder="e.g. 840000" value={newEntry.annual_amount} onChange={e => setNewEntry({ ...newEntry, annual_amount: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SUPPORTING DOC</label>
                    <select className="form-control" value={newEntry.supporting_doc_type} onChange={e => setNewEntry({ ...newEntry, supporting_doc_type: e.target.value })}>
                      {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>REMARKS</label>
                    <input className="form-control" placeholder="Optional note" value={newEntry.remarks} onChange={e => setNewEntry({ ...newEntry, remarks: e.target.value })} />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddEntry} disabled={saving} style={{ whiteSpace: 'nowrap', height: 38 }}>
                    {saving ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing entries */}
        {data?.manual_entries?.length > 0 ? (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <AnimatePresence initial={false}>
                {data.manual_entries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '14px 12px', borderBottom: i < data.manual_entries.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{entry.income_type}</span>
                      <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, flexShrink: 0 }} title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{entry.applicant_label || 'Entity'}</div>
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
                  {['Income Type', 'Applicant', 'Annual Amount', 'Supporting Doc', 'Remarks', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {data.manual_entries.map(entry => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{entry.income_type}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{entry.applicant_label || 'Entity'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--success)' }}>{fmt(entry.annual_amount)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{entry.supporting_doc_type || '—'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>{entry.remarks || '—'}</td>
                      <td style={{ padding: '8px 16px' }}>
                        <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }} title="Remove">
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
        ) : !adding ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No manual entries yet. Click <strong>Add Entry</strong> to record {isSalaried ? 'additional salary, bonus, rental income, etc.' : 'Director salary, rental income, etc.'}
          </div>
        ) : null}

        {/* Manual total footer */}
        {data?.manual_entries?.length > 0 && (
          <div className="manual-total-row" style={{ padding: '12px 24px', background: 'var(--success-bg)', borderTop: '1px solid var(--success)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
              Manual Income Total: {fmt(manualTotal)} &nbsp;·&nbsp; Combined ESR Income: {fmt(combined)}
            </span>
          </div>
        )}
      </Panel>

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
