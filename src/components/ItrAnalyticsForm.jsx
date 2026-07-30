import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    AlertCircle,
    FileText, Download
} from 'lucide-react';
import FormField from './ui/FormField';
import PullStatusTracker from './ui/PullStatusTracker';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';
import { useCasePullStatus, selectPullForApplicant, usePhaseTransition } from '../hooks/useCasePullStatus';

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
    mode
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

    usePhaseTransition(livePull ? phase : null, {
        COMPLETED: () => toast.success('ITR analytics ready!'),
        FAILED: () => toast.error('ITR analytics processing failed at provider'),
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

    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [refetching, setRefetching] = useState(false);

    const roleLabel = applicantType === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant';

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

    return (
        <div style={{
            backgroundColor: 'var(--bg-base)',
            border: `1px solid ${status === 'COMPLETED' ? 'var(--success)' : status === 'FAILED' ? 'var(--error)' : status === 'PROCESSING' ? 'var(--warning)' : 'var(--border)'}`,
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
                </div>

                

                {/* Right: Pills + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                    {/* Live status — pushed from the server, animated while work is in flight */}
                    <PullStatusTracker phase={phase} label={phaseLabel} progress={progress} />

                    {/* Action Button */}
                    {status === 'PROCESSING' ? (
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
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {status === 'FAILED' ? 'Retry' : 'Fetch ITR'}
                        </button>
                    )}
                </div>
            </div>

            {/* Expando: credential entry — only relevant pre-completion, since the
                completed state's only action (Excel download) already lives in the
                summary row above; no separate "Analytics Summary" panel needed. */}
            {isOpen && status !== 'COMPLETED' && (
                <div style={{ padding: 24, backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        
                    </div>

                    {!isMsme && walletBalance < itrCost && (
                        <div style={{ padding: 12, borderRadius: 0, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 16 }}>
                            <AlertCircle size={16} /> Insufficient credits. Wallet: {walletBalance}, Required: {itrCost}.
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-base)', padding: 16, borderRadius: 0, border: '1px solid var(--border)' }}>
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
                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter portal password"
                            />
                        </FormField>
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
