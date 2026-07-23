import React, { useState, useEffect, useCallback, useRef } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Panel from '../components/ui/Panel';
import MetricTile from '../components/ui/MetricTile';
import {
  CheckCircle, XCircle, RefreshCw, Calculator,
  Send, Clock, CheckCircle2, AlertCircle, X, Mail, Phone,
  BarChart3, Landmark, ClipboardList, Wallet, Percent, TrendingDown,
  Home, Hash, Terminal, ArrowUpRight, ChevronUp, ChevronDown, Zap,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { sendCaseToLender, sendCaseToOtherLender, getTenantLenders } from '../api/tenantLenderService';

const easeOut = [0.22, 1, 0.36, 1];

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

// ─── Horizontal Scroll Row (for lenders beyond the top 3) ─────────────────────
function HorizontalScrollRow({ children }) {
  const scrollRef = useRef(null);
  const scrollBy = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll left"
        style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
          width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
        <ChevronLeft size={16} />
      </button>
      <div ref={scrollRef} className="hide-scrollbar"
        style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x proximity', padding: '4px 40px' }}>
        {children}
      </div>
      <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll right"
        style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
          width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Send Confirmation Modal ───────────────────────────────────────────────────
function SendConfirmationModal({ isOpen, onClose, result }) {
  return (
    <AnimatePresence>
      {isOpen && result && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: easeOut }}
            style={{ background: 'var(--bg-surface)', width: '94%', maxWidth: 520, borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ background: 'linear-gradient(135deg,#F0FFF4,#EBF8FF)', padding: '24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: '50%', background: '#F0FFF4', border: '2px solid #9AE6B4', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}
              >
                <CheckCircle2 size={28} color="#276749" />
              </motion.div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#276749', margin: 0 }}>Lead Successfully Sent!</h3>
              <p style={{ color: '#4A5568', fontSize: 13, marginTop: 6 }}>The proposal has been dispatched to the lender contact.</p>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email preview */}
              <div style={{ border: '1px solid #BEE3F8', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ background: '#EBF8FF', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} color='#2B6CB0' />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2B6CB0' }}>EMAIL SENT</span>
                </div>
                <div style={{ padding: '12px 16px', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>To:</span>
                    <span style={{ fontWeight: 600 }}>{result.to}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Contact:</span>
                    <span style={{ fontWeight: 600 }}>{result.contact_name}</span>
                  </div>
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Subject:</strong>
                    {result.subject}
                  </div>
                  <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>
                    {(result.body_preview || '').slice(0, 200)}…
                  </div>
                </div>
              </div>
              {/* SMS preview */}
              {result.sms?.smsSent && (
                <div style={{ border: '1px solid #C6F6D5', borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ background: '#F0FFF4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={14} color='#276749' />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#276749' }}>SMS SENT</span>
                  </div>
                  <div style={{ padding: '12px 16px', fontSize: 12 }}>
                    <div style={{ marginBottom: 4 }}>Sent to: <strong>{result.sms.to}</strong></div>
                    <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 0, fontSize: 11, lineHeight: 1.6 }}>{result.sms.message}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="btn btn-primary">Done</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: easeOut }}
            style={{ background: 'var(--bg-surface)', width: '94%', maxWidth: 480, borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Send to Other Lender</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {loading ? <div style={{ textAlign: 'center', padding: 30 }}><LoadingSpinner size={30} /></div> : lenders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>
                  No configured lenders found. <a href='/settings/lender-contacts' style={{ color: 'var(--primary)' }}>Add contacts →</a>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>Select Lender</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lenders.map(l => (
                        <button key={l.id} onClick={() => { setSelectedLender(l); setSelectedContact(null); }}
                          style={{ padding: '10px 14px', borderRadius: 0, textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                            border: `2px solid ${selectedLender?.id === l.id ? 'var(--primary)' : 'var(--border)'}`,
                            background: selectedLender?.id === l.id ? 'var(--primary-subtle)' : 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                          <Landmark size={15} color="var(--primary)" />
                          {l.lender_name} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>· {l.contacts.length} contact(s)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedLender && contacts.length > 0 && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>Select Contact</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {contacts.map(c => (
                          <button key={c.id} onClick={() => setSelectedContact(c)}
                            style={{ padding: '10px 14px', borderRadius: 0, textAlign: 'left', cursor: 'pointer', fontSize: 13,
                              border: `2px solid ${selectedContact?.id === c.id ? 'var(--success)' : 'var(--border)'}`,
                              background: selectedContact?.id === c.id ? 'var(--success-bg)' : 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            <div style={{ fontWeight: 600 }}>{c.contact_name} <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>({c.product_type})</span></div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.contact_email}{c.contact_mobile ? ` · ${c.contact_mobile}` : ''}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-elevated)' }}>
              <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={handleSend} disabled={!selectedContact || sending} className="btn btn-primary btn-sm"
                style={{ opacity: selectedContact ? 1 : 0.5, cursor: selectedContact ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={14} /> {sending ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

// ─── Calculation Breakdown Panel ──────────────────────────────────────────────
const CalcBreakdownPanel = ({ evaluations, monthlyIncome }) => {
  const [open, setOpen] = useState(false);
  const [activeScheme, setActiveScheme] = useState(0);
  if (!evaluations || evaluations.length === 0) return null;

  const ev = evaluations[activeScheme] || evaluations[0];

  const steps = [
    { label: 'Monthly Income Used', value: formatDynamicCurrency(monthlyIncome), icon: Wallet, color: 'var(--info)', bg: 'var(--info-bg)', note: 'Selected income method monthly figure' },
    { label: 'FOIR Allowed', value: fmtPct(ev.foir_allowed_percent), icon: Percent, color: 'var(--success)', bg: 'var(--success-bg)', note: 'Max permissible obligation %' },
    { label: 'FOIR Actual', value: fmtPct(ev.foir_actual_percent), icon: TrendingDown,
      color: ev.foir_actual_percent > ev.foir_allowed_percent ? 'var(--error)' : 'var(--success)',
      bg: ev.foir_actual_percent > ev.foir_allowed_percent ? 'var(--error-bg)' : 'var(--success-bg)',
      note: 'Current EMI ÷ income' },
    { label: 'Max Eligible EMI', value: ev.max_eligible_emi != null ? formatDynamicCurrency(Math.max(0, ev.max_eligible_emi)) : '—', icon: Landmark, color: 'var(--warning)', bg: 'var(--warning-bg)', note: '(FOIR% × Income) − Existing EMI' },
    { label: 'LTV Applied', value: ev.applicable_ltv_percent != null ? `${(ev.applicable_ltv_percent * 100).toFixed(0)}%` : '—', icon: Home, color: 'var(--role-admin)', bg: 'var(--role-admin-bg)', note: `Key: ${ev.applicable_ltv_key || '—'}` },
    { label: 'Max Loan by LTV', value: ev.max_loan_by_ltv != null ? formatDynamicCurrency(ev.max_loan_by_ltv) : '—', icon: Hash, color: 'var(--role-cred2tech)', bg: 'var(--role-cred2tech-bg)', note: 'Property Value × LTV%' },
    { label: 'Final Eligible Loan', value: ev.final_eligible_loan_amount != null ? formatDynamicCurrency(ev.final_eligible_loan_amount) : '—', icon: CheckCircle2,
      color: ev.is_eligible ? 'var(--success)' : 'var(--error)', bg: ev.is_eligible ? 'var(--success-bg)' : 'var(--error-bg)',
      note: ev.is_eligible ? 'Min(requested, LTV cap)' : 'Failed eligibility', highlight: true },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px',
        background: 'var(--bg-elevated)', color: 'var(--primary)', border: '1px solid var(--primary)',
        borderRadius: 0, cursor: 'pointer', fontWeight: 600
      }}>
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
              {evaluations.length > 1 && (
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  {evaluations.map((e, i) => (
                    <button key={i} onClick={() => setActiveScheme(i)} style={{
                      flex: 1, padding: '8px 6px', fontSize: 11, fontWeight: 600,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: activeScheme === i ? 'var(--primary)' : 'transparent',
                      color: activeScheme === i ? '#fff' : 'var(--text-secondary)',
                    }}>
                      {e.scheme_name}
                      {e.is_eligible ? <CheckCircle2 size={11} color={activeScheme === i ? '#fff' : 'var(--success)'} /> : <XCircle size={11} color={activeScheme === i ? '#fff' : 'var(--error)'} />}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ padding: '14px 14px 8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{
                      background: step.bg, borderRadius: 0, padding: '10px 12px',
                      border: step.highlight ? `2px solid ${step.color}` : '1px solid transparent',
                      gridColumn: step.highlight ? 'span 2' : 'span 1',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <step.icon size={11} /> {step.label}
                      </div>
                      <div style={{ fontSize: step.highlight ? 18 : 15, fontWeight: 800, color: step.color }}>
                        {step.value}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                        {step.note}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#1A202C', borderRadius: 0,
                  fontSize: 10, color: '#A0AEC0', fontFamily: 'monospace', lineHeight: 1.8 }}>
                  <div style={{ color: '#68D391', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Terminal size={11} /> Calculation Trace
                  </div>
                  <div>Max EMI = Income ({formatDynamicCurrency(monthlyIncome)}) × FOIR ({fmtPct(ev.foir_allowed_percent)}) − Obligations = {ev.max_eligible_emi != null ? formatDynamicCurrency(Math.max(0, ev.max_eligible_emi)) : '—'}</div>
                  <div>Max Loan LTV = {ev.max_loan_by_ltv != null ? formatDynamicCurrency(ev.max_loan_by_ltv) : '—'}</div>
                  <div style={{ color: '#68D391' }}>Final = {ev.final_eligible_loan_amount != null ? formatDynamicCurrency(ev.final_eligible_loan_amount) : '—'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Lender Action Button (multi-proposal aware) ───────────────────────────────
function LenderActions({ lender, caseId, proposals, onProposalCreated, onSendToLender, onSendToOtherLender, onOpenProposal }) {
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
      onOpenProposal(result.id);
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
              style={{ flex: 1, padding: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => onOpenProposal(latestProposal.id)}
            >
              View Proposal →
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '9px 14px', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
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
            style={{ flex: 1, padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                     background: 'linear-gradient(135deg,#2B6CB0,#553C9A)' }}
            onClick={handlePrepare}
            disabled={creating}
          >
            <ClipboardList size={15} /> {creating ? 'Creating...' : 'Prepare Proposal →'}
          </button>
        )}
      </div>

      {/* Row 2: secondary actions — equal width, same row across every card regardless of width */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSendEmail}
          disabled={sending}
          title="Send proposal email to this lender's configured contact"
          style={{ flex: 1, padding: '9px 8px', fontWeight: 700, fontSize: 12, borderRadius: 0,
                   background: sending ? '#718096' : '#276749', color: '#fff', border: 'none',
                   cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <Send size={13} /> {sending ? '...' : 'Send'}
        </button>
        <button
          onClick={onSendToOtherLender}
          title="Send to a different lender contact from your directory"
          style={{ flex: 1, padding: '9px 8px', fontWeight: 700, fontSize: 11, borderRadius: 0,
                   background: 'transparent', color: 'var(--role-admin)', border: '1px solid var(--role-admin)',
                   cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap' }}
        >
          <ArrowUpRight size={13} /> Other Lender
        </button>
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
export default function EsrPage({ caseId, onOpenProposal }) {
  const isMobile = useIsMobile();
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
    <div className="esr-page">
      <style>{`
        .esr-page .card,
        .esr-page .btn,
        .esr-page .form-control { border-radius: 0 !important; }
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
            Eligibility Summary Report
          </h1>
        </div>
        {esr && (
          <button className="btn btn-secondary btn-sm" onClick={handleGenerate} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={generating ? 'spin' : ''} />
            {generating ? 'Generating...' : 'Regenerate ESR'}
          </button>
        )}
      </motion.div>

      {/* No ESR yet */}
      {!esr && !generating && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="card" style={{ padding: '60px 40px', textAlign: 'center', marginBottom: 24, borderRadius: 0 }}>
          <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-elevated)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <BarChart3 size={32} color="var(--text-tertiary)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No ESR generated yet</h3>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>Click <strong>Generate ESR</strong> to run the eligibility engine against all active lenders.</p>
          <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating} style={{ padding: '14px 36px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} /> Generate Eligibility Report
          </button>
        </motion.div>
      )}

      {/* Eligible Lenders */}
      {eligibleLenders.length > 0 && (() => {
        const renderEligibleCard = (lender, i) => (
          <Panel key={lender.lender_id} bodyPadding={0} delay={i * 0.06} hoverable style={{ borderTop: '3px solid var(--success)', position: 'relative' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{lender.lender_name}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {lender.product_display_name || lender.product_type} · {lender.best_scheme_name}
                  </p>
                </div>
                <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px',
                  borderRadius: 0, fontSize: 11, fontWeight: 700, border: '1px solid var(--success)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <CheckCircle2 size={12} /> ELIGIBLE
                </span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
                {[
                  { label: 'Loan Amount', value: formatDynamicCurrency(lender.final_eligible_loan_amount), color: 'var(--success)' },
                  { label: 'ROI', value: lender.roi_min ? `${lender.roi_min}% p.a.` + (lender.roi_max ? ` – ${lender.roi_max}%` : '') : '—', color: 'var(--text-primary)' },
                  { label: 'LTV', value: lender.applicable_ltv_percent ? `${(lender.applicable_ltv_percent * 100).toFixed(0)}%` : '—', color: 'var(--text-primary)' },
                  { label: 'Max Tenure', value: formatDynamicTenure(lender.max_tenure_months), color: 'var(--text-primary)' }
                ].map(({ label, value, color }) => value && (
                  <MetricTile key={label} boxed label={label} value={value} color={color} />
                ))}
              </div>

              <CalcBreakdownPanel evaluations={lender.scheme_evaluations} monthlyIncome={monthlyIncome} />

              {/* Proposal Actions — pinned to the card's bottom so button rows line up across cards of different content heights */}
              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <LenderActions
                  lender={lender}
                  caseId={caseId}
                  proposals={proposals}
                  onProposalCreated={load}
                  onSendToLender={setSendConfirmResult}
                  onSendToOtherLender={() => setShowOtherLenderModal(true)}
                  onOpenProposal={onOpenProposal}
                />
              </div>
            </div>
          </Panel>
        );
        return (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <CheckCircle size={18} color="var(--success)" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>Eligible Lenders ({eligibleLenders.length})</h2>
            </div>
            {isMobile ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                {eligibleLenders.map((lender, i) => renderEligibleCard(lender, i))}
              </div>
            ) : eligibleLenders.length <= 3 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {eligibleLenders.map((lender, i) => renderEligibleCard(lender, i))}
              </div>
            ) : (
              // More than 3: keep exactly the top-3 width on screen and let the rest
              // continue to the right within the same row — never grows page height.
              <HorizontalScrollRow>
                {eligibleLenders.map((lender, i) => (
                  <div key={lender.lender_id} style={{ width: 320, flexShrink: 0, scrollSnapAlign: 'start', display: 'flex' }}>
                    {renderEligibleCard(lender, i)}
                  </div>
                ))}
              </HorizontalScrollRow>
            )}
          </div>
        );
      })()}

      {/* Ineligible Lenders */}
      {ineligibleLenders.length > 0 && (() => {
        const renderIneligibleCard = (lender, i) => (
          <Panel key={lender.lender_id} bodyPadding={0} delay={i * 0.05} style={{ borderTop: '3px solid var(--border)', opacity: 0.85 }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>{lender.lender_name}</h3>
                <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', padding: '3px 8px',
                  borderRadius: 0, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <XCircle size={11} /> INELIGIBLE
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                {lender.product_display_name || lender.product_type}
              </p>
              {lender.ineligibility_reason && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--error-bg)', borderRadius: 0,
                  fontSize: 11, color: 'var(--error)', border: '1px solid var(--error)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {lender.ineligibility_reason}
                </div>
              )}
              <CalcBreakdownPanel evaluations={lender.scheme_evaluations} monthlyIncome={monthlyIncome} />
            </div>
          </Panel>
        );
        return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <XCircle size={18} color="var(--text-tertiary)" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>Not Eligible ({ineligibleLenders.length})</h2>
          </div>
          {isMobile ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {ineligibleLenders.map((lender, i) => renderIneligibleCard(lender, i))}
            </div>
          ) : ineligibleLenders.length <= 3 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {ineligibleLenders.map((lender, i) => renderIneligibleCard(lender, i))}
            </div>
          ) : (
            // More than 3: keep exactly the top-3 width on screen and let the rest
            // continue to the right within the same row — never grows page height.
            <HorizontalScrollRow>
              {ineligibleLenders.map((lender, i) => (
                <div key={lender.lender_id} style={{ width: 320, flexShrink: 0, scrollSnapAlign: 'start', display: 'flex' }}>
                  {renderIneligibleCard(lender, i)}
                </div>
              ))}
            </HorizontalScrollRow>
          )}
        </div>
        );
      })()}

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
