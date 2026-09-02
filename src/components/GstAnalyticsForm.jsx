import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, FileText, Download, Trash2, Building2, Lock, Eye, EyeOff, Mail, Send } from 'lucide-react';
import FormField from './ui/FormField';
import PullStatusTracker from './ui/PullStatusTracker';
import Skeleton from './ui/Skeleton';
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

const formatInr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const GstAnalyticsForm = ({ caseId, customerId, applicantId = null, applicantType = 'PRIMARY', applicantName = null, linkedGstins = [], onComplete, onRemoved, onboardingMode, walletBalance, gstCost, disabled = false, prefillEmail = '', prefillMobile = '' }) => {
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
    // Same select-or-type-your-own pattern as the GSTIN field above — default
    // to whatever email/mobile this applicant already has on file (from step
    // 1) instead of making the DSA retype it, while still allowing a
    // different one to be entered.
    const [isManualEmail, setIsManualEmail] = useState(!prefillEmail);
    const [isManualMobile, setIsManualMobile] = useState(!prefillMobile);

    const [formData, setFormData] = useState({
        gstin: '',
        username: '',
        password: '',
        from_date: `${AUTO_FROM_MONTH}${AUTO_FROM_YEAR}`,
        to_date: `${AUTO_TO_MONTH}${AUTO_TO_YEAR}`,
        emails: prefillEmail || '',
        mobile_numbers: prefillMobile || ''
    });

    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Live status is pushed from the server (see hooks/useCasePullStatus) — no
    // client-side polling. The server keeps one sync loop per case, so this
    // stays current even while the user is on another wizard step, and the
    // snapshot handed back on (re)join means remounting this component paints
    // the real state immediately rather than a stale "Pending".
    const { snapshot, refresh } = useCasePullStatus(caseId);

    // Websockets can be blocked by corporate proxies; this one-shot REST read
    // keeps the component usable in that case until/unless a push arrives.
    const [fallbackRequests, setFallbackRequests] = useState([]);
    // One case can render several of these — one per self-employed applicant
    // (primary + co-applicants) — so every request list must be scoped to
    // THIS applicant, the same way ItrAnalyticsForm's selectPullForApplicant
    // does; both snapshot.gst.requests and the REST fallback already carry
    // applicant_id per row (see casePullSnapshot.service.js's serializeGst
    // and external.gst.controller.js's getRequestDetails applicant_id filter).
    const wantedApplicantId = applicantId == null ? null : Number(applicantId);
    const allRequests = snapshot ? snapshot.gst.requests : fallbackRequests;
    const activeRequests = allRequests.filter(r => (r.applicant_id ?? null) === wantedApplicantId);

    // Hoisted above the effects below (moved from further down the file) so
    // gstPhase can be derived from THIS applicant's own latest request
    // instead of snapshot.gst.overall.phase, which is a case-wide rollup —
    // with multiple GstAnalyticsForm instances rendered per case (one per
    // self-employed applicant), the overall phase would fire every
    // instance's onComplete/toast the moment ANY one applicant's pull
    // finished, not just this card's own.
    const visibleRequests = activeRequests.filter(req => !(req.auth_type === 'OTP' && req.status === 'OTP_PENDING'));
    const latestRequest = visibleRequests[0] || null;
    // `phase` is only present on realtime snapshots; the REST fallback shape
    // has just the raw status, so derive from that when a push hasn't arrived yet.
    const phase = latestRequest && (latestRequest.phase
        || (['REPORT_READY', 'COMPLETED'].includes(latestRequest.status) ? 'COMPLETED'
            : ['FAILED', 'EXPIRED'].includes(latestRequest.status) ? 'FAILED' : 'PROCESSING'));

    // Neither `snapshot` (starts null until the socket delivers its first
    // push) nor `fallbackRequests` (starts []) carry any synchronous "has
    // this pull already completed" signal on mount — unlike ITR/Bank, this
    // component has no existingRecord-style prop to render from immediately.
    // Rendering before either resolves briefly showed the empty
    // "Enter Details / Send Auth Link" form even when a completed pull
    // already existed, which then snapped to the real "pulled successfully"
    // panel a moment later. Gate the whole render on one of these two
    // sources actually resolving, and show a skeleton until then.
    const [restLoaded, setRestLoaded] = useState(false);
    const dataReady = snapshot !== null || restLoaded;

    useEffect(() => {
        if (caseId) fetchRequests();
    }, [caseId]);

    // Announce completion exactly once per transition — snapshots arrive every
    // couple of seconds while a pull is live, so reacting to the raw value
    // would re-toast continuously.
    const gstPhase = phase;
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

    // Same idea as the GSTIN prefill above — this applicant's step-1 email/
    // mobile can arrive after this component's first mount (case data is
    // still loading), so re-sync once it does. Only while still on the
    // "use the registered one" select (not after the DSA has switched to
    // manual entry), and only overwrites an empty field — never clobbers
    // something already typed.
    useEffect(() => {
        if (prefillEmail && !isManualEmail && !formData.emails) {
            setFormData(prev => ({ ...prev, emails: prefillEmail }));
        }
    }, [prefillEmail, isManualEmail]);
    useEffect(() => {
        if (prefillMobile && !isManualMobile && !formData.mobile_numbers) {
            setFormData(prev => ({ ...prev, mobile_numbers: prefillMobile }));
        }
    }, [prefillMobile, isManualMobile]);

    const fetchRequests = async () => {
        try {
            const res = await api.get(`/external/gst/requests?case_id=${caseId}&applicant_id=${wantedApplicantId ?? 'null'}`);
            if (res.data.success) {
                setFallbackRequests(res.data.data);
                if (res.data.data.some(r => r.status === 'REPORT_READY' || r.status === 'COMPLETED')) {
                    onComplete && onComplete();
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRestLoaded(true);
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
                applicant_id: applicantId,
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

    // Removes an already-completed GST pull (old/wrong data, or a retry is
    // needed under a different GSTIN) — `cancel` above only works on
    // in-flight requests, there was previously no way to clear a finished one.
    const handleDeleteRequest = async (requestId) => {
        if (!window.confirm('Remove this GST record permanently? You can pull GST data again afterwards.')) return;
        setDeleting(true);
        try {
            await api.post(`/external/gst/delete`, { request_id: requestId });
            toast.success('GST record removed');
            onRemoved && onRemoved();
            refresh();
            await fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to remove GST record');
        } finally {
            setDeleting(false);
        }
    };

    const isSuccess = phase === 'COMPLETED';
    const isDead = phase === 'FAILED';

    if (!dataReady) {
        return (
            <div style={{ padding: 24 }}>
                <Skeleton width={160} height={13} style={{ marginBottom: 10 }} />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <Skeleton height={38} />
                    <Skeleton height={38} />
                </div>
                <Skeleton height={38} width={140} />
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            {/* The applicant-name heading now lives in the parent wizard page
                (rendered unconditionally there, above both this form and the
                "not applicable" empty state) — this component can render with
                no visible name context at all when hidden by that state, so
                duplicating a heading here would only show up in the cases
                where it's least needed. */}
            {!isSuccess && (
            <div style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                marginBottom: 24,
            }}>
                {/* Section header — gives this block presence instead of
                    dropping straight into a bare radio row. */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                }}>
                    <div style={{
                        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(79,70,229,0.12)', color: '#4f46e5', flexShrink: 0,
                    }}>
                        <Building2 size={16} />
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>GST Verification</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pull the last 24 months of GST returns for this business</div>
                    </div>
                </div>

                <div style={{ padding: 20 }}>
                    {/* Segmented mode toggle — same two options as before, styled
                        as tabs instead of raw radio inputs. */}
                    <div style={{
                        display: 'inline-flex', padding: 3, marginBottom: 20,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        width: isMobile ? '100%' : 'auto',
                    }}>
                        {[
                            { value: 'IN_SYSTEM', label: 'Enter Details in System' },
                            { value: 'AUTH_LINK', label: 'Send Auth Link to Customer' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMode(opt.value)}
                                style={{
                                    flex: isMobile ? 1 : 'none',
                                    padding: '7px 16px',
                                    fontSize: 12.5, fontWeight: 700,
                                    border: 'none', cursor: 'pointer',
                                    background: mode === opt.value ? '#4f46e5' : 'transparent',
                                    color: mode === opt.value ? '#fff' : 'var(--text-secondary)',
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ marginBottom: 20 }}>
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
                    </div>

                    {/* Username + password grouped together in one bordered box,
                        side by side — they're one logical credential pair, not
                        two unrelated fields, so they shouldn't read as separate
                        rows. Left accent bar + lock icon mark it as the
                        sensitive-input block. */}
                    {mode === 'IN_SYSTEM' && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid #4f46e5', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                                <Lock size={13} color="#4f46e5" />
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Portal Credentials</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, padding: 16 }}>
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
                                <FormField label="GST Password" required>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={e => setFormData({...formData, password: e.target.value})}
                                            className="form-control"
                                            placeholder="GST portal password"
                                            autoComplete="new-password"
                                            name="gst-password-no-autofill"
                                            style={{ paddingRight: 36 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((s) => !s)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            style={{
                                                position: 'absolute', right: 0, top: 0, height: '100%', width: 34,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-tertiary)',
                                            }}
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </FormField>
                            </div>
                            <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', padding: '0 16px 14px', margin: 0 }}>
                                Sent directly to the GST portal to pull the report — never stored.
                            </p>
                        </div>
                    )}

                    {mode === 'AUTH_LINK' && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid #4f46e5', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                                <Mail size={13} color="#4f46e5" />
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Send Auth Link To</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, padding: 16 }}>
                                {/* Same select-or-type-your-own pattern as the GSTIN
                                    field — defaults to whichever email/mobile this
                                    applicant already has on file from step 1, so the
                                    DSA isn't retyping something already captured. */}
                                <FormField label="Target Emails (comma separated)">
                                    {!isManualEmail && prefillEmail ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <select
                                                className="form-control"
                                                value={formData.emails}
                                                onChange={e => {
                                                    if (e.target.value === '__manual__') {
                                                        setIsManualEmail(true);
                                                        setFormData({ ...formData, emails: '' });
                                                    } else {
                                                        setFormData({ ...formData, emails: e.target.value });
                                                    }
                                                }}
                                            >
                                                <option value={prefillEmail}>{prefillEmail}</option>
                                                <option value="__manual__">Enter manually...</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input type="text" value={formData.emails} onChange={e => setFormData({...formData, emails: e.target.value})} className="form-control" placeholder="user@biz.com" />
                                            {prefillEmail && (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setIsManualEmail(false); setFormData({ ...formData, emails: prefillEmail }); }}>Cancel</button>
                                            )}
                                        </div>
                                    )}
                                </FormField>
                                <FormField label="Target Mobile Numbers (comma separated)">
                                    {!isManualMobile && prefillMobile ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <select
                                                className="form-control"
                                                value={formData.mobile_numbers}
                                                onChange={e => {
                                                    if (e.target.value === '__manual__') {
                                                        setIsManualMobile(true);
                                                        setFormData({ ...formData, mobile_numbers: '' });
                                                    } else {
                                                        setFormData({ ...formData, mobile_numbers: e.target.value });
                                                    }
                                                }}
                                            >
                                                <option value={prefillMobile}>{prefillMobile}</option>
                                                <option value="__manual__">Enter manually...</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input type="text" value={formData.mobile_numbers} onChange={e => setFormData({...formData, mobile_numbers: e.target.value})} className="form-control" placeholder="9876543210" />
                                            {prefillMobile && (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setIsManualMobile(false); setFormData({ ...formData, mobile_numbers: prefillMobile }); }}>Cancel</button>
                                            )}
                                        </div>
                                    )}
                                </FormField>
                            </div>
                            <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', padding: '0 16px 14px', margin: 0 }}>
                                At least one email or mobile number is required — the customer receives the auth link there, not through the GST username/password fields above.
                            </p>
                        </div>
                    )}

                    {!isMsme && gstCost != null && walletBalance < gstCost && (
                        <div style={{ padding: 12, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 20 }}>
                            <AlertCircle size={16} /> Insufficient credits. Wallet: {walletBalance}, Required: {gstCost}.
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleCreateRequest}
                        disabled={disabled || loading || !formData.gstin || (!isMsme && gstCost != null && walletBalance < gstCost)}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        title={disabled ? 'Live GST analysis is disabled for this test/injected case.' : undefined}
                    >
                        <Send size={14} />
                        {loading ? 'Creating...' : isMsme ? 'Submit' : `Submit (~${gstCost ?? 1} Cr)`}
                    </button>
                </div>
            </div>
            )}

            {latestRequest && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 16, background: isSuccess ? 'var(--success-bg)' : isDead ? 'var(--error-bg)' : 'var(--bg-surface)' }}>
                    {isDead ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontWeight: 600, fontSize: 14 }}>
                            <AlertCircle size={16} /> {latestRequest.label || (latestRequest.provider_message?.toLowerCase().includes('cancel') ? 'Request cancelled' : 'GST request failed')}
                        </div>
                    ) : !isSuccess ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                                <PullStatusTracker
                                    variant="panel"
                                    phase={phase}
                                    label={latestRequest.label || 'Pulling GST data…'}
                                    progress={latestRequest.progress ?? 45}
                                />
                            </div>
                            <button type="button" onClick={() => handleCancelRequest(latestRequest.id)} disabled={cancelling}
                                className="btn btn-ghost btn-sm" style={{ color: 'var(--error)', border: '1px solid var(--error)' }}>
                                {cancelling ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                                    <CheckCircle2 size={16} /> GST data pulled successfully
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {/* PDF: prefer internal document, fallback to source URL for legacy records */}
                                    {latestRequest.gst_pdf_document_id ? (
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                            onClick={() => downloadDocument(latestRequest.gst_pdf_document_id, `gst_${latestRequest.gstin}.pdf`).catch(e => toast.error(e.message))}>
                                            <FileText size={14} /> PDF Report
                                        </button>
                                    ) : latestRequest.report_pdf_url ? (
                                        <a href={latestRequest.report_pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FileText size={14} /> PDF Report
                                        </a>
                                    ) : null}

                                    {/* Excel */}
                                    {latestRequest.gst_excel_document_id ? (
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                            onClick={() => downloadDocument(latestRequest.gst_excel_document_id, `gst_${latestRequest.gstin}.xlsx`).catch(e => toast.error(e.message))}>
                                            <Download size={14} /> Excel Report
                                        </button>
                                    ) : latestRequest.report_excel_url ? (
                                        <a href={latestRequest.report_excel_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Download size={14} /> Excel Report
                                        </a>
                                    ) : null}

                                    <button type="button" onClick={() => handleDeleteRequest(latestRequest.id)} disabled={deleting}
                                        className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', border: '1px solid var(--error)' }}>
                                        <Trash2 size={14} /> {deleting ? 'Removing...' : 'Remove'}
                                    </button>
                                </div>
                            </div>

                            {/* Turnover preview — the report/Excel downloads above have the
                                full detail, but a quick last-12-months + last-year figure
                                right here saves opening either just to see the headline number. */}
                            {latestRequest.turnover_preview && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14,
                                    marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--success)',
                                }}>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last 12 Months Turnover</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(latestRequest.turnover_preview.turnover_latest_year)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{latestRequest.turnover_preview.financial_year_latest || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Previous Year Turnover</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(latestRequest.turnover_preview.turnover_previous_year)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{latestRequest.turnover_preview.financial_year_previous || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg. Monthly Turnover</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(latestRequest.turnover_preview.avg_monthly_turnover)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Months Filed (12m)</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{latestRequest.turnover_preview.months_filed_12m ?? '—'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GstAnalyticsForm;
