import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react';
import FormField from './ui/FormField';
import PullingIndicator from './ui/PullingIndicator';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';

const MONTHS = [
    { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
    { v: '04', l: 'Apr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
    { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' }, { v: '09', l: 'Sep' },
    { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' }
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => (CURRENT_YEAR - 4 + i).toString());

// Default GST pull window: the latest 2 years (24 months), ending this month —
// not a fixed historical range that goes stale as time passes.
const now = new Date();
const DEFAULT_TO_MONTH = String(now.getMonth() + 1).padStart(2, '0');
const DEFAULT_TO_YEAR = String(now.getFullYear());
const DEFAULT_FROM_MONTH = DEFAULT_TO_MONTH;
const DEFAULT_FROM_YEAR = String(now.getFullYear() - 2);

const GstAnalyticsForm = ({ caseId, customerId, linkedGstins = [], onComplete }) => {
    const [mode, setMode] = useState('IN_SYSTEM');
    const authType = 'PASSWORD';
    const [isManualGstin, setIsManualGstin] = useState(false);

    const [fromMonth, setFromMonth] = useState(DEFAULT_FROM_MONTH);
    const [fromYear, setFromYear] = useState(DEFAULT_FROM_YEAR);
    const [toMonth, setToMonth] = useState(DEFAULT_TO_MONTH);
    const [toYear, setToYear] = useState(DEFAULT_TO_YEAR);

    const [formData, setFormData] = useState({
        gstin: '',
        username: '',
        password: '',
        from_date: `${DEFAULT_FROM_MONTH}${DEFAULT_FROM_YEAR}`,
        to_date: `${DEFAULT_TO_MONTH}${DEFAULT_TO_YEAR}`,
        emails: '',
        mobile_numbers: ''
    });

    const [activeRequests, setActiveRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const activeRequestsRef = useRef(activeRequests);

    useEffect(() => {
        activeRequestsRef.current = activeRequests;
    }, [activeRequests]);

    useEffect(() => {
        if (caseId) {
            fetchRequests();
        }
    }, [caseId]);

    // Auto-poll pending GST journeys in the background — no manual "check status" needed.
    useEffect(() => {
        if (!caseId) return;
        let cancelled = false;

        const tick = async () => {
            const pollable = activeRequestsRef.current.filter(r => ['PROCESSING', 'DATA_READY', 'CALLBACK_RECEIVED'].includes(r.status));
            await Promise.allSettled(pollable.map(r => silentSync(r.id)));
            if (!cancelled) timeoutId = setTimeout(tick, 15000);
        };

        let timeoutId = setTimeout(tick, 15000);
        return () => { cancelled = true; clearTimeout(timeoutId); };
    }, [caseId]);

    useEffect(() => {
        if (linkedGstins && linkedGstins.length > 0 && !formData.gstin) {
            const activeGstin = linkedGstins.find(g => g.status === 'Active')?.gstin || linkedGstins[0].gstin;
            setFormData(prev => ({ ...prev, gstin: activeGstin }));
        }
    }, [linkedGstins]);

    useEffect(() => {
        setFormData(prev => ({ ...prev, from_date: `${fromMonth}${fromYear}`, to_date: `${toMonth}${toYear}` }));
    }, [fromMonth, fromYear, toMonth, toYear]);

    const fetchRequests = async () => {
        try {
            const res = await api.get(`/external/gst/requests?case_id=${caseId}`);
            if (res.data.success) {
                setActiveRequests(res.data.data);
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

        setLoading(true);
        try {
            const payload = {
                customer_id: customerId,
                case_id: caseId,
                mode: mode,
                auth_type: mode === 'IN_SYSTEM' ? authType : null,
                gstin: formData.gstin,
                username: formData.username,
                password: formData.password,
                from_date: formData.from_date,
                to_date: formData.to_date,
                emails: formData.emails ? formData.emails.split(',').map(s => s.trim()) : [],
                mobile_numbers: formData.mobile_numbers ? formData.mobile_numbers.split(',').map(s => s.trim()) : [],
                pdf_url: true,
                entity_details: true
            };
            await api.post(`/external/gst/create`, payload);

            toast.success("GST Request initiated successfully");
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

    // Background poll — does not touch the shared `loading` flag so it never disables the
    // "Initialize GST Request" button, and only surfaces a toast once there's real news.
    const silentSync = async (requestId) => {
        try {
            const res = await api.post(`/external/gst/sync`, { request_id: requestId });
            const data = res.data;

            if (data.dataSynced || data.status === 'REPORT_READY') {
                toast.success("GST report ready!");
            }
            await fetchRequests();
        } catch (error) {
            console.error('[GST auto-sync]', error.response?.data?.error || error.message);
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Initiate New GST Journey</h4>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="gstMode" value="IN_SYSTEM" checked={mode === 'IN_SYSTEM'} onChange={() => setMode('IN_SYSTEM')} />
                    Enter Details in System
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="gstMode" value="AUTH_LINK" checked={mode === 'AUTH_LINK'} onChange={() => setMode('AUTH_LINK')} />
                    Send Auth Link to Customer
                </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                                        {g.gstin} ({g.registration_name || 'No Name'}) - {g.status}
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
                        <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="form-control" placeholder="GST portal username" />
                    </FormField>
                )}
                
                <FormField label="From Date" required>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-control" value={fromMonth} onChange={e => setFromMonth(e.target.value)} style={{ flex: 1 }}>
                            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <select className="form-control" value={fromYear} onChange={e => setFromYear(e.target.value)} style={{ flex: 1 }}>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </FormField>

                <FormField label="To Date" required>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-control" value={toMonth} onChange={e => setToMonth(e.target.value)} style={{ flex: 1 }}>
                            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <select className="form-control" value={toYear} onChange={e => setToYear(e.target.value)} style={{ flex: 1 }}>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </FormField>
            </div>

            {mode === 'IN_SYSTEM' && (
                 <div style={{ display: 'flex', gap: 16, marginBottom: 16, background: 'var(--bg-elevated)', padding: 16, borderRadius: 0 }}>
                    <div style={{ flex: 1 }}>
                         <FormField label="GST Password" required>
                             <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-control" placeholder="GST portal password" />
                         </FormField>
                    </div>
                </div>
            )}

            {mode === 'AUTH_LINK' && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                     <FormField label="Target Emails (comma separated)">
                        <input type="text" value={formData.emails} onChange={e => setFormData({...formData, emails: e.target.value})} className="form-control" placeholder="user@biz.com" />
                     </FormField>
                     <FormField label="Target Mobile Numbers (comma separated)">
                        <input type="text" value={formData.mobile_numbers} onChange={e => setFormData({...formData, mobile_numbers: e.target.value})} className="form-control" placeholder="9876543210" />
                     </FormField>
                 </div>
            )}

            <button type="button" onClick={handleCreateRequest} disabled={loading || !formData.gstin} className="btn btn-primary" style={{ marginBottom: 32 }}>
                {loading ? 'Creating...' : 'Initialize GST Request (~1 Credit)'}
            </button>

            {activeRequests.filter(req => !(req.auth_type === 'OTP' && req.status === 'OTP_PENDING')).length > 0 && (
                <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 20 }}>Active GST Journeys</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {activeRequests.filter(req => !(req.auth_type === 'OTP' && req.status === 'OTP_PENDING')).map(req => {
                            const isFinal = req.status === 'REPORT_READY' || req.status === 'COMPLETED';
                            const isWaitingForCustomer = req.mode === 'AUTH_LINK' && req.auth_link && ['AUTH_LINK_CREATED', 'INITIATED'].includes(req.status);
                            return (
                            <div key={req.id} style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 16, background: isFinal ? 'var(--success-subtle)' : 'var(--bg-surface)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {req.gstin}
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textTransform: 'uppercase' }}>{req.mode}</span>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 0, background: 'var(--primary)', color: 'white' }}>{req.status}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {new Date(req.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{req.provider_message}</p>

                                {isWaitingForCustomer && (
                                    <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 0, fontSize: 13 }}>
                                        <strong>Link: </strong> <a href={req.auth_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{req.auth_link}</a>
                                        <p style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>Awaiting webhook callback once customer completes auth.</p>
                                    </div>
                                )}

                                {!isFinal && !isWaitingForCustomer && (
                                    <div style={{ marginBottom: 12 }}>
                                        <PullingIndicator label="Pulling your GST information…" />
                                    </div>
                                )}

                                {(req.status === 'REPORT_READY' || req.status === 'COMPLETED') && (
                                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
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

                                        {/* JSON */}
                                        {req.gst_json_document_id ? (
                                            <button type="button" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                                onClick={() => downloadDocument(req.gst_json_document_id, `gst_${req.gstin}.json`).catch(e => toast.error(e.message))}>
                                                <Download size={14} /> Raw JSON
                                            </button>
                                        ) : req.report_json_url ? (
                                            <a href={req.report_json_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Download size={14} /> Raw JSON
                                            </a>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );})}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GstAnalyticsForm;
