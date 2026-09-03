import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    AlertCircle,
    FileText, Download, Trash2, Mail, XCircle, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import FormField from './ui/FormField';
import PullStatusTracker from './ui/PullStatusTracker';
import Skeleton from './ui/Skeleton';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';
import { useCasePullStatus, selectPullForApplicant, usePhaseTransition } from '../hooks/useCasePullStatus';
import { itrAuthLinkService } from '../api/itrAuthLinkService';

const formatInr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const ItrAnalyticsForm = ({
    caseId,
    customerId,
    applicantId,
    applicantType,
    applicantName,
    prefillPan,
    walletBalance,
    itrCost,
    existingRecord,
    onComplete,
    onRemoved,
    mode,
    disabled = false
}) => {
    // MSME self-service borrowers don't see wallet-credit costs (DSA concept)
    const isMsme = mode === 'MSME_SELF_SERVICE';
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    // Live server-pushed status for this case (see hooks/useCasePullStatus).
    // One socket room per case is shared by every mounted pull component, so
    // this costs the same whether there is one applicant or ten.
    const { snapshot, refresh } = useCasePullStatus(caseId);
    const livePull = selectPullForApplicant(snapshot, 'itr', applicantId);

    // Local mirror, used only until the first snapshot arrives (initial paint,
    // or if websockets are blocked). Once `livePull` exists the server is
    // authoritative — which is what makes returning to this step show the true
    // current state with no refresh, even if the pull finished while the user
    // was three steps away.
    const [localStatus, setLocalStatus] = useState(existingRecord?.status || 'INITIATED');
    const [localReferenceId, setLocalReferenceId] = useState(existingRecord?.reference_id || null);
    const [localDocumentId, setLocalDocumentId] = useState(existingRecord?.itr_document_id || null);
    const [localExcelUrl, setLocalExcelUrl] = useState(existingRecord?.excel_url || null);

    const status = livePull?.status || localStatus;
    const referenceId = livePull?.reference_id || localReferenceId;
    const documentId = livePull?.itr_document_id || localDocumentId;
    const excelUrl = livePull?.excel_url || localExcelUrl;
    const phase = livePull?.phase
        || (localStatus === 'COMPLETED' ? 'COMPLETED'
            : localStatus === 'FAILED' ? 'FAILED'
                : localStatus === 'PROCESSING' ? 'PROCESSING' : 'NOT_STARTED');
    const phaseLabel = livePull?.label || '';
    const progress = livePull?.progress ?? 0;

    // existingRecord can legitimately arrive/update after this component's
    // first render (it's derived from the parent case's own async load) —
    // useState's initial value only ever applies once, so a late-arriving
    // prop would otherwise leave this stuck showing "not started" until a
    // full page reload re-mounts everything fresh. Only adopt it while
    // nothing has happened client-side yet, so it can never clobber
    // in-progress local state with a stale snapshot.
    useEffect(() => {
        if (!existingRecord || localReferenceId) return;
        setLocalStatus(existingRecord.status || 'INITIATED');
        setLocalReferenceId(existingRecord.reference_id || null);
        setLocalDocumentId(existingRecord.itr_document_id || null);
        setLocalExcelUrl(existingRecord.excel_url || null);
    }, [existingRecord, localReferenceId]);

    // A revoked/expired auth link also resolves to phase FAILED (see
    // casePullSnapshot.service.js's describeItrAuthLink) — that's the DSA's
    // own deliberate action (or an inert timeout), not a provider failure,
    // and the cancel button below already gives its own confirmation toast.
    // Only a real provider failure on an actual pull should trigger this one.
    usePhaseTransition(livePull ? phase : null, {
        COMPLETED: () => toast.success('ITR analytics ready!'),
        FAILED: () => { if (!livePull?.is_auth_link_request) toast.error('ITR analytics processing failed at provider'); },
    });

    // Hand the finished payload up once it exists — also covers the case where
    // it completed before this component ever mounted.
    const notifiedRef = React.useRef(false);
    useEffect(() => {
        if (phase !== 'COMPLETED' || notifiedRef.current) return;
        notifiedRef.current = true;
        onComplete && onComplete({ documentId, excel_url: excelUrl });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const [pan, setPan] = useState(prefillPan || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [refetching, setRefetching] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [sendingLink, setSendingLink] = useState(false);
    const [cancellingLink, setCancellingLink] = useState(false);

    const incomePreview = livePull?.income_preview || null;

    // A link created but never yet used by the customer — see
    // casePullSnapshot.service.js's serializeItrAuthLink. This is the only
    // state where "Fetch ITR" should be replaced by a Cancel Request action:
    // once the customer submits, livePull becomes the real ItrAnalyticsRequest
    // row (reference_id present) and the ordinary PROCESSING branch below
    // takes back over automatically.
    const isAuthLinkPending = status === 'AWAITING_CUSTOMER_ACTION' && livePull?.is_auth_link_request;
    const authLinkId = livePull?.auth_link_id;

    const roleLabel = applicantType === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant';

    // Emails the customer a link to enter their own ITR portal PAN/password —
    // an alternative to the DSA keying it in directly below. No data is
    // pulled by this call itself; it only sends the link and flips this row
    // to "Action needed — waiting for the customer" until they submit it.
    const handleSendAuthLink = async () => {
        setSendingLink(true);
        try {
            await itrAuthLinkService.requestLink({ customer_id: customerId, case_id: caseId, applicant_id: applicantId });
            toast.success('ITR authorisation link sent to the customer');
            setIsOpen(false);
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send the ITR auth link');
        } finally {
            setSendingLink(false);
        }
    };

    // Revokes a still-pending link before the customer has used it — if they
    // open it afterwards, the page shows "This request has been revoked."
    const handleCancelAuthLink = async () => {
        if (!authLinkId) return;
        if (!window.confirm('Cancel this ITR authorisation link? The customer will no longer be able to use it.')) return;
        setCancellingLink(true);
        try {
            await itrAuthLinkService.cancelLink(authLinkId);
            toast.success('ITR auth link cancelled');
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to cancel the ITR auth link');
        } finally {
            setCancellingLink(false);
        }
    };

    const handleAnalyze = async () => {
        if (!pan) return toast.error('PAN is required');
        if (!password) return toast.error('ITR portal password is required');

        setLoading(true);
        try {
            const res = await api.post('/external/itr/analyze', {
                customer_id: customerId,
                case_id: caseId,
                applicant_id: applicantId,
                pan: pan.toUpperCase(),
                password
            });
            const data = res.data;

            toast.success('ITR analytics request submitted successfully');
            setLocalReferenceId(data.referenceId);
            setLocalStatus('PROCESSING');
            setIsOpen(false);
            setPassword(''); // Clear sensitive field immediately
            setShowPassword(false);
            // Collapse the wait for the next server tick so the row flips to
            // "Processing" immediately.
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Re-run the provider sync for a request that is COMPLETED but has no
    // stored report. Safe to repeat: syncItrRequest short-circuits once a
    // document exists, so this can only ever move the record forwards.
    const handleRefetch = async () => {
        if (!referenceId) return toast.error('No reference id on this request');
        setRefetching(true);
        try {
            const res = await api.post('/external/itr/sync', { reference_id: referenceId });
            if (res.data?.documentId || res.data?.excel_url) {
                toast.success('ITR report retrieved');
            } else {
                toast('The provider has no report file for this request.', { icon: 'ℹ️' });
            }
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not fetch the ITR report');
        } finally {
            setRefetching(false);
        }
    };

    const handleCancel = async () => {
        if (!referenceId) return;
        if (!window.confirm('Cancel this ITR request? This cannot be undone.')) return;
        setCancelling(true);
        try {
            await api.post('/external/itr/cancel', { reference_id: referenceId });
            setLocalStatus('FAILED');
            toast.success('ITR request cancelled');
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to cancel ITR request');
        } finally {
            setCancelling(false);
        }
    };

    // Removes an already-completed ITR pull (old/wrong data, or a retry is
    // needed under a different PAN). `cancel` above only works on in-flight
    // requests — this clears a finished one, including its net-profit/gross-
    // receipts figures (the backend nulls the raw payload too, not just the
    // computed fields, so this doesn't just hide the number — it removes it).
    const handleDelete = async () => {
        if (!referenceId) return;
        if (!window.confirm('Remove this ITR record permanently? You can pull ITR data again afterwards.')) return;
        setDeleting(true);
        try {
            await api.post('/external/itr/delete', { reference_id: referenceId });
            setLocalStatus('FAILED');
            toast.success('ITR record removed');
            onRemoved && onRemoved();
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to remove ITR record');
        } finally {
            setDeleting(false);
        }
    };

    // `existingRecord` is normally a synchronous prop (the parent wizard
    // already awaited the case load before this component ever mounts), so
    // this resolves on the very first render in the common case — no
    // artificial delay. But it can also stay `undefined` for the entire
    // session if the parent wizard's in-memory case data was built before
    // this field existed on it (e.g. navigating straight from the GST step
    // to the ITR step without a full page reload) — gating on it alone then
    // left this stuck on a skeleton forever, only resolving on a manual
    // refresh once the parent re-fetched the case fresh. `snapshot` (see
    // hooks/useCasePullStatus) resolves independently over the socket
    // regardless of what the parent prop ever does, so also treating that as
    // "ready" — matching GstAnalyticsForm's own dataReady gate — means this
    // never gets stuck even when `existingRecord` never arrives.
    if (existingRecord === undefined && snapshot === null) {
        return (
            <div style={{ border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden', padding: isMobile ? '14px 16px' : '16px 24px' }}>
                <Skeleton width={140} height={13} style={{ marginBottom: 6 }} />
                <Skeleton width={90} height={11} />
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'var(--bg-base)',
            border: `1px solid ${status === 'COMPLETED' ? 'var(--success)' : status === 'FAILED' ? 'var(--error)' : (status === 'PROCESSING' || isAuthLinkPending) ? 'var(--warning)' : 'var(--border)'}`,
            borderRadius: 0,
            overflow: 'hidden'
        }}>
            {/* Summary Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 1fr) minmax(200px, 2fr) auto',
                gap: isMobile ? 10 : 16,
                alignItems: 'center',
                padding: isMobile ? '14px 16px' : '16px 24px'
            }}>
                {/* Left: Name & Role */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{applicantName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{roleLabel}</span>
                    {isAuthLinkPending && livePull?.recipient_email && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Auth link sent to {livePull.recipient_email}
                        </span>
                    )}
                </div>

                {/* Right: Pills + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                    {/* Live status — pushed from the server, animated while work is in flight */}
                    <PullStatusTracker phase={phase} label={phaseLabel} progress={progress} />

                    {/* Action Button */}
                    {isAuthLinkPending ? (
                        // Link sent, customer hasn't submitted it yet — no data has
                        // been touched, so the only actions available are re-sending
                        // it (e.g. the customer says they never got the email, or the
                        // first one expired) or revoking it. Resend reuses the same
                        // requestItrAuthLink call Send Auth Link does — it already
                        // supersedes the still-pending link and issues a fresh one.
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleSendAuthLink}
                                disabled={sendingLink}
                                title="Send a fresh auth link — the current one will be revoked"
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <RefreshCw size={13} /> {sendingLink ? 'Resending…' : 'Resend Link'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={handleCancelAuthLink}
                                disabled={cancellingLink}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', border: '1px solid var(--error)' }}
                            >
                                <XCircle size={13} /> {cancellingLink ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                        </div>
                    ) : status === 'PROCESSING' ? (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={handleCancel}
                            disabled={cancelling}
                            style={{ color: 'var(--error)', border: '1px solid var(--error)' }}
                        >
                            {cancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                    ) : status === 'COMPLETED' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            {documentId ? (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => downloadDocument(documentId, `itr_analytics.xlsx`).catch(e => toast.error('Download failed: ' + e.message))}
                                >
                                    <Download size={13} /> Excel
                                </button>
                            ) : excelUrl ? (
                                // Fallback for records ingested before document storage was implemented
                                <a href={excelUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                                    <FileText size={13} /> Excel
                                </a>
                            ) : (
                                // Marked complete but no file was stored. The background worker can
                                // close out a job before the analytics were ever pulled, in which
                                // case re-syncing genuinely recovers the report — so offer it
                                // rather than leaving a dead row with no action.
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleRefetch}
                                    disabled={refetching}
                                    title="No report file was stored for this request — try fetching it again"
                                >
                                    {refetching ? 'Fetching…' : 'Fetch Report'}
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', border: '1px solid var(--error)' }}
                            >
                                <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setIsOpen(!isOpen)}
                                disabled={disabled}
                                title={disabled ? 'Live ITR analysis is disabled for this test/injected case.' : undefined}
                            >
                                {isMsme
                                    ? (status === 'FAILED' ? 'Retry' : 'Fetch ITR')
                                    : (status === 'FAILED' ? `Retry (~${itrCost} Cr)` : `Fetch ITR (~${itrCost} Cr)`)}
                            </button>
                            {/* DSA-only: email the customer a link to enter their own
                                PAN/password instead — never available in MSME self-service
                                mode, since there the customer already is the one filling
                                the form in directly. Deliberately NOT gated on the current
                                wallet balance (unlike the expando's direct-entry Analyze
                                button) — same as "Fetch ITR" above: the wallet is only
                                actually charged once the customer submits, which may be
                                well after the DSA has topped up, so blocking the send here
                                would be premature. The real balance check still happens
                                server-side at submit time either way. */}
                            {!isMsme && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleSendAuthLink}
                                    disabled={disabled || sendingLink}
                                    title={disabled ? 'Live ITR analysis is disabled for this test/injected case.' : (walletBalance < itrCost ? `Wallet is currently below the ${itrCost}-credit cost — top up before the customer submits, or the pull will fail then.` : "Email the customer a link to enter their own ITR portal credentials")}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Mail size={13} /> {sendingLink ? 'Sending…' : `Send Auth Link (~${itrCost} Cr)`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Income preview — quick net profit / gross receipts figures right
                here, so seeing the headline numbers doesn't require opening the
                Excel report. */}
            {status === 'COMPLETED' && incomePreview && (
                <div style={{
                    display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14,
                    padding: isMobile ? '14px 16px' : '14px 24px', borderTop: '1px solid var(--success)', background: 'var(--success-bg)',
                }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Profit (Latest Year)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(incomePreview.net_profit_latest_year)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{incomePreview.financial_year_latest || '—'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Profit (Previous Year)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(incomePreview.net_profit_previous_year)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{incomePreview.financial_year_previous || '—'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross Receipts (Latest Year)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(incomePreview.gross_receipts_latest_year)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross Receipts (Previous Year)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatInr(incomePreview.gross_receipts_previous_year)}</div>
                    </div>
                </div>
            )}

            {/* Expando: credential entry — only relevant pre-completion, since the
                completed state's only action (Excel download) already lives in the
                summary row above; no separate "Analytics Summary" panel needed. */}
            {isOpen && status !== 'COMPLETED' && !isAuthLinkPending && (
                <div style={{ padding: 24, backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        
                    </div>

                    {!isMsme && walletBalance < itrCost && (
                        <div style={{ padding: 12, borderRadius: 0, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 16 }}>
                            <AlertCircle size={16} /> Insufficient credits. Wallet: {walletBalance}, Required: {itrCost}.
                        </div>
                    )}

                    {/* Username + password grouped side by side in one bordered
                        box — same treatment as GstAnalyticsForm's credential
                        group, since they're one logical credential pair. */}
                    <div style={{ background: 'var(--bg-base)', padding: 16, borderRadius: 0, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                            <FormField label="PAN / ITR Username" required>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={pan}
                                    onChange={e => setPan(e.target.value.toUpperCase())}
                                    placeholder="ABCDE1234F"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </FormField>
                            <FormField label="ITR Portal Password" required>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-control"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter portal password"
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
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsOpen(false)}>Cancel</button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAnalyze}
                            disabled={loading || (!isMsme && walletBalance < itrCost)}
                        >
                            {loading ? 'Submitting...' : isMsme ? 'Analyze' : `Analyze (~${itrCost} Cr)`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItrAnalyticsForm;
