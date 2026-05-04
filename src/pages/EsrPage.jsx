import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CheckCircle, XCircle, RefreshCw, ChevronLeft, Calculator,
         Send, Clock, CheckCircle2, AlertCircle, X, Mail, Phone } from 'lucide-react';
import { sendCaseToLender, sendCaseToOtherLender, getTenantLenders } from '../api/tenantLenderService';

// ─── Send Confirmation Modal ───────────────────────────────────────────────────
function SendConfirmationModal({ isOpen, onClose, result }) {
  if (!isOpen || !result) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--bg-primary)', width:'94%', maxWidth:520, borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ background:'linear-gradient(135deg,#F0FFF4,#EBF8FF)', padding:'24px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:44, marginBottom:8 }}>✅</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:'#276749', margin:0 }}>Lead Successfully Sent!</h3>
          <p style={{ color:'#4A5568', fontSize:13, marginTop:6 }}>The proposal has been dispatched to the lender contact.</p>
        </div>
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Email preview */}
          <div style={{ border:'1px solid #BEE3F8', borderRadius:10, overflow:'hidden' }}>
            <div style={{ background:'#EBF8FF', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
              <Mail size={14} color='#2B6CB0' />
              <span style={{ fontSize:12, fontWeight:700, color:'#2B6CB0' }}>EMAIL SENT</span>
            </div>
            <div style={{ padding:'12px 16px', fontSize:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--text-tertiary)' }}>To:</span>
                <span style={{ fontWeight:600 }}>{result.to}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--text-tertiary)' }}>Contact:</span>
                <span style={{ fontWeight:600 }}>{result.contact_name}</span>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', background:'var(--bg-elevated)', borderRadius:6, fontSize:11, color:'var(--text-secondary)', lineHeight:1.6 }}>
                <strong style={{ display:'block', marginBottom:4 }}>Subject:</strong>
                {result.subject}
              </div>
              <div style={{ marginTop:6, padding:'8px 10px', background:'var(--bg-elevated)', borderRadius:6, fontSize:11, color:'var(--text-secondary)', lineHeight:1.6, maxHeight:80, overflow:'hidden' }}>
                {(result.body_preview || '').slice(0, 200)}…
              </div>
            </div>
          </div>
          {/* SMS preview */}
          {result.sms?.smsSent && (
            <div style={{ border:'1px solid #C6F6D5', borderRadius:10, overflow:'hidden' }}>
              <div style={{ background:'#F0FFF4', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
                <Phone size={14} color='#276749' />
                <span style={{ fontSize:12, fontWeight:700, color:'#276749' }}>SMS SENT</span>
              </div>
              <div style={{ padding:'12px 16px', fontSize:12 }}>
                <div style={{ marginBottom:4 }}>Sent to: <strong>{result.sms.to}</strong></div>
                <div style={{ padding:'8px 10px', background:'var(--bg-elevated)', borderRadius:6, fontSize:11, lineHeight:1.6 }}>{result.sms.message}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 22px', borderRadius:8, fontWeight:700, fontSize:14, background:'var(--primary)', color:'#fff', border:'none', cursor:'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Send to Other Lender Modal ───────────────────────────────────────────────
function SendToOtherLenderModal({ isOpen, onClose, caseId, onSuccess }) {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSelectedLender(null); setSelectedContact(null);
      getTenantLenders().then(d => setLenders(d.filter(l => l.is_active && l.contacts?.length > 0))).catch(() => toast.error('Failed to load lenders')).finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedContact) { toast.error('Select a contact first'); return; }
    setSending(true);
    try {
      const result = await sendCaseToOtherLender(caseId, { contact_id: selectedContact.id });
      onSuccess(result);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send');
    } finally { setSending(false); }
  };

  const contacts = selectedLender?.contacts || [];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--bg-primary)', width:'94%', maxWidth:480, borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>Send to Other Lender</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)' }}><X size={18} /></button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          {loading ? <div style={{ textAlign:'center', padding:30 }}><LoadingSpinner size={30} /></div> : lenders.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'var(--text-tertiary)' }}>
              No configured lenders found. <a href='/settings/lender-contacts' style={{ color:'var(--primary)' }}>Add contacts →</a>
            </div>
          ) : (
            <>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:8 }}>Select Lender</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {lenders.map(l => (
                    <button key={l.id} onClick={() => { setSelectedLender(l); setSelectedContact(null); }}
                      style={{ padding:'10px 14px', borderRadius:8, textAlign:'left', cursor:'pointer', fontSize:14, fontWeight:600,
                        border:`2px solid ${selectedLender?.id === l.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedLender?.id === l.id ? '#EEF2FF' : 'var(--bg-elevated)', color:'var(--text-primary)' }}>
                      🏦 {l.lender_name} <span style={{ fontSize:11, fontWeight:400, color:'var(--text-tertiary)' }}>· {l.contacts.length} contact(s)</span>
                    </button>
                  ))}
                </div>
              </div>
              {selectedLender && contacts.length > 0 && (
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:8 }}>Select Contact</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {contacts.map(c => (
                      <button key={c.id} onClick={() => setSelectedContact(c)}
                        style={{ padding:'10px 14px', borderRadius:8, textAlign:'left', cursor:'pointer', fontSize:13,
                          border:`2px solid ${selectedContact?.id === c.id ? '#276749' : 'var(--border)'}`,
                          background: selectedContact?.id === c.id ? '#F0FFF4' : 'var(--bg-elevated)', color:'var(--text-primary)' }}>
                        <div style={{ fontWeight:600 }}>{c.contact_name} <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:400 }}>({c.product_type})</span></div>
                        <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{c.contact_email}{c.contact_mobile ? ` · ${c.contact_mobile}` : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10, background:'var(--bg-elevated)' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:600 }}>Cancel</button>
          <button onClick={handleSend} disabled={!selectedContact || sending}
            style={{ padding:'9px 20px', borderRadius:8, fontWeight:700, fontSize:14, background: selectedContact ? 'var(--primary)' : 'var(--border)', color:'#fff', border:'none', cursor: selectedContact ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', gap:6 }}>
            <Send size={14} /> {sending ? 'Sending...' : 'Send Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ─── Proposal status badge config ─────────────────────────────────────────────
const PROPOSAL_STATUS = {
  draft:              { label: 'Draft',      color: '#718096', bg: '#EDF2F7', icon: Clock },
  submitted:          { label: 'Submitted',  color: '#2B6CB0', bg: '#EBF8FF', icon: Send },
  accepted:           { label: 'Accepted',   color: '#276749', bg: '#F0FFF4', icon: CheckCircle2 },
  rejected:           { label: 'Rejected',   color: '#C53030', bg: '#FFF5F5', icon: XCircle },
  query_raised:       { label: 'Query',      color: '#C05621', bg: '#FFFBEB', icon: AlertCircle },
  resent:             { label: 'Resent',     color: '#6B46C1', bg: '#FAF5FF', icon: Send },
};

function ProposalBadge({ status }) {
  const cfg = PROPOSAL_STATUS[status] || PROPOSAL_STATUS.draft;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`
    }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

// ─── Calculation Breakdown Panel ──────────────────────────────────────────────
const CalcBreakdownPanel = ({ evaluations, monthlyIncome }) => {
  const [open, setOpen] = useState(false);
  const [activeScheme, setActiveScheme] = useState(0);
  if (!evaluations || evaluations.length === 0) return null;

  const ev = evaluations[activeScheme] || evaluations[0];

  const steps = [
    { label: 'Monthly Income Used', value: formatDynamicCurrency(monthlyIncome), icon: '💰', color: '#2B6CB0', bg: '#EBF8FF', note: 'Selected income method monthly figure' },
    { label: 'FOIR Allowed', value: fmtPct(ev.foir_allowed_percent), icon: '📊', color: '#276749', bg: '#F0FFF4', note: 'Max permissible obligation %' },
    { label: 'FOIR Actual', value: fmtPct(ev.foir_actual_percent), icon: '📉',
      color: ev.foir_actual_percent > ev.foir_allowed_percent ? '#C53030' : '#276749',
      bg: ev.foir_actual_percent > ev.foir_allowed_percent ? '#FFF5F5' : '#F0FFF4',
      note: 'Current EMI ÷ income' },
    { label: 'Max Eligible EMI', value: ev.max_eligible_emi != null ? formatDynamicCurrency(Math.max(0, ev.max_eligible_emi)) : '—', icon: '🏦', color: '#744210', bg: '#FFFBF0', note: '(FOIR% × Income) − Existing EMI' },
    { label: 'LTV Applied', value: ev.applicable_ltv_percent != null ? `${(ev.applicable_ltv_percent * 100).toFixed(0)}%` : '—', icon: '🏠', color: '#553C9A', bg: '#FAF5FF', note: `Key: ${ev.applicable_ltv_key || '—'}` },
    { label: 'Max Loan by LTV', value: ev.max_loan_by_ltv != null ? formatDynamicCurrency(ev.max_loan_by_ltv) : '—', icon: '🔢', color: '#2C7A7B', bg: '#E6FFFA', note: 'Property Value × LTV%' },
    { label: 'Final Eligible Loan', value: ev.final_eligible_loan_amount != null ? formatDynamicCurrency(ev.final_eligible_loan_amount) : '—', icon: '✅',
      color: ev.is_eligible ? '#276749' : '#C53030', bg: ev.is_eligible ? '#F0FFF4' : '#FFF5F5',
      note: ev.is_eligible ? 'Min(requested, LTV cap)' : 'Failed eligibility', highlight: true },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px',
        background: 'var(--bg-elevated)', color: 'var(--primary)', border: '1px solid var(--primary)',
        borderRadius: 6, cursor: 'pointer', fontWeight: 600
      }}>
        <Calculator size={12} />
        {open ? 'Hide Calculation ↑' : 'View Calculation ↓'}
      </button>

      {open && (
        <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {evaluations.length > 1 && (
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {evaluations.map((e, i) => (
                <button key={i} onClick={() => setActiveScheme(i)} style={{
                  flex: 1, padding: '8px 6px', fontSize: 11, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: activeScheme === i ? 'var(--primary)' : 'transparent',
                  color: activeScheme === i ? '#fff' : 'var(--text-secondary)',
                }}>
                  {e.scheme_name}
                  <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 10,
                    background: e.is_eligible ? '#9AE6B4' : '#FED7D7',
                    color: e.is_eligible ? '#22543D' : '#C53030' }}>
                    {e.is_eligible ? '✓' : '✕'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '14px 14px 8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {steps.map((step, i) => (
                <div key={i} style={{
                  background: step.bg, borderRadius: 8, padding: '10px 12px',
                  border: step.highlight ? `2px solid ${step.color}` : '1px solid transparent',
                  gridColumn: step.highlight ? 'span 2' : 'span 1',
                }}>
                  <div style={{ fontSize: 10, color: '#718096', fontWeight: 600, marginBottom: 2 }}>
                    {step.icon} {step.label}
                  </div>
                  <div style={{ fontSize: step.highlight ? 18 : 15, fontWeight: 800, color: step.color }}>
                    {step.value}
                  </div>
                  <div style={{ fontSize: 10, color: '#718096', marginTop: 4, fontStyle: 'italic' }}>
                    {step.note}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#1A202C', borderRadius: 8,
              fontSize: 10, color: '#A0AEC0', fontFamily: 'monospace', lineHeight: 1.8 }}>
              <div style={{ color: '#68D391', fontWeight: 700, marginBottom: 4 }}>📐 Calculation Trace</div>
              <div>Max EMI = Income ({formatDynamicCurrency(monthlyIncome)}) × FOIR ({fmtPct(ev.foir_allowed_percent)}) − Obligations = {ev.max_eligible_emi != null ? formatDynamicCurrency(Math.max(0, ev.max_eligible_emi)) : '—'}</div>
              <div>Max Loan LTV = {ev.max_loan_by_ltv != null ? formatDynamicCurrency(ev.max_loan_by_ltv) : '—'}</div>
              <div style={{ color: '#68D391' }}>Final = {ev.final_eligible_loan_amount != null ? formatDynamicCurrency(ev.final_eligible_loan_amount) : '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Scheme Diagnostics ───────────────────────────────────────────────────────
const SchemeDiagnosticsPanel = ({ evaluations }) => {
  const [open, setOpen] = useState(false);
  if (!evaluations || evaluations.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button className="btn btn-ghost" onClick={() => setOpen(!open)}
        style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}>
        {open ? 'Hide Diagnostics ↑' : 'View Scheme Diagnostics ↓'}
      </button>
      {open && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12 }}>
          {evaluations.map((ev, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i === evaluations.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{ev.scheme_name}</strong>
                <span style={{ color: ev.is_eligible ? 'var(--success)' : 'var(--error)' }}>
                  {ev.is_eligible ? 'Eligible' : 'Ineligible'}
                </span>
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 6 }}>
                LTV: {ev.applicable_ltv_percent ? `${(ev.applicable_ltv_percent * 100).toFixed(0)}%` : '—'} ({ev.applicable_ltv_key})
                <br />Method Matched: {ev.income_method_matched ? 'Yes' : 'No'}
              </div>
              {ev.failure_reasons?.length > 0 && (
                <ul style={{ color: 'var(--error)', paddingLeft: 16, margin: '4px 0' }}>
                  {ev.failure_reasons.map((r, ri) => <li key={ri}>{r}</li>)}
                </ul>
              )}
              {ev.warnings?.length > 0 && (
                <ul style={{ color: '#D97706', paddingLeft: 16, margin: '4px 0' }}>
                  {ev.warnings.map((w, wi) => <li key={wi}>{w}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Lender Action Button (multi-proposal aware) ───────────────────────────────
function LenderActions({ lender, caseId, proposals, onProposalCreated, onSendToLender, onSendToOtherLender }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [sending, setSending] = useState(false);

  // Find existing proposals for this lender
  const lenderProposals = proposals.filter(p => String(p.lender_id) === String(lender.lender_id));
  const latestProposal = lenderProposals[lenderProposals.length - 1] || null;

  // Find the most recent submitted proposal from any other lender for clone
  const otherSubmitted = proposals.find(p =>
    String(p.lender_id) !== String(lender.lender_id) && p.proposal_status === 'submitted'
  ) || proposals.find(p => String(p.lender_id) !== String(lender.lender_id));

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const result = await sendCaseToLender(caseId, {
        lender_name: lender.lender_name,
        product_type: lender.product_type || 'LAP',
      });
      onSendToLender(result);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to send';
      if (e.response?.data?.redirect_hint) {
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally { setSending(false); }
  };

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
        const r = await caseService.createProposal(caseId, {
          lender_id: lender.lender_id,
          scheme_id: lender.scheme_evaluations?.find(s => s.is_eligible)?.scheme_id || null,
        });
        result = r.proposal;
      }
      onProposalCreated();
      toast.success(`Proposal created: ${result.proposal_number}`);
      navigate(`/cases/${caseId}/proposals/${result.id}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create proposal');
    } finally {
      setCreating(false);
      setShowCloneDialog(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* Clone dialog */}
      {showCloneDialog && (
        <div style={{
          padding: '14px', background: '#EBF8FF', borderRadius: 8,
          border: '1px solid #BEE3F8', marginBottom: 10
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2B6CB0', marginBottom: 8 }}>
            📋 Reuse existing proposal?
          </div>
          <div style={{ fontSize: 11, color: '#4A5568', marginBottom: 10 }}>
            A proposal was already prepared (#{otherSubmitted?.proposal_number}).
            Reuse its data and documents for {lender.lender_name}?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => doCreate(otherSubmitted.id)}
              disabled={creating}
              style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 700,
                       background: '#2B6CB0', color: '#fff', border: 'none',
                       borderRadius: 6, cursor: 'pointer' }}>
              {creating ? 'Cloning...' : '✅ Yes, Clone Proposal'}
            </button>
            <button
              onClick={() => { setShowCloneDialog(false); doCreate(null); }}
              disabled={creating}
              style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                       background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                       border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
              No, Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Existing proposal badges + view button */}
      {lenderProposals.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {lenderProposals.map(p => (
            <ProposalBadge key={p.id} status={p.lender_submission_status || p.proposal_status} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {latestProposal ? (
          <>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '9px', fontWeight: 700 }}
              onClick={() => navigate(`/cases/${caseId}/proposals/${latestProposal.id}`)}
            >
              View Proposal →
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '9px 14px', fontWeight: 600, fontSize: 12 }}
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
            style={{ flex: 1, padding: '10px', fontWeight: 700,
                     background: 'linear-gradient(135deg,#2B6CB0,#553C9A)' }}
            onClick={handlePrepare}
            disabled={creating}
          >
            {creating ? 'Creating...' : '📋 Prepare Proposal →'}
          </button>
        )}
        <button
          onClick={handleSendEmail}
          disabled={sending}
          title="Send proposal email to this lender's configured contact"
          style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12, borderRadius: 8,
                   background: sending ? '#718096' : '#276749', color: '#fff', border: 'none',
                   cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Send size={13} /> {sending ? '...' : 'Send'}
        </button>
        <button
          onClick={onSendToOtherLender}
          title="Send to a different lender contact from your directory"
          style={{ padding: '9px 12px', fontWeight: 700, fontSize: 11, borderRadius: 8,
                   background: 'transparent', color: '#553C9A', border: '1px solid #553C9A',
                   cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
        >
          ↗ Other Lender
        </button>
      </div>
    </div>
  );
}

// ─── Main EsrPage ─────────────────────────────────────────────────────────────
export default function EsrPage() {
  const { id: caseId } = useParams();
  const navigate = useNavigate();
  const [sendConfirmResult, setSendConfirmResult] = useState(null);
  const [showOtherLenderModal, setShowOtherLenderModal] = useState(false);

  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [esr, setEsr]               = useState(null);
  const [proposals, setProposals]   = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [esrResult, proposalsResult] = await Promise.allSettled([
        caseService.getESR(caseId),
        caseService.listProposals(caseId),
      ]);
      if (esrResult.status === 'fulfilled') setEsr(esrResult.value);
      else if (esrResult.reason?.response?.status !== 404) toast.error('Failed to load ESR');
      if (proposalsResult.status === 'fulfilled') setProposals(proposalsResult.value.proposals || []);
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
  const eligibleLenders   = lenders.filter(l => l.is_eligible);
  const ineligibleLenders = lenders.filter(l => !l.is_eligible);
  const monthlyIncome = esr?.raw_payload?.selected_monthly_income
    || (esr?.combined_income ? esr.combined_income / 12 : null);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Eligibility Summary Report
          </h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
            {esr
              ? `Generated ${new Date(esr.generated_at).toLocaleString('en-IN')} · ${eligibleLenders.length} eligible of ${lenders.length} lenders · ${proposals.length} proposal(s)`
              : 'Run the eligibility engine to see matching lenders'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/cases/${caseId}/bureau-obligations`)}>
            <ChevronLeft size={16} /> Back
          </button>
          <button className="btn btn-secondary" onClick={handleGenerate} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={generating ? 'spin' : ''} />
            {generating ? 'Generating...' : (esr ? 'Regenerate ESR' : 'Generate ESR')}
          </button>
        </div>
      </div>

      {/* Snapshot summary */}
      {esr && (
        <div className="card" style={{ marginBottom: 24, padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,#EBF4FF,transparent)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>📋 Input Snapshot</h3>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {[
              { label: 'Combined Annual Income', value: fmt(esr.combined_income) },
              { label: 'Property Value',         value: fmt(esr.property_value) },
              { label: 'Primary CIBIL',          value: esr.primary_cibil_score || '—' },
              { label: 'Lowest CIBIL',           value: esr.lowest_cibil_score || '—' },
              { label: 'Total EMI / Month',       value: fmt(esr.total_emi_per_month) }
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No ESR yet */}
      {!esr && !generating && (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No ESR generated yet</h3>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>Click <strong>Generate ESR</strong> to run the eligibility engine against all active lenders.</p>
          <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating} style={{ padding: '14px 36px' }}>
            {generating ? 'Generating...' : '⚡ Generate Eligibility Report'}
          </button>
        </div>
      )}

      {/* Eligible Lenders */}
      {eligibleLenders.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <CheckCircle size={18} color="var(--success)" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>Eligible Lenders ({eligibleLenders.length})</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {eligibleLenders.map(lender => (
              <div key={lender.lender_id} className="card" style={{ borderTop: '3px solid var(--success)', position: 'relative' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{lender.lender_name}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {lender.product_display_name || lender.product_type} · {lender.best_scheme_name}
                      </p>
                    </div>
                    <span style={{ background: '#F0FFF4', color: 'var(--success)', padding: '4px 10px',
                      borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #9AE6B4' }}>✓ ELIGIBLE</span>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
                    {[
                      { label: 'Loan Amount', value: formatDynamicCurrency(lender.final_eligible_loan_amount), color: 'var(--success)' },
                      { label: 'ROI', value: lender.roi_min ? `${lender.roi_min}% p.a.` + (lender.roi_max ? ` – ${lender.roi_max}%` : '') : '—', color: 'var(--text-primary)' },
                      { label: 'LTV', value: lender.applicable_ltv_percent ? `${(lender.applicable_ltv_percent * 100).toFixed(0)}%` : '—', color: 'var(--text-primary)' },
                      { label: 'Max Tenure', value: formatDynamicTenure(lender.max_tenure_months), color: 'var(--text-primary)' }
                    ].map(({ label, value, color }) => value && (
                      <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <CalcBreakdownPanel evaluations={lender.scheme_evaluations} monthlyIncome={monthlyIncome} />
                  <SchemeDiagnosticsPanel evaluations={lender.scheme_evaluations} />

                  {/* Proposal Actions */}
                  <LenderActions
                    lender={lender}
                    caseId={caseId}
                    proposals={proposals}
                    onProposalCreated={load}
                    onSendToLender={setSendConfirmResult}
                    onSendToOtherLender={() => setShowOtherLenderModal(true)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ineligible Lenders */}
      {ineligibleLenders.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <XCircle size={18} color="var(--text-tertiary)" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>Not Eligible ({ineligibleLenders.length})</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ineligibleLenders.map(lender => (
              <div key={lender.lender_id} className="card" style={{ borderTop: '3px solid var(--border)', opacity: 0.85 }}>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>{lender.lender_name}</h3>
                    <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', padding: '3px 8px',
                      borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)' }}>✕ INELIGIBLE</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    {lender.product_display_name || lender.product_type}
                  </p>
                  {lender.ineligibility_reason && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#FFF5F5', borderRadius: 6,
                      fontSize: 11, color: 'var(--error)', border: '1px solid #FED7D7' }}>
                      ❌ {lender.ineligibility_reason}
                    </div>
                  )}
                  <CalcBreakdownPanel evaluations={lender.scheme_evaluations} monthlyIncome={monthlyIncome} />
                  <SchemeDiagnosticsPanel evaluations={lender.scheme_evaluations} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <SendConfirmationModal
        isOpen={!!sendConfirmResult}
        onClose={() => setSendConfirmResult(null)}
        result={sendConfirmResult}
      />
      <SendToOtherLenderModal
        isOpen={showOtherLenderModal}
        onClose={() => setShowOtherLenderModal(false)}
        caseId={caseId}
        onSuccess={r => { setShowOtherLenderModal(false); setSendConfirmResult(r); }}
      />
    </div>
  );
}
