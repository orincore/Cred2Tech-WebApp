import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { PlusCircle, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';

const INCOME_TYPES = [
  'Director Salary', "Partner's Salary", 'Interest on Capital',
  'Rental Income — Bank', 'Rental Income — Cash', 'Interest Income',
  'Dividend Income', 'Agriculture Income', 'Professional Fees', 'Other'
];
const DOC_TYPES = ['CA Certificate', 'Salary Slip', 'Form 16', 'Bank Credit', 'None'];

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export default function IncomeSummaryPage() {
  const { id: caseId } = useParams();
  const navigate = useNavigate();

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
      navigate(`/cases/${caseId}/bureau-obligations`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to confirm');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><LoadingSpinner size={40} /></div>;

  const api = data?.api_data || {};
  const manualTotal = data?.manual_total || 0;
  const combined = data?.combined_annual_income || 0;
  const totalEmi = data?.total_emi_per_month || 0;

  // Derive FY labels from whichever source has them, with fallback defaults
  const fyLatestLabel = api.gst_turnover?.fy_latest || api.net_profit?.fy_latest || api.avg_bank_balance?.fy_latest || 'Latest Year';
  const fyPrevLabel   = api.gst_turnover?.fy_prev   || api.net_profit?.fy_prev   || api.avg_bank_balance?.fy_prev   || 'Previous Year';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Income Summary</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Review API-pulled income and add any manual entries</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/customers/add?caseId=${caseId}`)}><ChevronLeft size={16} /> Back</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={saving} style={{ padding: '10px 24px' }}>
            {saving ? 'Saving...' : <>Next: Bureau Details <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>

      {/* API-Pulled Income Table */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '3px solid var(--success)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>📊 Income from API Pulls</h3>
          <span style={{ background: '#F0FFF4', color: 'var(--success)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #9AE6B4' }}>Auto-generated</span>
        </div>
        <div style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Item', `Latest Year (${fyLatestLabel})`, `Previous Year (${fyPrevLabel})`, 'Source'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Gross Turnover / Receipts', latest: api.gst_turnover?.latest, prev: api.gst_turnover?.prev, source: 'GST', color: '#2B6CB0', bg: '#EBF8FF' },
                { label: 'Net Profit (PAT)', latest: api.net_profit?.latest, prev: api.net_profit?.prev, source: 'ITR', color: '#276749', bg: '#F0FFF4' },
                { label: 'Average Monthly Bank Balance', latest: api.avg_bank_balance?.latest, prev: api.avg_bank_balance?.prev, source: 'Bank Stmt', color: '#744210', bg: '#FFFBF0' }
              ].map((row, i) => (
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
        {/* Footer strip */}
        <div style={{ padding: '14px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', display: 'flex', gap: 40 }}>
          {[
            { label: 'Net Profit (Latest Year)', value: fmt(api.net_profit?.latest), color: 'var(--success)' },
            { label: 'Avg Monthly Bank Balance', value: fmt(api.avg_bank_balance?.latest), color: 'var(--text-primary)' },
            { label: 'Combined EMI Obligations', value: fmt(totalEmi), color: 'var(--error)' }
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Income Addition */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>✏️ Manual Income Addition</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Add income not captured via API — Director salary, rental, agriculture, other</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setAdding(v => !v)}>
            <PlusCircle size={14} /> {adding ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>

        {/* Add new entry inline form */}
        {adding && (
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 2fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>INCOME TYPE *</label>
                <select className="form-control" value={newEntry.income_type} onChange={e => setNewEntry({ ...newEntry, income_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
        )}

        {/* Existing entries table */}
        {data?.manual_entries?.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Income Type', 'Applicant', 'Annual Amount', 'Supporting Doc', 'Remarks', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.manual_entries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !adding ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No manual entries yet. Click <strong>+ Add Entry</strong> to record Director salary, rental income, etc.
          </div>
        ) : null}

        {/* Manual total footer */}
        {data?.manual_entries?.length > 0 && (
          <div style={{ padding: '12px 24px', background: '#F0FFF4', borderTop: '1px solid #9AE6B4' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
              Manual Income Total: {fmt(manualTotal)} &nbsp;·&nbsp; Combined ESR Income: {fmt(combined)}
            </span>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={saving} style={{ padding: '14px 36px' }}>
          {saving ? 'Saving...' : 'Next: Bureau Details →'}
        </button>
      </div>
    </div>
  );
}
