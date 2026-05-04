import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, RefreshCw, FileText, Download } from 'lucide-react';
import FormField from './ui/FormField';
import api from '../api/axiosInstance';

const ItrPullForm = ({ caseId, customerId, prefillPan, walletBalance, itrCost, onComplete, existingItrProfile }) => {
    const [authType, setAuthType] = useState('PASSWORD');
    
    const [formData, setFormData] = useState({
        username: prefillPan || '',
        password: '',
        sessionId: ''
    });

    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState(existingItrProfile || null);

    const handlePullRequest = async () => {
        if (!formData.username) {
            return toast.error("ITR Username (PAN) is required");
        }
        if (authType === 'PASSWORD' && !formData.password) {
            return toast.error("Password is required");
        }
        if (authType === 'SESSION_ID' && !formData.sessionId) {
            return toast.error("Session ID is required");
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: customerId,
                case_id: caseId,
                username: formData.username
            };
            
            if (authType === 'PASSWORD') {
                payload.password = formData.password;
            } else {
                payload.sessionId = formData.sessionId;
            }

            const res = await api.post(`/external/itr/pull`, payload);
            const data = res.data;

            toast.success("ITR Data Pulled Successfully");
            setProfile(data.itrProfile);
            onComplete && onComplete(data.itrProfile);

            // Clear sensitive fields from state immediately
            setFormData(prev => ({...prev, password: '', sessionId: ''}));
        } catch (error) {
            toast.error(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    if (profile && profile.parsed_data) {
        const assessmentYears = Object.keys(profile.parsed_data || {});
        return (
            <div style={{ padding: 20, backgroundColor: 'var(--success-subtle)', borderRadius: 'var(--radius)', border: '1px solid #A5D6A7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2E7D32', fontWeight: 600, marginBottom: 16 }}>
                    <CheckCircle2 size={20} /> ITR Cached Successfully
                </div>
                
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#1B5E20' }}>Assessment Years Available</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {assessmentYears.length === 0 && <span style={{ fontSize: 13 }}>No historical years returned natively.</span>}
                    {assessmentYears.map(year => {
                        const yearData = profile.parsed_data[year];
                        return (
                            <div key={year} style={{ padding: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 6, border: '1px solid #C8E6C9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#1B5E20' }}>
                                    AY {year}
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {yearData?.form && (
                                        <a href={yearData.form} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ backgroundColor: 'white', color: '#1B5E20', borderColor: '#A5D6A7' }}>
                                            <FileText size={14} style={{ marginRight: 6 }} /> View PDF
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             {walletBalance < itrCost && (
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600}}>
                    <AlertCircle size={16} /> Insufficient credits to pull ITR. Wallet has {walletBalance}, needs {itrCost}.
                </div>
            )}
            
            <FormField label="ITR Username / PAN" required>
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toUpperCase()})} className="form-control" placeholder="ABCDE1234F" />
            </FormField>

            <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                        <input type="radio" name="itrAuthType" value="PASSWORD" checked={authType === 'PASSWORD'} onChange={() => setAuthType('PASSWORD')} />
                        Portal Password
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                        <input type="radio" name="itrAuthType" value="SESSION_ID" checked={authType === 'SESSION_ID'} onChange={() => setAuthType('SESSION_ID')} />
                        Session ID
                    </label>
                </div>

                {authType === 'PASSWORD' ? (
                    <FormField label="Portal Password" required>
                        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-control" placeholder="Enter password" />
                    </FormField>
                ) : (
                    <FormField label="Existing Session ID" required>
                        <input type="text" value={formData.sessionId} onChange={e => setFormData({...formData, sessionId: e.target.value})} className="form-control" placeholder="Enter session token" />
                    </FormField>
                )}
            </div>

            <button type="button" className="btn btn-secondary" style={{ width: 'fit-content', marginTop: 8 }} onClick={handlePullRequest} disabled={loading || walletBalance < itrCost}>
                {loading ? 'Processing Extractor...' : `💳 Execute Pull (~${itrCost} Credits)`}
            </button>
        </div>
    );
};

export default ItrPullForm;
