import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    CheckCircle2, AlertCircle, RefreshCw,
    FileText, ChevronDown, ChevronUp, X, Download
} from 'lucide-react';
import FormField from './ui/FormField';
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
    onComplete
}) => {
    const [status, setStatus] = useState(existingRecord?.status || 'INITIATED');
    const [referenceId, setReferenceId] = useState(existingRecord?.reference_id || null);
    // documentId is the internal stored file ID — use this for secure serving
    const [documentId, setDocumentId] = useState(existingRecord?.itr_document_id || null);
    // excelUrl kept only for audit/fallback display, NOT used for download
    const [excelUrl, setExcelUrl] = useState(existingRecord?.excel_url || null);
    const [analyticsPayload, setAnalyticsPayload] = useState(existingRecord?.analytics_payload || null);

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
        setLoading(true);
        try {
            const res = await api.post('/external/itr/sync', { reference_id: referenceId });
            const data = res.data;

            if (data.status === 'COMPLETED') {
                setStatus('COMPLETED');
                setDocumentId(data.documentId || null);
                setExcelUrl(data.excel_url || null);  // Audit reference only
                setAnalyticsPayload(data.analytics_payload);
                toast.success('ITR analytics ready!');
                onComplete && onComplete({ documentId: data.documentId, excel_url: data.excel_url, analytics_payload: data.analytics_payload });
            } else if (data.status === 'FAILED') {
                setStatus('FAILED');
                toast.error('ITR analytics processing failed at provider');
            } else {
                toast('Still processing... try again shortly', { icon: '⏳' });
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Extract key analytics summary for display
    const getSummary = () => {
        if (!analyticsPayload) return null;
        try {
            const itr = analyticsPayload?.iTR;
            const plStatements = itr?.profitAndLossStatement?.profitAndLossStatement || [];
            const taxCalcs = itr?.taxCalculation?.taxCalculation || [];
            const salaryList = itr?.taxDetails?.incomeFromSalary || [];
            const latest = plStatements[plStatements.length - 1];
            const latestTax = taxCalcs[taxCalcs.length - 1];
            const latestSalary = salaryList[salaryList.length - 1];

            return {
                revenue: latest?.revenueFromOperations,
                profit: latest?.profitAfterTax,
                taxableIncome: latestTax?.totalTaxableIncome,
                grossIncome: latestTax?.grossTotalIncome,
                salaryIncome: latestSalary?.grossSalary,
                year: latest?.year || latestTax?.year
            };
        } catch {
            return null;
        }
    };

    const summary = status === 'COMPLETED' ? getSummary() : null;

    const formatINR = (val) => {
        if (val == null || val === '') return '—';
        return `₹${Number(val).toLocaleString('en-IN')}`;
    };

    return (
        <div style={{
            backgroundColor: 'var(--bg-base)',
            border: `1px solid ${status === 'COMPLETED' ? '#86efac' : status === 'FAILED' ? '#fca5a5' : status === 'PROCESSING' ? '#fcd34d' : '#e2e8f0'}`,
            borderRadius: 'var(--radius)',
            overflow: 'hidden'
        }}>
            {/* Summary Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1fr) minmax(200px, 2fr) auto',
                gap: 16,
                alignItems: 'center',
                padding: '16px 24px'
            }}>
                {/* Left: Name & Role */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{applicantName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{roleLabel}</span>
                </div>

                {/* Middle: Status description */}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {status === 'INITIATED' && 'No ITR analytics fetched yet'}
                    {status === 'PROCESSING' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <RefreshCw size={13} color="#92400e" />
                            Processing... click "Check Status" when ready
                        </span>
                    )}
                    {status === 'COMPLETED' && summary && (
                        <span style={{ color: '#166534' }}>
                            Taxable Income: {formatINR(summary.taxableIncome || summary.salaryIncome)}
                            {summary.profit != null && ` · Profit: ${formatINR(summary.profit)}`}
                            {summary.year && ` (FY ${summary.year})`}
                        </span>
                    )}
                    {status === 'COMPLETED' && !summary && 'Analytics ready — view details below'}
                    {status === 'FAILED' && <span style={{ color: 'var(--error)' }}>Analysis failed. You may retry.</span>}
                </div>

                {/* Right: Pills + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                    {/* Status Pill */}
                    {status === 'COMPLETED' ? (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Done
                        </span>
                    ) : status === 'PROCESSING' ? (
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #fde68a' }}>
                            Processing
                        </span>
                    ) : status === 'FAILED' ? (
                        <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                            Failed
                        </span>
                    ) : (
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #fde68a' }}>
                            Pending
                        </span>
                    )}

                    {/* Action Button */}
                    {status === 'PROCESSING' ? (
                        <button
                            type="button"
                            style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', border: '1px solid', padding: '6px 16px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                            onClick={handleSync}
                            disabled={loading}
                        >
                            {loading ? '...' : 'Check Status'}
                        </button>
                    ) : status === 'COMPLETED' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            {documentId ? (
                                <button
                                    type="button"
                                    style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => downloadDocument(documentId, `itr_analytics.xlsx`).catch(e => toast.error('Download failed: ' + e.message))}
                                >
                                    <Download size={13} /> Excel
                                </button>
                            ) : excelUrl ? (
                                // Fallback for records ingested before document storage was implemented
                                <a href={excelUrl} target="_blank" rel="noreferrer" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FileText size={13} /> Excel
                                </a>
                            ) : null}
                            <button
                                type="button"
                                style={{ backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                                onClick={() => setIsOpen(!isOpen)}
                            >
                                {isOpen ? 'Hide' : 'View Details'}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '6px 20px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {status === 'FAILED' ? 'Retry' : 'Fetch ITR'}
                        </button>
                    )}
                </div>
            </div>

            {/* Expando: Input Form OR Analytics Summary */}
            {isOpen && (
                <div style={{ padding: 24, backgroundColor: '#f8fafc', borderTop: '1px solid var(--border)' }}>
                    {status !== 'COMPLETED' ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Enter ITR Portal Credentials</span>
                                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setIsOpen(false)}>
                                    <X size={16} />
                                </button>
                            </div>

                            {walletBalance < itrCost && (
                                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 16 }}>
                                    <AlertCircle size={16} /> Insufficient credits. Wallet: {walletBalance}, Required: {itrCost}.
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-base)', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <FormField label="PAN / ITR Username" required>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={pan}
                                        onChange={e => setPan(e.target.value.toUpperCase())}
                                        placeholder="ABCDE1234F"
                                        style={{ backgroundColor: '#f1f5f9', border: 'none', textTransform: 'uppercase' }}
                                    />
                                </FormField>
                                <FormField label="ITR Portal Password" required>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter portal password"
                                        style={{ backgroundColor: '#f1f5f9', border: 'none', borderLeft: '3px solid #7c3aed' }}
                                    />
                                </FormField>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                                <button type="button" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }} onClick={() => setIsOpen(false)}>Cancel</button>
                                <button
                                    type="button"
                                    style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '8px 24px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: (loading || walletBalance < itrCost) ? 0.6 : 1 }}
                                    onClick={handleAnalyze}
                                    disabled={loading || walletBalance < itrCost}
                                >
                                    {loading ? 'Submitting...' : `Analyze (~${itrCost} Cr)`}
                                </button>
                            </div>
                        </>
                    ) : (
                        // Analytics Summary Panel
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--text-primary)' }}>ITR Analytics Summary</div>
                            {summary && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                                    {[
                                        { label: 'Gross Total Income', value: formatINR(summary.grossIncome) },
                                        { label: 'Taxable Income', value: formatINR(summary.taxableIncome) },
                                        { label: 'Revenue from Ops', value: formatINR(summary.revenue) },
                                        { label: 'Profit After Tax', value: formatINR(summary.profit) },
                                        { label: 'Salary Income', value: formatINR(summary.salaryIncome) },
                                        { label: 'Assessment Year', value: summary.year ? `FY ${summary.year}` : '—' }
                                    ].map(item => (
                                        <div key={item.label} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {documentId ? (
                                <button
                                    type="button"
                                    onClick={() => downloadDocument(documentId, 'itr_analytics.xlsx').catch(e => toast.error('Download failed: ' + e.message))}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                                >
                                    <Download size={14} /> Download Full Excel Report
                                </button>
                            ) : excelUrl ? (
                                // Fallback for records without document storage
                                <a href={excelUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                                    <FileText size={14} /> Download Full Excel Report
                                </a>
                            ) : null}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ItrAnalyticsForm;
