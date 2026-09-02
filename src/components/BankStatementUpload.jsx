import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, UploadCloud, Plus, X, Download, Trash2 } from 'lucide-react';
import PullStatusTracker from './ui/PullStatusTracker';
import Skeleton from './ui/Skeleton';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';
import { useCasePullStatus, selectPullForApplicant, usePhaseTransition } from '../hooks/useCasePullStatus';

// Dev-only visibility into Signzy's statementanalysis/retrieve-work-order and
// download-report entitlement gap (confirmed broken on both preprod — bad
// credentials — and production — 403 not entitled — 2026-09-02). Never shown
// in a real production build; exists so the raw provider error is visible
// on-screen for a Signzy support escalation instead of only in server logs.
// Same pattern as EsrPage.jsx's IS_DEV_BUILD — import.meta.env.DEV alone
// misses the deployed dev server (still a production Vite build).
const IS_DEV_BUILD = import.meta.env.DEV || String(import.meta.env.VITE_API_BASE_URL || '').includes('dev.api.cred2tech.com');

const BankStatementUpload = ({ caseId, customerId, applicantId, applicantType, applicantName, walletBalance, analyzeCost, existingStatus, onComplete, mode, disabled = false }) => {
    // MSME self-service borrowers don't see wallet-credit costs (DSA concept)
    const isMsme = mode === 'MSME_SELF_SERVICE';
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    // Live server-pushed status for this case (see hooks/useCasePullStatus).
    // The server now owns the whole "analysing → generating report files →
    // ready" loop, including the retry that used to run here as AWAITING_LINKS,
    // so it keeps advancing while the user is elsewhere in the wizard.
    const { snapshot, refresh } = useCasePullStatus(caseId);
    const livePull = selectPullForApplicant(snapshot, 'bank', applicantId);

    // Local mirror, authoritative only until the first snapshot arrives.
    const [localStatus, setLocalStatus] = useState(existingStatus?.status || 'INITIATED');
    const [localReportId, setLocalReportId] = useState(existingStatus?.report_id || null);
    // documentIds: our internal stored file IDs — used for secure serving via /api/documents/:id
    const [localDocumentIds, setLocalDocumentIds] = useState({
        excel: existingStatus?.bank_excel_document_id || null,
        json: existingStatus?.bank_json_document_id || null,
    });
    // sourceUrls: vendor URLs kept as audit fallback only for pre-existing records
    const [localSourceUrls, setLocalSourceUrls] = useState({
        excel: existingStatus?.report_excel_url || null,
        json: existingStatus?.report_json_url || null,
    });

    const status = livePull?.status || localStatus;
    const reportId = livePull?.report_id || localReportId;
    // Dev-only — the background supervisor's own retrieveWorkOrder call
    // failing (socket.service.js's mergeVendorErrors), distinct from the
    // manual "Check now" failure captured in providerError below. Cleared
    // automatically server-side the moment a retry succeeds.
    const vendorSyncError = livePull?.vendor_error || null;
    const documentIds = livePull
        ? { excel: livePull.bank_excel_document_id || null, json: livePull.bank_json_document_id || null }
        : localDocumentIds;
    const sourceUrls = livePull
        ? { excel: livePull.report_excel_url || null, json: livePull.report_json_url || null }
        : localSourceUrls;
    const phase = livePull?.phase
        || (localStatus === 'COMPLETED' ? 'COMPLETED'
            : localStatus === 'FAILED' ? 'FAILED'
                : ['ANALYZING', 'PRE_ANALYZING'].includes(localStatus) ? 'PROCESSING' : 'NOT_STARTED');
    const phaseLabel = livePull?.label || '';
    const progress = livePull?.progress ?? 0;

    // existingStatus can legitimately arrive/update after this component's
    // first render (derived from the parent case's own async load) —
    // useState's initial value only applies once, so a late-arriving prop
    // would otherwise leave this stuck showing "not started" until a full page
    // reload re-mounts everything fresh. Only adopt it while nothing has
    // happened client-side yet, so it can never clobber in-progress local
    // state with a stale snapshot.
    useEffect(() => {
        if (!existingStatus || localReportId) return;
        setLocalStatus(existingStatus.status || 'INITIATED');
        setLocalReportId(existingStatus.report_id || null);
        setLocalDocumentIds({
            excel: existingStatus.bank_excel_document_id || null,
            json: existingStatus.bank_json_document_id || null,
        });
        setLocalSourceUrls({
            excel: existingStatus.report_excel_url || null,
            json: existingStatus.report_json_url || null,
        });
    }, [existingStatus, localReportId]);

    usePhaseTransition(livePull ? phase : null, {
        COMPLETED: () => toast.success('Bank analysis completed.'),
        FAILED: () => toast.error('Bank statement analysis failed at provider'),
    });

    const notifiedRef = React.useRef(false);
    useEffect(() => {
        if (phase !== 'COMPLETED' || notifiedRef.current) return;
        notifiedRef.current = true;
        onComplete && onComplete('COMPLETED', documentIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // Store physical file data
    const [files, setFiles] = useState([{ fileName: '', fileBase64: '', password: '' }]);
    const [loading, setLoading] = useState(false);

    // UI state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // Dev-only — raw Signzy error from the last failed retrieve-work-order/
    // download-report call, kept on screen (not just a transient toast) for
    // a Signzy support escalation. See IS_DEV_BUILD above.
    const [providerError, setProviderError] = useState(null);

    const handleFileChange = (index, field, value) => {
        const newFiles = [...files];
        newFiles[index][field] = value;
        setFiles(newFiles);
    };

    const handleFileUpload = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            const newFiles = [...files];
            newFiles[index].fileName = file.name;
            newFiles[index].fileBase64 = base64Data;
            setFiles(newFiles);
        };
    };

    const addFile = () => setFiles([...files, { fileName: '', fileBase64: '', password: '' }]);
    const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

    const handleAnalyze = async () => {
        const validFiles = files.filter(f => f.fileName && f.fileBase64);
        if (validFiles.length === 0) {
            return toast.error("Please select a physical PDF or Excel file to upload.");
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: customerId,
                case_id: caseId,
                applicant_id: applicantId,
                files: validFiles
            };

            const res = await api.post(`/external/bank/analyze`, payload);
            const data = res.data;

            toast.success("Bank Analysis Successfully Scheduled");
            setLocalReportId(data.bankRequest.report_id);
            setLocalStatus('ANALYZING');
            setIsUploadOpen(false); // Close the inline drop-down securely
            // Collapse the wait for the next server tick.
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!reportId) return;
        if (!window.confirm('Delete this bank statement analysis? You can upload a fresh one afterwards.')) return;
        setDeleting(true);
        try {
            await api.post('/external/bank/delete', { report_id: reportId });
            toast.success('Bank statement deleted');
            setLocalStatus('INITIATED');
            setLocalReportId(null);
            setLocalDocumentIds({ excel: null, json: null });
            setLocalSourceUrls({ excel: null, json: null });
            notifiedRef.current = false;
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete bank statement');
        } finally {
            setDeleting(false);
        }
    };

    // Manual escape hatch only. The provider can take minutes to finish
    // generating the report files after analysis itself completes; the server's
    // per-case supervisor now retries that automatically (and keeps retrying
    // while the user is on a different step), so this is no longer on a timer
    // here — it just lets someone force an immediate attempt.
    const fetchDownloads = async () => {
        try {
            const res = await api.post(`/external/bank/download`, { report_id: reportId });
            const data = res.data;

            if (res.status === 202 || data.success === false) {
                // Still generating — the server keeps retrying; nothing to do.
                return;
            }

            setProviderError(null);
            setLocalDocumentIds(data.documentIds || { excel: null, json: null });
            setLocalSourceUrls(data.sourceUrls || { excel: null, json: null });
            setLocalStatus('COMPLETED');
            refresh();
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
            if (IS_DEV_BUILD) {
                setProviderError({
                    endpoint: 'POST /external/bank/download → Signzy statementanalysis/retrieve-work-order + download-report',
                    status: error.response?.status,
                    message: error.response?.data?.error || error.message,
                });
            }
        }
    };

    const roleLabel = applicantType === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant';

    // `existingStatus` is a synchronous prop (the parent wizard already
    // awaited the case load before this ever mounts) — this is true on the
    // very first render in the normal case, no artificial delay. Guards the
    // rare tick where it genuinely hasn't arrived yet, showing a skeleton
    // instead of a default "Upload PDF" state that would otherwise flash
    // before snapping to the real one.
    if (existingStatus === undefined) {
        return (
            <div style={{ border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden', padding: isMobile ? '14px 16px' : '16px 24px' }}>
                <Skeleton width={140} height={13} style={{ marginBottom: 6 }} />
                <Skeleton width={90} height={11} />
            </div>
        );
    }

    // RENDER HORIZONTAL ROW
    return (
        <div style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--warning)', borderRadius: 0, overflow: 'hidden' }}>
            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(200px, 1fr) minmax(200px, 2fr) auto', gap: isMobile ? 10 : 16, alignItems: 'center', padding: isMobile ? '14px 16px' : '16px 24px', backgroundColor: 'var(--bg-base)' }}>
                {/* Left: Name and Type */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{applicantName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{roleLabel}</span>
                </div>

                

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>

                    {/* Live status — pushed from the server, animated while work is in flight */}
                    <PullStatusTracker phase={phase} label={phaseLabel} progress={progress} />

                    {/* Action Buttons */}
                    {status === 'COMPLETED' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* Prefer internal document IDs; fall back to source URL for legacy records */}
                            {(documentIds.excel || sourceUrls.excel) && (
                                documentIds.excel ? (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px' }}
                                        onClick={() => downloadDocument(documentIds.excel, 'bank_statement.xlsx').catch(e => toast.error(e.message))}
                                    >
                                        <Download size={14} /> Excel
                                    </button>
                                ) : (
                                    <a href={sourceUrls.excel} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px' }}>
                                        <Download size={14} /> Excel
                                    </a>
                                )
                            )}
                            {/* The provider is still generating the files. The server
                                retries on its own — this only forces an early attempt. */}
                            {(!documentIds.excel && !documentIds.json && !sourceUrls.excel && !sourceUrls.json) && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={fetchDownloads}>
                                    Check now
                                </button>
                            )}
                            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    ) : ['ANALYZING', 'PRE_ANALYZING'].includes(status) ? null : (
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setIsUploadOpen(!isUploadOpen)}
                            disabled={disabled}
                            title={disabled ? 'Live bank statement analysis is disabled for this test/injected case.' : undefined}
                        >
                            {isMsme ? 'Upload PDF' : `Upload PDF (~${analyzeCost} Cr)`}
                        </button>
                    )}
                </div>
            </div>

            {/* Dev-only diagnostic — Signzy retrieve-work-order/download-report
                entitlement gap, kept visible (not just a toast) for a vendor
                escalation. Never renders in a production build. */}
            {IS_DEV_BUILD && providerError && (
                <div style={{ margin: '0 16px 16px', padding: 12, borderRadius: 0, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontFamily: 'monospace', border: '1px dashed var(--error)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        [DEV ONLY] Signzy provider call failed (manual "Check now"){providerError.status ? ` — HTTP ${providerError.status}` : ''}
                    </div>
                    <div>{providerError.endpoint}</div>
                    <div style={{ marginTop: 4 }}>{providerError.message}</div>
                </div>
            )}

            {/* Dev-only diagnostic — the background supervisor's own
                retrieveWorkOrder polling failing, distinct from the manual
                "Check now" failure above. Same Signzy entitlement gap, but
                worth showing separately since this is the automatic path
                that runs with no user action at all. */}
            {IS_DEV_BUILD && vendorSyncError && (
                <div style={{ margin: '0 16px 16px', padding: 12, borderRadius: 0, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, fontFamily: 'monospace', border: '1px dashed var(--error)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        [DEV ONLY] Signzy provider call failed (background auto-sync){vendorSyncError.status ? ` — HTTP ${vendorSyncError.status}` : ''}
                    </div>
                    <div>Signzy statementanalysis/authenticate + retrieve-work-order (server-side, polled automatically)</div>
                    <div style={{ marginTop: 4 }}>{vendorSyncError.message}</div>
                </div>
            )}

            {/* Expando File UI (Only visible when isUploadOpen is true) */}
            {isUploadOpen && (
                <div style={{ padding: '24px', backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <UploadCloud size={18} color="var(--text-tertiary)" />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Upload Statements Securely</span>
                    </div>

                    {!isMsme && walletBalance < analyzeCost && (
                        <div style={{ padding: 12, borderRadius: 0, background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 16 }}>
                            <AlertCircle size={16} /> Insufficient credits. Wallet has {walletBalance}, needs {analyzeCost}.
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {files.map((file, index) => (
                            <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-base)', padding: 16, borderRadius: 0, border: '1px solid var(--border)' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Bank Statement</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.xlsx,.xls"
                                            className="form-control"
                                            onChange={e => handleFileUpload(index, e)}
                                            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', padding: '10px' }}
                                        />
                                        {file.fileName && <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>✓ Attached: {file.fileName}</div>}
                                    </div>

                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="PDF Password (Optional - if your bank locks the statement)"
                                        value={file.password}
                                        onChange={e => handleFileChange(index, 'password', e.target.value)}
                                    />
                                </div>
                                {files.length > 1 && (
                                    <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--error)', padding: '4px' }} onClick={() => removeFile(index)}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }} onClick={addFile}>
                            <Plus size={16} /> Add Another File
                        </button>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsUploadOpen(false)}>Cancel</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAnalyze} disabled={loading || (!isMsme && walletBalance < analyzeCost)}>
                                {loading ? 'Wait...' : isMsme ? 'Analyze' : `Analyze (~${analyzeCost} Cr)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankStatementUpload;
