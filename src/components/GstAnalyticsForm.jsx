import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react';
import FormField from './ui/FormField';
import PullStatusTracker from './ui/PullStatusTracker';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';
import { formatStatusLabel, isUsableEntityName } from '../utils/helpers';
import { useCasePullStatus, usePhaseTransition } from '../hooks/useCasePullStatus';

// GST pull window is fixed, not user-editable or shown on screen: the latest
// 2 years (24 months), ending 2 months before the current month — not a
// manually-picked range that can be set incorrectly or go stale.
const now = new Date();
const toDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const fromDate = new Date(toDate.getFullYear() - 2, toDate.getMonth(), 1);
const AUTO_TO_MONTH = String(toDate.getMonth() + 1).padStart(2, '0');
const AUTO_TO_YEAR = String(toDate.getFullYear());
const AUTO_FROM_MONTH = String(fromDate.getMonth() + 1).padStart(2, '0');
const AUTO_FROM_YEAR = String(fromDate.getFullYear());

const GstAnalyticsForm = ({ caseId, customerId, linkedGstins = [], onComplete, onboardingMode }) => {
    // MSME self-service borrowers don't see wallet-credit costs (DSA concept)
    const isMsme = onboardingMode === 'MSME_SELF_SERVICE';
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const [mode, setMode] = useState('IN_SYSTEM');
    const authType = 'PASSWORD';
    const [isManualGstin, setIsManualGstin] = useState(false);

    const [formData, setFormData] = useState({
        gstin: '',
        username: '',
        password: '',
        from_date: `${AUTO_FROM_MONTH}${AUTO_FROM_YEAR}`,
        to_date: `${AUTO_TO_MONTH}${AUTO_TO_YEAR}`,
        emails: '',
        mobile_numbers: ''
    });

    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Live status is pushed from the server (see hooks/useCasePullStatus) — no
    // client-side polling. The server keeps one sync loop per case, so this
    // stays current even while the user is on another wizard step, and the
    // snapshot handed back on (re)join means remounting this component paints
    // the real state immediately rather than a stale "Pending".
    const { snapshot, refresh } = useCasePullStatus(caseId);

    // Websockets can be blocked by corporate proxies; this one-shot REST read
    // keeps the component usable in that case until/unless a push arrives.
    const [fallbackRequests, setFallbackRequests] = useState([]);
    const activeRequests = snapshot ? snapshot.gst.requests : fallbackRequests;

    useEffect(() => {
        if (caseId) fetchRequests();
    }, [caseId]);

    // Announce completion exactly once per transition — snapshots arrive every
    // couple of seconds while a pull is live, so reacting to the raw value
    // would re-toast continuously.
    const gstPhase = snapshot?.gst?.overall?.phase;
    usePhaseTransition(gstPhase, {
        COMPLETED: () => toast.success('GST report ready!'),
        FAILED: () => toast.error('GST request failed'),
    });

    // Separate from the toast above: this also has to fire when the pull was
    // already complete before this component mounted (no transition to observe).
    useEffect(() => {
        if (gstPhase === 'COMPLETED') onComplete && onComplete();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gstPhase]);

    useEffect(() => {
        if (linkedGstins && linkedGstins.length > 0 && !formData.gstin) {
            const activeGstin = linkedGstins.find(g => g.status === 'Active')?.gstin || linkedGstins[0].gstin;
            setFormData(prev => ({ ...prev, gstin: activeGstin }));
        }
    }, [linkedGstins]);

    const fetchRequests = async () => {
        try {
            const res = await api.get(`/external/gst/requests?case_id=${caseId}`);
            if (res.data.success) {
                setFallbackRequests(res.data.data);
                if (res.data.data.some(r => r.status === 'REPORT_READY' || r.status === 'COMPLETED')) {
                    onComplete && onComplete();
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateRequest = async () => {
        if (!formData.gstin || !formData.from_date || !formData.to_date) {
            return toast.error("GSTIN, From Date, and To Date are required");
        }
        if (mode === 'IN_SYSTEM' && !formData.username) {
            return toast.error("Username is required for In-System auth");
        }
        if (mode === 'IN_SYSTEM' && authType === 'PASSWORD' && !formData.password) {
            return toast.error("Password is required for Password auth");
        }
        if (mode === 'AUTH_LINK' && !formData.emails.trim() && !formData.mobile_numbers.trim()) {
            return toast.error("Enter at least one customer email or mobile number to send the auth link to");
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: customerId,
                case_id: caseId,
                mode: mode,
                auth_type: mode === 'IN_SYSTEM' ? authType : null,
                gstin: formData.gstin,
                // Only meaningful for IN_SYSTEM auth — omit for AUTH_LINK so a
                // stale value typed while on the other tab is never sent.
                username: mode === 'IN_SYSTEM' ? formData.username : undefined,
                password: mode === 'IN_SYSTEM' ? formData.password : undefined,
                from_date: formData.from_date,
                to_date: formData.to_date,
                emails: formData.emails ? formData.emails.split(',').map(s => s.trim()) : [],
                mobile_numbers: formData.mobile_numbers ? formData.mobile_numbers.split(',').map(s => s.trim()) : [],
                pdf_url: true,
                entity_details: true
            };
            await api.post(`/external/gst/create`, payload);

            toast.success("GST Request initiated successfully");
            // Ask the server to re-broadcast now rather than waiting for its
            // next tick, so the new journey appears the instant it exists.
            refresh();
            await fetchRequests();

            // clear sensitive
            setFormData(prev => ({...prev, password: ''}));
        } catch (error) {
            const message = error.response?.data?.error || error.message;
            toast.error(`GST request failed: ${message}`, { duration: 8000 });
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRequest = async (requestId) => {
        if (!window.confirm('Cancel this GST request? This cannot be undone.')) return;
        setCancelling(true);
        try {
            await api.post(`/external/gst/cancel`, { request_id: requestId });
            toast.success('GST request cancelled');
            refresh();
            await fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to cancel GST request');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="gstMode" value="IN_SYSTEM" checked={mode === 'IN_SYSTEM'} onChange={() => setMode('IN_SYSTEM')} />
                    Enter Details in System
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="gstMode" value="AUTH_LINK" checked={mode === 'AUTH_LINK'} onChange={() => setMode('AUTH_LINK')} />
                    Send Auth Link to Customer
                </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <FormField label="SELECT GSTIN" required>
                    {!isManualGstin && linkedGstins && linkedGstins.length > 0 ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select
                                className="form-control"
                                value={formData.gstin}
                                onChange={e => {
                                    if (e.target.value === '__manual__') {
                                        setIsManualGstin(true);
                                        setFormData({ ...formData, gstin: '' });
                                    } else {
                                        setFormData({ ...formData, gstin: e.target.value });
                                    }
                                }}
                            >
                                <option value="">Select GSTIN</option>
                                {linkedGstins.map(g => (
                                    <option key={g.gstin} value={g.gstin}>
                                        {g.gstin}{isUsableEntityName(g.registration_name) ? ` (${g.registration_name})` : ''} - {formatStatusLabel(g.status)}
                                    </option>
                                ))}
                                <option value="__manual__">Enter manually...</option>
                            </select>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})} className="form-control" placeholder="12ABCDE3456X7YZ" />
                            {linkedGstins && linkedGstins.length > 0 && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsManualGstin(false)}>Cancel</button>
                            )}
                        </div>
                    )}
                </FormField>
                
                {mode === 'IN_SYSTEM' && (
                    <FormField label="GST Username" required>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={e => setFormData({...formData, username: e.target.value})}
                            className="form-control"
                            placeholder="GST portal username"
                            autoComplete="off"
                            name="gst-username-no-autofill"
                        />
                    </FormField>
                )}
            </div>

            {mode === 'IN_SYSTEM' && (
                 <div style={{ display: 'flex', gap: 16, marginBottom: 16, background: 'var(--bg-elevated)', padding: 16, borderRadius: 0 }}>
                    <div style={{ flex: 1 }}>
                         <FormField label="GST Password" required>
                             <input
                                 type="password"
                                 value={formData.password}
                                 onChange={e => setFormData({...formData, password: e.target.value})}
                                 className="form-control"
                                 placeholder="GST portal password"
                                 autoComplete="new-password"
                                 name="gst-password-no-autofill"
                             />
                         </FormField>
                    </div>
                </div>
            )}

            {mode === 'AUTH_LINK' && (
                 <div style={{ marginBottom: 16 }}>
                     <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                         <FormField label="Target Emails (comma separated)">
                            <input type="text" value={formData.emails} onChange={e => setFormData({...formData, emails: e.target.value})} className="form-control" placeholder="user@biz.com" />
                         </FormField>
                         <FormField label="Target Mobile Numbers (comma separated)">
                            <input type="text" value={formData.mobile_numbers} onChange={e => setFormData({...formData, mobile_numbers: e.target.value})} className="form-control" placeholder="9876543210" />
                         </FormField>
                     </div>
                     <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        At least one email or mobile number is required — the customer receives the auth link there, not through the GST username/password fields above.
                     </p>
                 </div>
            )}

            <button type="button" onClick={handleCreateRequest} disabled={loading || !formData.gstin} className="btn btn-primary" style={{ marginBottom: 24 }}>
                {loading ? 'Creating...' : isMsme ? 'Submit' : 'Submit (~1 Credit)'}
            </button>

            {(() => {
                const visible = activeRequests.filter(req => !(req.auth_type === 'OTP' && req.status === 'OTP_PENDING'));
                if (visible.length === 0) return null;
                // Only the most recent journey is shown — no journey list/history,
                // no raw GSTIN/mode/status/timestamp/auth-link plumbing surfaced to the user.
                const req = visible[0];
                // `phase` is only present on realtime snapshots; the REST
                // fallback shape has just the raw status, so derive from that
                // when a push hasn't arrived yet.
                const phase = req.phase
                    || (['REPORT_READY', 'COMPLETED'].includes(req.status) ? 'COMPLETED'
                        : ['FAILED', 'EXPIRED'].includes(req.status) ? 'FAILED' : 'PROCESSING');
                const isSuccess = phase === 'COMPLETED';
                const isDead = phase === 'FAILED';
                return (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 16, background: isSuccess ? 'var(--success-bg)' : isDead ? 'var(--error-bg)' : 'var(--bg-surface)' }}>
                        {isDead ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontWeight: 600, fontSize: 14 }}>
                                <AlertCircle size={16} /> {req.label || (req.provider_message?.toLowerCase().includes('cancel') ? 'Request cancelled' : 'GST request failed')}
                            </div>
                        ) : !isSuccess ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                                    <PullStatusTracker
                                        variant="panel"
                                        phase={phase}
                                        label={req.label || 'Pulling GST data…'}
                                        progress={req.progress ?? 45}
                                    />
                                </div>
                                <button type="button" onClick={() => handleCancelRequest(req.id)} disabled={cancelling}
                                    className="btn btn-ghost btn-sm" style={{ color: 'var(--error)', border: '1px solid var(--error)' }}>
                                    {cancelling ? 'Cancelling...' : 'Cancel Request'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                                    <CheckCircle2 size={16} /> GST data pulled successfully
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {/* PDF: prefer internal document, fallback to source URL for legacy records */}
                                    {req.gst_pdf_document_id ? (
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                            onClick={() => downloadDocument(req.gst_pdf_document_id, `gst_${req.gstin}.pdf`).catch(e => toast.error(e.message))}>
                                            <FileText size={14} /> PDF Report
                                        </button>
                                    ) : req.report_pdf_url ? (
                                        <a href={req.report_pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FileText size={14} /> PDF Report
                                        </a>
                                    ) : null}

                                    {/* Excel */}
                                    {req.gst_excel_document_id ? (
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                            onClick={() => downloadDocument(req.gst_excel_document_id, `gst_${req.gstin}.xlsx`).catch(e => toast.error(e.message))}>
                                            <Download size={14} /> Excel Report
                                        </button>
                                    ) : req.report_excel_url ? (
                                        <a href={req.report_excel_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Download size={14} /> Excel Report
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};

export default GstAnalyticsForm;
