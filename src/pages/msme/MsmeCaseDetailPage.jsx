import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, UploadCloud, FileText, Download, User2 } from 'lucide-react';
import { caseService } from '../../api/caseService';
import { listDocuments, downloadDocument, uploadDocument } from '../../api/documentHelper';
import { formatCompactINR, CASE_STAGE_LABELS } from '../../utils/helpers';
import SectionCard from '../../components/ui/SectionCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import TravelingBorderButton from '../../components/TravelingBorderButton';

// Labels come from CASE_STAGE_LABELS (the exact same mapping the DSA side
// uses) so a case never shows a different-looking status depending on who's
// viewing it — desc/color here are purely additive context for the customer.
const STAGE_INFO = {
  DRAFT: { desc: 'Your application is in progress — complete it to continue.', color: 'var(--text-tertiary)' },
  LEAD_CREATED: { desc: "We've received your application and will begin processing it shortly.", color: 'var(--info)' },
  DATA_COLLECTION: { desc: "We're collecting and verifying your business and financial information.", color: 'var(--info)' },
  INCOME_REVIEWED: { desc: 'Your income details have been reviewed.', color: 'var(--info)' },
  ESR_GENERATED: { desc: "We've matched your profile with our lending partners.", color: 'var(--info)' },
  LEAD_SENT_TO_LENDER: { desc: 'Your application has been forwarded to the lender for review.', color: 'var(--warning)' },
  IN_REVIEW: { desc: 'The lender is currently reviewing your application.', color: 'var(--warning)' },
  APPROVED: { desc: 'Congratulations — your loan has been approved!', color: 'var(--success)' },
  REJECTED: { desc: "Unfortunately, your application wasn't approved this time.", color: 'var(--error)' },
  DISBURSED: { desc: 'Your loan amount has been disbursed.', color: 'var(--success)' },
  PARTLY_DISBURSED: { desc: 'Part of your loan amount has been disbursed so far.', color: 'var(--success)' },
  CLOSED: { desc: 'This case has been closed.', color: 'var(--text-tertiary)' },
};

const DOC_TYPES = [
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'PROPERTY_DOCUMENT', label: 'Property Document' },
  { value: 'SALE_DEED', label: 'Sale Deed' },
  { value: 'SALARY_SLIP', label: 'Salary Slip' },
  { value: 'OTHER', label: 'Other' },
];

const MsmeCaseDetailPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [caseData, setCaseData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [uploadType, setUploadType] = useState('OTHER');

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [c, docs] = await Promise.all([
        caseService.getCaseById(caseId),
        listDocuments({ caseId }),
      ]);
      setCaseData(c);
      setDocuments(docs);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Cred2Tech | Case Status';
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error('File is too large — max 15MB.');
    setUploading(true);
    try {
      await uploadDocument(file, caseId, uploadType);
      toast.success('Document uploaded');
      const docs = await listDocuments({ caseId });
      setDocuments(docs);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      await downloadDocument(doc.id, doc.original_file_name);
    } catch (err) {
      toast.error('Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  if (!caseData) return null;

  const stageMeta = STAGE_INFO[caseData.stage] || { desc: '', color: 'var(--text-tertiary)' };
  const stage = { ...stageMeta, label: CASE_STAGE_LABELS[caseData.stage] || caseData.stage };
  const dsaName = caseData.assigned_dsa_user?.name;

  return (
    <div className="msme-case-detail-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 16 : 24 }}>
      <style>{`
        .msme-case-detail-page .card,
        .msme-case-detail-page .btn,
        .msme-case-detail-page .form-control,
        .msme-case-detail-page .badge { border-radius: 0 !important; }
      `}</style>

      <button
        onClick={() => navigate('/msme/cases')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to My Cases
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            MSME Portal
          </p>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>CASE-{caseData.id}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{caseData.product_type || 'Product TBD'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Status */}
          <div className="card" style={{ padding: 20, borderLeft: `4px solid ${stage.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Current Status</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: stage.color, marginBottom: 4 }}>{stage.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stage.desc}</div>
          </div>

          {/* Loan summary */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Requested</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{caseData.loan_amount ? formatCompactINR(caseData.loan_amount) : '—'}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Sanctioned</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: caseData.sanctioned_amount ? 'var(--success)' : 'var(--text-primary)' }}>{caseData.sanctioned_amount ? formatCompactINR(caseData.sanctioned_amount) : '—'}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Disbursed</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: caseData.total_disbursed_amount > 0 ? 'var(--success)' : 'var(--text-primary)' }}>{caseData.total_disbursed_amount > 0 ? formatCompactINR(caseData.total_disbursed_amount) : '—'}</div>
            </div>
          </div>

          {/* Documents */}
          <SectionCard title="Documents" subtitle="Everything you've submitted, plus reports we've generated for your case" delay={0.1}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--outline)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-control"
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                style={{ width: 'auto', minWidth: 160 }}
              >
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} />
              <TravelingBorderButton size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-none">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UploadCloud size={14} /> {uploading ? 'Uploading...' : 'Upload Document'}
                </div>
              </TravelingBorderButton>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Max 15MB · PDF, image, Excel or Word</span>
            </div>

            {documents.length === 0 ? (
              <EmptyState icon={FileText} title="No documents yet" description="Documents you upload, and reports we generate for your case, will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {documents.map((doc, i) => (
                  <div key={doc.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: i < documents.length - 1 ? '1px solid var(--outline)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <FileText size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'break-word' }}>{doc.original_file_name || doc.file_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                    >
                      <Download size={13} /> {downloadingId === doc.id ? '...' : 'Download'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title="Your Relationship Manager" delay={0.15}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User2 size={18} color="var(--primary)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{dsaName || 'Cred2Tech Direct (Pending Allocation)'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{dsaName ? 'Managing your case' : "We'll assign someone to your case shortly"}</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default MsmeCaseDetailPage;
