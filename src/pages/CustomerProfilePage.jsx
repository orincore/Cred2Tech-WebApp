import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerService } from '../api/customerService';
import { caseService } from '../api/caseService';
import api from '../api/axiosInstance';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const CustomerProfilePage = () => {
    const { customer_id } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [availability, setAvailability] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [profRaw, availRaw] = await Promise.all([
                    customerService.getCustomerProfile(customer_id),
                    customerService.getApiAvailability(customer_id)
                ]);
                setProfile(profRaw);
                setAvailability(availRaw);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [customer_id]);

    const handleFetchBureau = async (applicantId = null) => {
        if (!profile?.case_id) return toast.error("No active case found to run Bureau checks on.");
        try {
            setLoading(true);
            const res = await api.post(`/verification/bureau/run/${profile.case_id}`, { applicantId });
            if (res.data.status === 'SUCCESS') window.location.reload();
        } catch (e) {
            alert(e.response?.data?.error || "Bureau fetch failed");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    if (!profile) return <div className="p-8 text-center text-gray-500">Failed to map customer profile payload. Ensure DSA bindings map securely.</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <PageHeader
                title={`Profile: ${profile.customer_name}`}
                breadcrumbs={[{ label: 'Pipeline', path: '/customers' }, { label: profile.customer_name }]}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Entity KPI */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold border-b pb-3 mb-4">Entity Metadata</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><p className="text-sm text-gray-500">Industry</p><p className="font-medium text-sm">{profile.industry || '-'}</p></div>
                            <div><p className="text-sm text-gray-500">Entity Type</p><p className="font-medium text-sm">{profile.entity_type || '-'}</p></div>
                            <div><p className="text-sm text-gray-500">Vintage</p><p className="font-medium text-sm">{profile.business_vintage ? `${profile.business_vintage} Yrs` : '-'}</p></div>
                            <div><p className="text-sm text-gray-500">CIBIL Score</p><p className="font-medium text-sm text-primary-600">{profile.cibil_score || '-'}</p></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold border-b pb-3 mb-4">Pipeline Co-Borrowers</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-500 border-b">
                                    <tr>
                                        <th className="pb-2">Name / Entity</th>
                                        <th className="pb-2">Role</th>
                                        <th className="pb-2">PAN</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profile.co_borrowers?.length === 0 ? <tr><td colSpan="5" className="py-4 text-center text-gray-400">No Co-borrowers attached</td></tr> :
                                        profile.co_borrowers?.map((cb, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-3 font-medium">{cb.name}</td>
                                                <td className="py-3"><Badge type="gray" value={cb.role} /></td>
                                                <td className="py-3 text-gray-600">{cb.pan_masked || '-'}</td>
                                                <td className="py-3">
                                                    {cb.bureau_fetched ? <Badge color="success">Verified</Badge> : <Badge color="warning">Pending</Badge>}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <button
                                                        className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${cb.bureau_fetched ? 'text-gray-400 cursor-not-allowed' : 'text-primary-600 hover:bg-primary-50'}`}
                                                        onClick={() => handleFetchBureau(cb.id)}
                                                        disabled={cb.bureau_fetched || !availability?.can_pull_bureau}
                                                    >
                                                        {cb.bureau_fetched ? 'Pulled' : 'Run Bureau'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Status Array */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold border-b pb-3 mb-4">Data Pull Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">Bureau Pull</span>
                                    {profile.cibil_score && <span className="text-xs text-primary-600 font-semibold">Primary: {profile.cibil_score}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge color={profile.api_status?.bureau === 'COMPLETE' ? 'success' : profile.api_status?.bureau === 'PENDING' ? 'warning' : 'gray'}>
                                        {profile.api_status?.bureau}
                                    </Badge>
                                    {!profile.primary_applicant_bureau_fetched && availability?.can_pull_bureau && (
                                        <button
                                            className="text-[10px] bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 transition font-bold"
                                            onClick={() => handleFetchBureau(profile.primary_applicant_id)}
                                        >
                                            RUN
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                                <span className="font-medium text-sm">GST Fetch</span>
                                <Badge color={profile.api_status?.gst === 'COMPLETE' ? 'success' : profile.api_status?.gst === 'PENDING' ? 'warning' : 'gray'}>
                                    {profile.api_status?.gst}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                                <span className="font-medium text-sm">ITR Fetch</span>
                                <Badge color={profile.api_status?.itr === 'COMPLETE' ? 'success' : profile.api_status?.itr === 'PENDING' ? 'warning' : 'gray'}>
                                    {profile.api_status?.itr}
                                </Badge>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3">Instant Execution Actions</h4>
                            <div className="flex flex-col gap-2">
                                <button className="btn btn-primary w-full justify-center" onClick={handleFetchBureau} disabled={!availability?.can_pull_bureau}>
                                    Fetch Bureau Score
                                </button>
                                <button className="btn btn-primary w-full justify-center" disabled={!availability?.can_pull_gst}>
                                    Pull GST Reports
                                </button>
                            </div>
                            {availability?.bureau_reason && <p className="text-xs text-center text-gray-500 mt-2">{availability.bureau_reason}</p>}
                        </div>
                    </div>

                    {/* Activity Log Native Tracing */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-h-96 overflow-y-auto">
                        <h3 className="text-lg font-semibold border-b pb-3 mb-4">Historical Activity</h3>
                        {profile.activity_log?.length === 0 ? <p className="text-sm text-gray-500">No activity yet</p> :
                            <div className="space-y-4">
                                {profile.activity_log?.map((log, i) => (
                                    <div key={i} className="pl-4 border-l-2 border-primary-100">
                                        <p className="text-xs text-gray-400 mb-1">{new Date(log.timestamp).toLocaleString()}</p>
                                        <p className="text-sm font-medium">{log.activity_type.replace(/_/g, ' ')}</p>
                                        {log.description && <p className="text-xs text-gray-600 mt-1">{log.description}</p>}
                                    </div>
                                ))}
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};
export default CustomerProfilePage;
