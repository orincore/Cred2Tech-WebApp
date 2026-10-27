import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, UploadCloud, FileText, User2, AlertCircle, CloudDownload, HardDrive, Trash2 } from 'lucide-react';
import { caseService } from '../../api/caseService';
import { msmeApi } from '../../api/msmeService';
import CaseStageBadge from '../../components/msme/CaseStageBadge';
import { listDocuments, downloadDocument, viewDocument, uploadDocument, deleteDocument } from '../../api/documentHelper';
import { formatCompactINR, formatFileSize, CASE_STAGE_LABELS } from '../../utils/helpers';
import { KYC_CATEGORIES, groupDocumentsByCategory } from '../../constants/documentCategories';
import SectionCard from '../../components/ui/SectionCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import TravelingBorderButton from '../../components/TravelingBorderButton';
import DataPurgedBadge from '../../components/case/DataPurgedBadge';

import CustomSelect from '../../components/CustomSelect';
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

// Upload targets, built from the same KYC categories the DSA side files
// documents under (constants/documentCategories.js) so whatever a customer
// uploads lands in the group a DSA expects. "Fetched from API" is excluded -
// that category is only ever written by our own data-pull pipeline.
// value = `${categoryId}::${documentType}`.
const buildUploadTargets = (isSalaried) => [
  ...KYC_CATEGORIES
    .filter(c => c.id !== 'api_fetched_documents' && !c.freeform && !(c.msmeOnly && isSalaried))
    .flatMap(c => c.options.map(o => ({
      value: `${c.id}::${o.type}`, categoryId: c.id, type: o.type, perApplicant: !!c.perApplicant,
      label: `${c.label} - ${o.label}`,
    }))),
  { value: 'others::OTHER', categoryId: 'others', type: 'OTHER', perApplicant: false, label: 'Other Documents' },
];

// One document tile - same look as the DSA Case Detail Documents tab, minus
// Delete (a customer can add documents but not remove what the team relies on).
const DocumentCard = ({ doc, onDownload, downloading, onDelete, deleting }) => (
  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--outline)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 260px' }}>
      <FileText size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{doc.original_file_name || doc.document_type}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {doc.source_type === 'DIRECT_UPLOAD' ? <UploadCloud size={12} /> : <CloudDownload size={12} />}
            {doc.source_type === 'DIRECT_UPLOAD' ? 'Uploaded' : doc.source_type === 'VENDOR_DOWNLOAD' ? 'API Pull' : 'System'}
          </span>
          <span>{formatFileSize(doc.file_size_bytes)}</span>
          <span>{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => viewDocument(doc.id).catch(() => toast.error('Failed to open document'))}>View</button>
      <button className="btn btn-secondary btn-sm" onClick={() => onDownload(doc)} disabled={downloading}>
        {downloading ? 'Downloading…' : 'Download'}
      </button>
      {onDelete && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onDelete(doc)}
          disabled={deleting}
          title="Delete this document"
          style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
    </div>
  </div>
);

const MsmeCaseDetailPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [caseData, setCaseData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [allCases, setAllCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadTarget, setUploadTarget] = useState('income_documents::BANK_STATEMENT');

  const uploadTargets = buildUploadTargets(caseData?.category === 'SALARIED');

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [c, docs, list] = await Promise.all([
        caseService.getCaseById(caseId),
        listDocuments({ caseId }),
        // Needed to relate this case to its main application / lender cases;
        // the page still works without it.
        msmeApi.getCases().then((r) => r.data.cases || []).catch(() => []),
      ]);
      setCaseData(c);
      setDocuments(docs);
      setAllCases(list);
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
      const target = uploadTargets.find(t => t.value === uploadTarget) || uploadTargets[uploadTargets.length - 1];
      // ID / address proofs are per applicant; the customer here is the primary one.
      const primary = caseData?.applicants?.find(a => a.type === 'PRIMARY');
      await uploadDocument(file, caseId, target.type, {
        applicantId: target.perApplicant ? primary?.id : undefined,
        // OTHER is shared by several categories - tag which one this belongs to.
        category: target.type === 'OTHER' ? target.categoryId : undefined,
      });
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

  // Delete button only opens the confirmation popup; the delete itself runs
  // from confirmDelete once the customer confirms.
  const handleDelete = (doc) => setDeleteTarget(doc);

  const confirmDelete = async () => {
    const doc = deleteTarget;
    if (!doc) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      toast.success('Document deleted');
      setDeleteTarget(null);
      setDocuments(await listDocuments({ caseId }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeletingId(null);
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
  // Once purged, this case is permanently read-only — only mutating action on
  // this page is document upload. AddCustomerWizardPage's restoreSession()
  // independently blocks resuming this case's data via /msme/onboarding too.
  const isPurged = !!caseData.data_purged_at;

  // Each lender the customer applied with is its own standalone case (own
  // number, own DSA). The grouping exists only on this customer side: a lender
  // case points at the main application it was created under, and the main
  // application lists its lender cases.
  const lenderLink = allCases.find((c) => c.id === caseData.id)?.msme_lender_application_as_child || null;
  const lenderCases = allCases
    .filter((c) => c.msme_lender_application_as_child?.case_id === caseData.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

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
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            CASE-{caseData.id}
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '3px 10px' }}>
              {caseData.product_type || 'Product TBD'}
            </span>
            {isPurged && <DataPurgedBadge />}
          </h1>
          {lenderLink && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Lender application · {lenderLink.lender_name}</span>
              <button
                onClick={() => navigate(`/msme/cases/${lenderLink.case_id}`)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-tertiary)', fontWeight: 600, textDecoration: 'underline' }}
              >
                Part of CASE-{lenderLink.case_id}
              </button>
            </div>
          )}
        </div>
        {/* Lets a customer go back into the wizard to fix/add applicant,
            property, income or obligation details even after their case has
            been allocated to a DSA (allocation moves the case into that
            DSA's tenant — see caseOwnershipScope.js — it no longer means
            "done editing"). Only a permanently-purged case blocks this,
            same as the DSA side's own Open Wizard button. */}
        {!isPurged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Only on the main application: lenders are added from there (a
                lender case can't add more - the server refuses it). Goes
                straight to the lender list (step 6) of the wizard. */}
            {/* Same component and same fixed width for both header buttons so
                they always match. */}
            {!lenderLink && (
              <TravelingBorderButton size="sm" width="240px" onClick={() => navigate(`/msme/onboarding?caseId=${caseData.id}&step=6`)} className="rounded-none">
                Apply to Another Lender
              </TravelingBorderButton>
            )}
            <TravelingBorderButton size="sm" width="240px" onClick={() => navigate(`/msme/onboarding?caseId=${caseData.id}`)} className="rounded-none">
              Update Application
            </TravelingBorderButton>
          </div>
        )}
      </div>

      {isPurged && (
        <div className="notice notice-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>This case's data has been permanently purged</div>
              <div style={{ marginTop: 2 }}>Records were removed per data retention policy. This case is now read-only — start a new application instead.</div>
            </div>
            <TravelingBorderButton size="sm" onClick={() => navigate('/msme/onboarding')} className="rounded-none" style={{ flexShrink: 0 }}>
              Create New Case
            </TravelingBorderButton>
          </div>
        </div>
      )}

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
              <div style={{ fontSize: 17, fontWeight: 800 }}>{(caseData.loan_amount || caseData.sanctioned_amount) ? formatCompactINR(caseData.loan_amount || caseData.sanctioned_amount) : '—'}</div>
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

          {/* Lender applications - one standalone case per lender. */}
          {lenderCases.length > 0 && (
            <SectionCard title="Lender Applications" subtitle="Each lender you applied with is its own case, handled by its own Relationship Manager" delay={0.08}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lenderCases.map((c, i) => (
                  <div key={c.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: i < lenderCases.length - 1 ? '1px solid var(--outline)' : 'none' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.msme_lender_application_as_child?.lender_name || c.lender_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        CASE-{c.id} · {c.assigned_dsa_user?.name ? `Managed by ${c.assigned_dsa_user.name}` : 'Awaiting allocation'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CaseStageBadge stage={c.stage} />
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/msme/cases/${c.id}`)}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Documents - grouped into the same KYC categories the DSA's Case
              Detail Documents tab uses (constants/documentCategories.js). */}
          <SectionCard title="Documents" subtitle="Everything you've submitted, plus reports we've generated for your case" delay={0.1}>
            {!isPurged && (
              <div style={{ padding: 16, borderBottom: '1px solid var(--outline)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <CustomSelect
                  className="form-control"
                  value={uploadTarget}
                  onChange={e => setUploadTarget(e.target.value)}
                  style={{ width: 'auto', minWidth: 240 }}
                >
                  {uploadTargets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </CustomSelect>
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} />
                <TravelingBorderButton size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-none">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UploadCloud size={14} /> {uploading ? 'Uploading...' : 'Upload Document'}
                  </div>
                </TravelingBorderButton>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Max 15MB · PDF, image, Excel or Word</span>
              </div>
            )}

            {documents.length === 0 ? (
              <EmptyState icon={FileText} title="No documents yet" description="Documents you upload, and reports we generate for your case, will appear here." />
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
                  padding: '10px 14px', marginBottom: 16, background: 'var(--bg-elevated)',
                  border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={14} color="var(--text-tertiary)" />
                    Storage used: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatFileSize(documents.reduce((n, d) => n + (d.file_size_bytes || 0), 0))}</span>
                  </div>
                  <div>{documents.length} document(s)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UploadCloud size={13} color="var(--text-tertiary)" /> {documents.filter(d => d.source_type === 'DIRECT_UPLOAD').length} uploaded</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CloudDownload size={13} color="var(--text-tertiary)" /> {documents.filter(d => d.source_type === 'VENDOR_DOWNLOAD').length} from API pulls</div>
                </div>

                {groupDocumentsByCategory(documents, { isSalaried: caseData.category === 'SALARIED' }).map(cat => {
                  // List container: each row draws its own bottom border, so the
                  // box only needs top/left/right here.
                  const grid = { display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderBottom: 'none' };
                  const applicants = caseData.applicants || [];
                  return (
                    <div key={cat.id} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cat.label}
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '1px 8px' }}>{cat.docs.length}</span>
                      </div>
                      {cat.perApplicant ? (
                        applicants.filter(app => cat.docs.some(d => d.applicant_id === app.id)).map((app, idx) => (
                          <div key={app.id} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              {app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Borrower ${idx}`}
                            </div>
                            <div style={grid}>
                              {cat.docs.filter(d => d.applicant_id === app.id).map(doc => (
                                <DocumentCard key={doc.id} doc={doc} onDownload={handleDownload} downloading={downloadingId === doc.id}
                                  onDelete={isPurged ? undefined : handleDelete} deleting={deletingId === doc.id} />
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={grid}>
                          {cat.docs.map(doc => (
                            <DocumentCard key={doc.id} doc={doc} onDownload={handleDownload} downloading={downloadingId === doc.id}
                              onDelete={isPurged ? undefined : handleDelete} deleting={deletingId === doc.id} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {deleteTarget && (
          <div className="modal-overlay" onClick={() => { if (!deletingId) setDeleteTarget(null); }}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={18} color="var(--error)" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Delete document?</h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6, overflowWrap: 'anywhere' }}>
                <strong>{deleteTarget.original_file_name || deleteTarget.document_type}</strong>
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                This removes the file from your case and cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={confirmDelete} disabled={!!deletingId}
                  style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
                  {deletingId ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

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
