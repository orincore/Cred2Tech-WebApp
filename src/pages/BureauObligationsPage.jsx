import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CaseWizardStepper from '../components/ui/CaseWizardStepper';
import Panel from '../components/ui/Panel';
import MetricTile from '../components/ui/MetricTile';
import { PlusCircle, ChevronLeft, Zap, AlertTriangle, BarChart3, CheckCircle2, PenLine, X } from 'lucide-react';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const getCibilColor = (score) => {
  if (!score) return 'var(--text-tertiary)';
  if (score >= 750) return 'var(--success)';
  if (score >= 700) return 'var(--warning)';
  return 'var(--error)';
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

const LOAN_TYPES = [
  'Home Loan', 'Car Loan', 'Business Loan', 'Personal Loan',
  'Two-Wheeler Loan', 'Education Loan', 'Gold Loan', 'Credit Card', 'Other'
];

export default function BureauObligationsPage() {
  const { id: caseId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData]           = useState(null);
  const [editEmi, setEditEmi]     = useState({});         // { [oblId]: value }
  const [addingFor, setAddingFor] = useState(null);        // applicant_id
  const [newObl, setNewObl]       = useState({ lender_name: '', loan_type: '', loan_amount: '', outstanding_amount: '', emi_per_month: '', remarks: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      await caseService.syncObligations(caseId);
      const result = await caseService.getObligations(caseId);
      setData(result);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load bureau obligations');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleEmiBlur = async (oblId, val) => {
    if (val === undefined || val === null) return;
    try {
      await caseService.updateObligation(caseId, oblId, { emi_per_month: parseFloat(val) || 0 });
      await load();
    } catch (e) {
      toast.error('Failed to update EMI');
    }
  };

  const handleAddObligation = async (applicant_id) => {
    if (!newObl.emi_per_month && newObl.emi_per_month !== 0) return toast.error('EMI per month is required');
    try {
      setSaving(true);
      await caseService.addObligation(caseId, { ...newObl, applicant_id });
      toast.success('Obligation added');
      setAddingFor(null);
      setNewObl({ lender_name: '', loan_type: '', loan_amount: '', outstanding_amount: '', emi_per_month: '', remarks: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add obligation');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateESR = async () => {
    try {
      setGenerating(true);
      await caseService.generateESR(caseId);
      toast.success('Eligibility Report generated!');
      navigate(`/cases/${caseId}/esr`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate ESR');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><LoadingSpinner size={40} /></div>;

  const { grouped = [], summary = {} } = data || {};
  const allCibils = grouped.map(g => g.applicant.cibil_score).filter(Boolean);
  const lowestCibil = allCibils.length ? Math.min(...allCibils) : null;
  const addLoanGridCols = isMobile ? '1fr' : '2fr 1.5fr 1fr 1fr 1fr auto';

  return (
    <div className="bureau-obligations-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', maxWidth: 980, margin: '0 auto', padding: '0 20px 60px' }}>
      <style>{`
        .bureau-obligations-page .card,
        .bureau-obligations-page .btn,
        .bureau-obligations-page .form-control { border-radius: 0 !important; }
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24, marginBottom: 24, flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Bureau & Credit Obligations</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Step 5 of 7 — Review all applicant obligations before generating ESR</p>
        </div>
      </motion.div>
      <CaseWizardStepper currentStep={5} caseId={caseId} />

      {/* Info box */}
      <div style={{ padding: '14px 18px', background: '#FFFBF0', border: '1px solid #F6E05E', borderRadius: 0, marginBottom: 20, fontSize: 13, color: '#744210', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span><strong>Review all EMIs carefully.</strong> Obligations directly affect eligibility. Click the EMI field to edit if bureau data is inaccurate. Use <strong>+ Add Loan</strong> to include any obligation not showing in the bureau report.</span>
      </div>

      {/* Per-applicant cards */}
      {grouped.map(({ applicant, obligations: allObligations, total_emi, active_count }, idx) => {
        const obligations = allObligations.filter(o => Number(o.outstanding_amount) > 0);
        return (
        <Panel key={applicant.id} bodyPadding={0} delay={idx * 0.08} style={{ marginBottom: 20 }}>
          {/* Applicant header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: applicant.type === 'PRIMARY' ? 'linear-gradient(135deg,#F0FFF4,transparent)' : 'linear-gradient(135deg,#EBF8FF,transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: applicant.type === 'PRIMARY' ? 'linear-gradient(135deg,#F6AD55,#E53E3E)' : 'linear-gradient(135deg,#3182CE,#63B3ED)', color: 'white', fontWeight: 700, fontSize: 15 }}>
                {(applicant.name || applicant.pan_number || 'AP').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{applicant.name || (applicant.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant')}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{applicant.pan_number} · {applicant.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower'}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: getCibilColor(applicant.cibil_score) }}>{applicant.cibil_score || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CIBIL Score</div>
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ padding: '10px 24px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 32 }}>
            <MetricTile label="Total EMI/mo" value={fmt(total_emi)} color="var(--error)" size="sm" />
            <MetricTile label="Active Loans" value={active_count} color="var(--text-primary)" size="sm" />
          </div>

          {/* Obligations table */}
          {obligations.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? 640 : '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Lender', 'Type', 'Loan Amount', 'Outstanding', 'Start', 'EMI / Month', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {obligations.map(obl => (
                    <tr key={obl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{obl.lender_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{obl.loan_type || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{fmt(obl.loan_amount)}</td>
                      <td style={{ padding: '12px 14px' }}>{fmt(obl.outstanding_amount)}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-tertiary)' }}>{obl.loan_start_date ? new Date(obl.loan_start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            style={{ width: 90, padding: '5px 8px', border: obl.needs_verification ? '1.5px solid var(--warning)' : '1.5px solid var(--border)', borderRadius: 0, fontSize: 13, fontWeight: 600, color: obl.needs_verification ? 'var(--warning)' : undefined }}
                            value={editEmi[obl.id] !== undefined ? editEmi[obl.id] : obl.emi_per_month}
                            onChange={e => setEditEmi({ ...editEmi, [obl.id]: e.target.value })}
                            onBlur={e => { handleEmiBlur(obl.id, e.target.value); setEditEmi(prev => { const n = { ...prev }; delete n[obl.id]; return n; }); }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: obl.needs_verification ? '#FEFCBF' : '#F0FFF4',
                          color: obl.needs_verification ? '#744210' : 'var(--success)',
                          border: `1px solid ${obl.needs_verification ? '#F6E05E' : '#9AE6B4'}`,
                          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                        }}>
                          {obl.needs_verification ? <AlertTriangle size={11} /> : obl.source === 'MANUAL' ? <PenLine size={11} /> : <CheckCircle2 size={11} />}
                          {obl.needs_verification ? 'Verify' : (obl.source === 'MANUAL' ? 'Manual' : 'Active')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '20px 24px', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No bureau obligations found for this applicant.
            </div>
          )}

          {/* Add loan row */}
          <AnimatePresence initial={false} mode="wait">
            {addingFor === applicant.id ? (
              <motion.div
                key="add-loan-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: addLoanGridCols, gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>LENDER</label>
                      <input className="form-control" placeholder="Bank / NBFC name" value={newObl.lender_name} onChange={e => setNewObl({ ...newObl, lender_name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>LOAN TYPE</label>
                      <select className="form-control" value={newObl.loan_type} onChange={e => setNewObl({ ...newObl, loan_type: e.target.value })}>
                        <option value="">— Type —</option>
                        {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>LOAN AMT (₹)</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.loan_amount} onChange={e => setNewObl({ ...newObl, loan_amount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>OUTSTANDING</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.outstanding_amount} onChange={e => setNewObl({ ...newObl, outstanding_amount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>EMI/MONTH *</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.emi_per_month} onChange={e => setNewObl({ ...newObl, emi_per_month: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAddObligation(applicant.id)} disabled={saving}>Add</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAddingFor(null)}><X size={14} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="add-loan-trigger" style={{ padding: '10px 24px', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingFor(applicant.id)}>
                  <PlusCircle size={13} /> Add Loan Not in Bureau
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
        );
      })}

      {/* Total Obligation Summary */}
      <Panel
        icon={BarChart3}
        accentColor="var(--warning)"
        title="Total Obligation Summary"
        delay={grouped.length * 0.08}
        style={{ marginBottom: 24, border: '2px solid var(--warning)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
          <MetricTile boxed size="lg" label="Primary Borrower EMI" value={fmt(grouped.find(g => g.applicant.type === 'PRIMARY')?.total_emi)} color="var(--error)" delay={0.05} />
          <MetricTile boxed size="lg" label="Co-Borrower EMIs" value={fmt(grouped.filter(g => g.applicant.type !== 'PRIMARY').reduce((s, g) => s + g.total_emi, 0))} color="var(--error)" delay={0.1} />
          <MetricTile boxed size="lg" highlight label="Combined Monthly Obligation" value={fmt(summary.combined_emi_per_month)} color="var(--warning)" delay={0.15} />
          <MetricTile boxed size="lg" label="Lowest CIBIL Score" value={lowestCibil || '—'} color={getCibilColor(lowestCibil)} delay={0.2} />
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 0, fontSize: 12, color: 'var(--primary-dark)' }}>
          Shared loans (appearing across multiple applicants) are counted once. Edit EMI values above if bureau data differs from actual.
        </div>
      </Panel>

      {/* Bottom nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/cases/${caseId}/income-summary`)}><ChevronLeft size={16} /> Back</button>
        <button className="btn btn-primary btn-lg" onClick={handleGenerateESR} disabled={generating} style={{ padding: '14px 36px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} />
          {generating ? 'Generating ESR...' : 'Generate Eligibility Summary Report'}
        </button>
      </div>
    </div>
  );
}
