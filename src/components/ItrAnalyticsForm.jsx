import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    CheckCircle2, AlertCircle,
    FileText, X, Download
} from 'lucide-react';
import FormField from './ui/FormField';
import PullingIndicator from './ui/PullingIndicator';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';

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
    const [status, setStatus] = useState(existingRecord?.status || 'INITIATED');
    const [referenceId, setReferenceId] = useState(existingRecord?.reference_id || null);
    // documentId is the internal stored file ID — use this for secure serving
    const [documentId, setDocumentId] = useState(existingRecord?.itr_document_id || null);
    // excelUrl kept only for audit/fallback display, NOT used for download
    const [excelUrl, setExcelUrl] = useState(existingRecord?.excel_url || null);

    const [pan, setPan] = useState(prefillPan || '');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

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
            setReferenceId(data.referenceId);
            setStatus('PROCESSING');
            setIsOpen(false);
            setPassword(''); // Clear sensitive field immediately
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        if (!referenceId) return;
        try {
            const res = await api.post('/external/itr/sync', { reference_id: referenceId });
            const data = res.data;

            if (data.status === 'COMPLETED') {
                setStatus('COMPLETED');
                setDocumentId(data.documentId || null);
                setExcelUrl(data.excel_url || null);  // Audit reference only
                toast.success('ITR analytics ready!');
                onComplete && onComplete({ documentId: data.documentId, excel_url: data.excel_url, analytics_payload: data.analytics_payload });
            } else if (data.status === 'FAILED') {
                setStatus('FAILED');
                toast.error('ITR analytics processing failed at provider');
            }
            // else still processing — the background poller below will check again automatically
        } catch (error) {
            console.error('[ITR auto-sync]', error.response?.data?.error || error.message);
        }
    };

    // Auto-poll while processing — no manual "Check Status" click needed.
    useEffect(() => {
        if (status !== 'PROCESSING') return;
        const interval = setInterval(handleSync, 15000);
        return () => clearInterval(interval);
    }, [status, referenceId]);

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
                    {/* Status Pill */}
                    {status === 'COMPLETED' ? (
                        <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Done
                        </span>
                    ) : status === 'PROCESSING' ? (
                        <span style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, border: '1px solid var(--warning)' }}>
                            Processing
                        </span>
                    ) : status === 'FAILED' ? (
                        <span style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600 }}>
                            Failed
                        </span>
                    ) : (
                        <span style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, border: '1px solid var(--warning)' }}>
                            Pending
                        </span>
                    )}

                    {/* Action Button */}
                    {status === 'PROCESSING' ? null : status === 'COMPLETED' ? (
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
                            ) : null}
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
                                style={{ backgroundColor: 'var(--bg-elevated)', border: 'none', textTransform: 'uppercase' }}
                            />
                        </FormField>
                        <FormField label="ITR Portal Password" required>
                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter portal password"
                                style={{ backgroundColor: 'var(--bg-elevated)', border: 'none', borderLeft: '3px solid var(--primary)' }}
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
