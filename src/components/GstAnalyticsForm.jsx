import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, RefreshCw, FileText, Download } from 'lucide-react';
import FormField from './ui/FormField';
import api from '../api/axiosInstance';
import { downloadDocument } from '../api/documentHelper';

const GstAnalyticsForm = ({ caseId, customerId, onComplete }) => {
    const [mode, setMode] = useState('IN_SYSTEM');
    const [authType, setAuthType] = useState('OTP');
    
    const [formData, setFormData] = useState({
        gstin: '',
        username: '',
        password: '',
        from_date: '042022',
        to_date: '032025',
        emails: '',
        mobile_numbers: ''
    });

    const [activeRequests, setActiveRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [otpInputs, setOtpInputs] = useState({}); // mapped by requestId

    useEffect(() => {
        if (caseId) {
            fetchRequests();
        }
    }, [caseId]);

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
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitOtp = async (requestId) => {
        const otp = otpInputs[requestId];
        if (!otp) return toast.error("Enter OTP");

        setLoading(true);
        try {
            await api.post(`/external/gst/submit-otp`, { request_id: requestId, otp });

            toast.success("OTP Verified. Authorizing sync...");
            await fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (requestId) => {
        setLoading(true);
        try {
            const res = await api.post(`/external/gst/sync`, { request_id: requestId });
            const data = res.data;

            if (data.dataSynced || data.status === 'REPORT_READY') {
                toast.success("Data synced successfully!");
            } else {
                toast("Status: " + data.status, { icon: 'ℹ️' });
            }
            await fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
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
                <FormField label="GSTIN" required>
                    <input type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})} className="form-control" placeholder="12ABCDE3456X7YZ" />
                </FormField>
                
                {mode === 'IN_SYSTEM' && (
                    <FormField label="GST Username" required>
                        <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="form-control" />
                    </FormField>
                )}
                
                <FormField label="From Date (MMYYYY)" required>
                    <input type="text" value={formData.from_date} onChange={e => setFormData({...formData, from_date: e.target.value})} className="form-control" placeholder="042022" />
                </FormField>
                
                <FormField label="To Date (MMYYYY)" required>
                    <input type="text" value={formData.to_date} onChange={e => setFormData({...formData, to_date: e.target.value})} className="form-control" placeholder="032025" />
                </FormField>
            </div>

            {mode === 'IN_SYSTEM' && (
                 <div style={{ display: 'flex', gap: 16, marginBottom: 16, background: 'var(--bg-elevated)', padding: 16, borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                                <input type="radio" name="authType" value="OTP" checked={authType === 'OTP'} onChange={() => setAuthType('OTP')} />
                                OTP Mode
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                                <input type="radio" name="authType" value="PASSWORD" checked={authType === 'PASSWORD'} onChange={() => setAuthType('PASSWORD')} />
                                Password Mode
                            </label>
                        </div>
                        {authType === 'PASSWORD' && (
                             <FormField label="GST Password" required>
                                 <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-control" />
                             </FormField>
                        )}
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

            {activeRequests.length > 0 && (
                <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 20 }}>Active GST Journeys</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {activeRequests.map(req => (
                            <div key={req.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: req.status === 'REPORT_READY' || req.status === 'COMPLETED' ? 'var(--success-subtle)' : 'var(--bg-surface)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {req.gstin} 
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textTransform: 'uppercase' }}>{req.mode}</span>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--primary)', color: 'white' }}>{req.status}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {new Date(req.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{req.provider_message}</p>
                                
                                {req.mode === 'AUTH_LINK' && req.auth_link && ['AUTH_LINK_CREATED', 'INITIATED'].includes(req.status) && (
                                    <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 13 }}>
                                        <strong>Link: </strong> <a href={req.auth_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{req.auth_link}</a>
                                        <p style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>Awaiting webhook callback once customer completes auth.</p>
                                    </div>
                                )}

                                {req.status === 'OTP_PENDING' && req.auth_type === 'OTP' && (
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                        <input type="text" placeholder="Enter OTP from Portal" className="form-control" value={otpInputs[req.id] || ''} onChange={e => setOtpInputs({...otpInputs, [req.id]: e.target.value})} style={{ maxWidth: 200 }} />
                                        <button type="button" className="btn btn-secondary" onClick={() => handleSubmitOtp(req.id)} disabled={loading}>Submit OTP</button>
                                    </div>
                                )}

                                {['PROCESSING', 'DATA_READY', 'CALLBACK_RECEIVED'].includes(req.status) && (
                                    <div style={{ marginBottom: 12 }}>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSync(req.id)} disabled={loading}>
                                            <RefreshCw size={14} style={{ marginRight: 6 }} /> Manual Sync / Poll Data
                                        </button>
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
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GstAnalyticsForm;
