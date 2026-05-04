import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, RefreshCw, UploadCloud, FileText, Briefcase, Plus, X, Download } from 'lucide-react';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';

const BankStatementUpload = ({ caseId, customerId, applicantId, applicantType, applicantName, walletBalance, analyzeCost, existingStatus, onComplete }) => {
    const [status, setStatus] = useState(existingStatus?.status || 'INITIATED');
    const [reportId, setReportId] = useState(existingStatus?.report_id || null);
    // documentIds: our internal stored file IDs — used for secure serving via /api/documents/:id
    const [documentIds, setDocumentIds] = useState({
        excel: existingStatus?.bank_excel_document_id || null,
        json: existingStatus?.bank_json_document_id || null,
    });
    // sourceUrls: vendor URLs kept as audit fallback only for pre-existing records
    const [sourceUrls, setSourceUrls] = useState({
        excel: existingStatus?.report_excel_url || null,
        json: existingStatus?.report_json_url || null,
    });

    // Store physical file data
    const [files, setFiles] = useState([{ fileName: '', fileBase64: '', password: '' }]);
    const [loading, setLoading] = useState(false);

    // UI state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [downloadAttempted, setDownloadAttempted] = useState(false);

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
            setReportId(data.bankRequest.report_id);
            setStatus('ANALYZING');
            setIsUploadOpen(false); // Close the inline drop-down securely
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const pollStatus = async () => {
        try {
            setLoading(true);
            const res = await api.post(`/external/bank/sync`, { report_id: reportId });
            const data = res.data;

            setStatus(data.status);
            if (data.status === 'COMPLETED') {
                toast.success("Bank Analysis processing completed.");
                await fetchDownloads();
            } else if (data.status === 'FAILED') {
                toast.error(`Analysis failed at provider: ${data.rawStatus || 'Unknown Error'}`);
            }
        } catch (error) {
            console.error("Sync error:", error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDownloads = async () => {
        setStatus('LOADING_LINKS');
        try {
            const res = await api.post(`/external/bank/download`, { report_id: reportId });
            const data = res.data;

            if (res.status === 202 || data.success === false) {
                setStatus('COMPLETED'); // Keep state as COMPLETED so button remains
                toast(data.message || 'Report is still generating. Please click Fetch Reports again in a few minutes.', {
                    icon: '⏳',
                });
                return;
            }

            // Prefer internal document IDs for serving — fall back to source URLs for old records
            setDocumentIds(data.documentIds || { excel: null, json: null });
            setSourceUrls(data.sourceUrls || { excel: null, json: null });
            setStatus('COMPLETED');
            onComplete && onComplete('COMPLETED', data.documentIds);
        } catch (error) {
            setStatus('FAILED_DOWNLOAD');
            toast.error(error.response?.data?.error || error.message);
        }
    };

    const roleLabel = applicantType === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant';

    // RENDER HORIZONTAL ROW
    return (
        <div style={{ backgroundColor: 'var(--bg-base)', border: '1px solid #f97316', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 2fr) auto', gap: 16, alignItems: 'center', padding: '16px 24px', backgroundColor: 'var(--bg-base)' }}>
                {/* Left: Name and Type */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{applicantName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{roleLabel}</span>
                </div>

                {/* Middle: State indicator */}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {status === 'INITIATED' && "No statement uploaded yet"}
                    {status === 'ANALYZING' && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} className="spin" color="var(--warning)" /> Auto-Scanning Statements...</span>}
                    {status === 'FAILED' && <span style={{ color: 'var(--error)' }}>Failed to process. Try again.</span>}
                    {status === 'FAILED_DOWNLOAD' && <span style={{ color: 'var(--error)' }}>Analysis Complete but Failed to retrieve secure links.</span>}
                    {status === 'COMPLETED' && "Statement processed and analysed"}
                    {status === 'LOADING_LINKS' && "Retrieving secure reports..."}
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>

                    {/* Status Pills */}
                    {(status === 'COMPLETED' || status === 'FAILED_DOWNLOAD') ? (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> Uploaded
                        </span>
                    ) : (
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #fde68a' }}>
                            {status === 'ANALYZING' ? 'Processing' : 'Pending'}
                        </span>
                    )}

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
                            {(documentIds.json || sourceUrls.json) && (
                                documentIds.json ? (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', color: '#64748b' }}
                                        onClick={() => downloadDocument(documentIds.json, 'bank_statement.json').catch(e => toast.error(e.message))}
                                    >
                                        <FileText size={14} /> JSON
                                    </button>
                                ) : (
                                    <a href={sourceUrls.json} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', color: '#64748b' }}>
                                        <FileText size={14} /> JSON
                                    </a>
                                )
                            )}
                            {(!documentIds.excel && !documentIds.json && !sourceUrls.excel && !sourceUrls.json) && (
                                <button type="button" className="btn btn-primary btn-sm" style={{ fontWeight: 600 }} onClick={fetchDownloads} disabled={loading}>
                                    {loading ? 'Fetching...' : 'Fetch Reports'}
                                </button>
                            )}
                            <button type="button" className="btn btn-secondary btn-sm" style={{ fontWeight: 600, backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }} onClick={() => setIsUploadOpen(!isUploadOpen)}>
                                Replace
                            </button>
                        </div>
                    ) : status === 'FAILED_DOWNLOAD' ? (
                        <button type="button" className="btn btn-sm" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 600 }} onClick={() => { setDownloadAttempted(false); fetchDownloads(); }} disabled={loading}>
                            {loading ? '...' : 'Retry Download'}
                        </button>
                    ) : status === 'ANALYZING' ? (
                        <button type="button" className="btn btn-sm" style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', fontWeight: 600 }} onClick={pollStatus} disabled={loading}>
                            {loading ? '...' : 'Check Status'}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary btn-sm" style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', padding: '6px 20px', borderRadius: 6, fontWeight: 600 }} onClick={() => setIsUploadOpen(!isUploadOpen)}>
                            Upload PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Expando File UI (Only visible when isUploadOpen is true) */}
            {isUploadOpen && (
                <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <UploadCloud size={18} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Upload Statements Securely</span>
                    </div>

                    {walletBalance < analyzeCost && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 16 }}>
                            <AlertCircle size={16} /> Insufficient credits. Wallet has {walletBalance}, needs {analyzeCost}.
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {files.map((file, index) => (
                            <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-base)', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Bank Statement</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.xlsx,.xls"
                                            className="form-control"
                                            onChange={e => handleFileUpload(index, e)}
                                            style={{ backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', padding: '10px' }}
                                        />
                                        {file.fileName && <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>✓ Attached: {file.fileName}</div>}
                                    </div>

                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="PDF Password (Optional - if your bank locks the statement)"
                                        value={file.password}
                                        onChange={e => handleFileChange(index, 'password', e.target.value)}
                                        style={{ backgroundColor: '#f1f5f9', border: 'none', borderLeft: '3px solid #fcd34d' }}
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
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }} onClick={addFile}>
                            <Plus size={16} /> Add Another File
                        </button>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsUploadOpen(false)}>Cancel</button>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: '#cbd5e1', backgroundColor: '#ffffff', color: '#334155' }} onClick={handleAnalyze} disabled={loading || walletBalance < analyzeCost}>
                                {loading ? 'Wait...' : `Analyze (~${analyzeCost} Cr)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankStatementUpload;
