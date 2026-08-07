import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/axiosInstance';
import { FileText, PenLine, CheckCircle2, FileCheck2, ClipboardList, Upload, Trash2 } from 'lucide-react';

const SalarySlipUploader = ({ caseId, applicantId, applicantName }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [months, setMonths] = useState([
    { id: 'm1', label: 'Month 1', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
    { id: 'm2', label: 'Month 2', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
    { id: 'm3', label: 'Month 3', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
  ]);
  const [loadingMonth, setLoadingMonth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [runningAllOcr, setRunningAllOcr] = useState(false);

  const fileInputRef = useRef(null);
  const [currentUploadMonth, setCurrentUploadMonth] = useState(null);
  const [mode, setMode] = useState('OCR'); // 'OCR' | 'MANUAL'
  const [manualEntryMonth, setManualEntryMonth] = useState(null);
  const [manualForm, setManualForm] = useState({ month: '', year: new Date().getFullYear().toString(), gross_salary: '', net_salary: '', deductions: '', employer_name: '', employee_name: applicantName || '' });

  useEffect(() => {
    setMonths([
      { id: 'm1', label: 'Month 1', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
      { id: 'm2', label: 'Month 2', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
      { id: 'm3', label: 'Month 3', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
    ]);
    setSummary(null);

    if (caseId && applicantId) {
      fetchSummary();
    }
  }, [caseId, applicantId]);

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/cases/${caseId}/salary-summary?applicantId=${applicantId}`);
      if (res.data?.success && res.data.data?.length > 0) {
        const all = res.data.data;
        // The analytics panel below (avg net take-home etc.) must only ever
        // reflect genuinely finished slips.
        const completed = all.filter(r => r.ocr_status === 'COMPLETED');
        setSummary(completed);

        // Slot restoration, however, must reflect everything actually sitting
        // in the database — not just COMPLETED. A PENDING/PROCESSING row (a
        // document was uploaded but OCR was never run, or is still running)
        // used to be silently dropped here on every revisit, which made an
        // already-occupied slot look empty and invited uploading the SAME
        // payslip again into it. Once OCR ran on that second copy, it
        // correctly — but confusingly — got rejected as a duplicate of the
        // FIRST upload sitting in a different, invisible slot. FAILED rows
        // are deliberately left out: a failure here is almost always that
        // same "duplicate period" rejection, which isn't useful to
        // redisplay as if it were a real, distinct slip — a fresh upload is
        // the right recovery path for those.
        const restorable = [
          ...completed,
          ...all.filter(r => r.ocr_status === 'PENDING' || r.ocr_status === 'PROCESSING'),
        ].slice(0, 3);

        const newMonths = [...months];
        restorable.forEach((r, idx) => {
          newMonths[idx].ocrStatus = r.ocr_status;
          newMonths[idx].result = r.ocr_status === 'COMPLETED' ? r : null;
          newMonths[idx].isUploaded = true;
          newMonths[idx].documentId = r.document_id;
          newMonths[idx].fileName = r.document?.original_file_name || newMonths[idx].fileName;
        });
        setMonths(newMonths);
      }
    } catch (error) {
      console.error('Failed to fetch salary summary:', error);
    }
  };

  const handleUploadClick = (monthId) => {
    setCurrentUploadMonth(monthId);
    fileInputRef.current.click();
  };

  const handleManualClick = (monthId) => {
    setManualEntryMonth(monthId);
    const existing = months.find(m => m.id === monthId)?.result;
    if (existing) {
      setManualForm({
        month: existing.month || '',
        year: existing.year || new Date().getFullYear().toString(),
        gross_salary: existing.gross_salary || '',
        net_salary: existing.net_salary || '',
        deductions: existing.deductions || '',
        employer_name: existing.employer_name || '',
        employee_name: existing.employee_name || applicantName || ''
      });
    } else {
      setManualForm({
        month: '',
        year: new Date().getFullYear().toString(),
        gross_salary: '',
        net_salary: '',
        deductions: '',
        employer_name: '',
        employee_name: applicantName || ''
      });
    }
  };

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!manualForm.month || !manualForm.gross_salary || !manualForm.net_salary) {
      toast.error('Month, Gross Salary, and Net Salary are required.');
      return;
    }

    setLoadingMonth(manualEntryMonth);
    try {
      const res = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips/manual`, manualForm);
      if (res.data?.success) {
        toast.success(`Manual entry saved for ${months.find(m => m.id === manualEntryMonth)?.label}`);
        setManualEntryMonth(null);
        fetchSummary();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save manual entry');
      console.error(error);
    } finally {
      setLoadingMonth(null);
    }
  };

  const pollOcrStatus = async (documentId, monthIndex) => {
    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
      try {
        attempts++;
        const res = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips/${documentId}/ocr/poll`);

        if (res.data?.success) {
          const status = res.data.data.ocr_status;

          if (status === 'COMPLETED') {
            clearInterval(interval);
            if (monthIndex === -1) {
              toast.success('Batch OCR Extracted successfully!');
              setRunningAllOcr(false);
            } else {
              toast.success(`OCR Extracted successfully for ${months[monthIndex].label}`);
              setMonths(prev => {
                const newM = [...prev];
                newM[monthIndex].ocrStatus = 'COMPLETED';
                newM[monthIndex].result = res.data.data;
                return newM;
              });
            }
            setLoadingMonth(null);
            fetchSummary();
          } else if (status === 'FAILED') {
            clearInterval(interval);
            if (monthIndex === -1) {
              toast.error(res.data.data.error_message || 'Batch OCR processing failed.');
              setRunningAllOcr(false);
            } else {
              toast.error(res.data.data.error_message || 'Vendor OCR processing failed.');
              setMonths(prev => {
                const newM = [...prev];
                newM[monthIndex].ocrStatus = 'FAILED';
                return newM;
              });
            }
            setLoadingMonth(null);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            toast.error('OCR polling timed out. Please try again.');
            setLoadingMonth(null);
            if (monthIndex === -1) setRunningAllOcr(false);
          }
        }
      } catch (err) {
        clearInterval(interval);
        toast.error('Error checking OCR status.');
        setLoadingMonth(null);
        if (monthIndex === -1) setRunningAllOcr(false);
      }
    }, 4000);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUploadMonth) return;
    if (!applicantId) {
      toast.error('Applicant ID missing. Please refresh and try again.');
      return;
    }

    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 10) {
      toast.error('File size exceeds 10 MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      toast.error('Unsupported file type. Upload PDF, PNG, JPEG, or WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const monthIndex = months.findIndex(m => m.id === currentUploadMonth);
    if (monthIndex === -1) return;

    setLoadingMonth(currentUploadMonth);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', 'SALARY_SLIP');

    try {
      const uploadRes = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const documentId = uploadRes.data?.data?.id;
      if (!documentId) throw new Error('Upload failed to return document ID');

      toast.success(`Salary slip uploaded for ${months[monthIndex].label}`);

      const newMonths = [...months];
      newMonths[monthIndex].isUploaded = true;
      newMonths[monthIndex].documentId = documentId;
      newMonths[monthIndex].fileName = file.name;
      // A re-upload replaces the file for this slot with a brand new
      // Document row, so any previous OCR result no longer applies - without
      // resetting these, a slot that was already COMPLETED (or a stale
      // PENDING one mislabeled COMPLETED, see fetchSummary) stayed marked
      // COMPLETED and "Run OCR on Uploaded Slips" silently skipped it forever.
      newMonths[monthIndex].ocrStatus = 'PENDING';
      newMonths[monthIndex].result = null;
      setMonths(newMonths);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload salary slip');
      console.error(error);
    } finally {
      setLoadingMonth(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSlip = async (monthId) => {
    const monthIndex = months.findIndex(m => m.id === monthId);
    if (monthIndex === -1) return;
    const target = months[monthIndex];
    if (!target.documentId) return;

    if (!window.confirm(`Remove the salary slip for ${target.label}? This cannot be undone.`)) return;

    setLoadingMonth(monthId);
    try {
      await api.delete(`/cases/${caseId}/applicants/${applicantId}/salary-slips/${target.documentId}`);
      toast.success(`Salary slip removed for ${target.label}`);

      const newMonths = [...months];
      newMonths[monthIndex] = { id: target.id, label: target.label, file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null };
      setMonths(newMonths);

      fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove salary slip');
      console.error(error);
    } finally {
      setLoadingMonth(null);
    }
  };

  const handleRunAllOcr = async () => {
    setRunningAllOcr(true);

    const docsToProcess = months
      .map((m, i) => ({ documentId: m.documentId, month: `M${i + 1}`, year: new Date().getFullYear().toString(), isUploaded: m.isUploaded, ocrStatus: m.ocrStatus, id: m.id, label: m.label }))
      .filter(m => m.isUploaded && m.ocrStatus !== 'COMPLETED' && m.documentId);

    if (docsToProcess.length === 0) {
      setRunningAllOcr(false);
      return;
    }

    try {
      setLoadingMonth('batch');
      const ocrRes = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips/ocr-batch`, {
        documentIds: docsToProcess.map(d => ({ documentId: d.documentId, month: d.month, year: d.year }))
      });

      if (ocrRes.data?.success) {
        toast('Processing batch OCR... This might take a moment.', { icon: '⏳' });
        pollOcrStatus(docsToProcess[0].documentId, -1);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start batch OCR');
      setLoadingMonth(null);
      setRunningAllOcr(false);
    }
  };

  const completedCount = months.filter(m => m.ocrStatus === 'COMPLETED').length;
  // Gross/Deductions/Net must all be averaged the same way — showing Gross
  // and Deductions from only the single latest slip next to a Net figure
  // averaged across all of them (the old behavior) made the three numbers
  // internally inconsistent (Gross − Deductions ≠ the Net shown), and this
  // average is what recalculateApplicantIncome() actually feeds into ESR/
  // eligibility, so it's the economically meaningful figure here, not the
  // latest month alone. Rounded to whole rupees — an unrounded average
  // renders as ₹31,196.667, which isn't a real currency amount.
  const avgOf = (key) => summary?.length > 0
    ? Math.round(summary.reduce((sum, s) => sum + (s[key] || 0), 0) / summary.length)
    : 0;
  const avgGross = avgOf('gross_salary');
  const avgDeductions = avgOf('deductions');
  const avgNet = avgOf('net_salary');
  // The most recent slip's OCR doesn't always detect an employer name — some
  // payslip templates never print it as a labelled line, so the vendor's
  // extraction genuinely has nothing to return for that one slip. Reading
  // only summary[0] showed a blank "-" even when an OLDER slip for the same
  // employee did successfully capture it (same employer across periods, so
  // this fallback is a safe, accurate substitute — not a guess).
  const employerName = summary?.find(s => s.employer_name)?.employer_name || null;

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="application/pdf,image/jpeg,image/png"
      />

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 10, border: '1px solid var(--border)', padding: 2 }}>
        <button
          type="button"
          onClick={() => setMode('OCR')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: 'none', borderRadius: 0,
            background: mode === 'OCR' ? 'var(--primary)' : 'transparent', color: mode === 'OCR' ? '#fff' : 'var(--text-secondary)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <FileText size={12} /> Upload OCR
        </button>
        <button
          type="button"
          onClick={() => setMode('MANUAL')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: 'none', borderRadius: 0,
            background: mode === 'MANUAL' ? 'var(--primary)' : 'transparent', color: mode === 'MANUAL' ? '#fff' : 'var(--text-secondary)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <PenLine size={12} /> Manual Entry
        </button>
      </div>

      {manualEntryMonth && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              Manual Salary Entry ({months.find(m => m.id === manualEntryMonth)?.label})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Month</label>
                  <select required value={manualForm.month} onChange={e => setManualForm({ ...manualForm, month: e.target.value })} className="form-control">
                    <option value="">Select Month</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Year</label>
                  <input type="number" required value={manualForm.year} onChange={e => setManualForm({ ...manualForm, year: e.target.value })} className="form-control" />
                </div>
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Gross Salary (₹)</label>
                <input type="number" required min="0" value={manualForm.gross_salary} onChange={e => setManualForm({ ...manualForm, gross_salary: e.target.value })} className="form-control" placeholder="e.g. 60000" />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Net Salary (₹)</label>
                <input type="number" required min="0" value={manualForm.net_salary} onChange={e => setManualForm({ ...manualForm, net_salary: e.target.value })} className="form-control" placeholder="e.g. 55000" />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Deductions (₹)</label>
                <input type="number" min="0" value={manualForm.deductions} onChange={e => setManualForm({ ...manualForm, deductions: e.target.value })} className="form-control" placeholder="e.g. 5000" />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Employer Name</label>
                <input type="text" value={manualForm.employer_name} onChange={e => setManualForm({ ...manualForm, employer_name: e.target.value })} className="form-control" placeholder="Company Name" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setManualEntryMonth(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="button" onClick={handleManualSubmit} disabled={loadingMonth !== null} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {loadingMonth === manualEntryMonth ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* One compact row per slot instead of three large padded cards — same
          three states (empty / uploaded-pending / completed), same actions,
          a fraction of the height. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {months.map((m) => {
          const isCompleted = m.ocrStatus === 'COMPLETED';
          const isPending = !isCompleted && m.isUploaded;
          const Icon = isCompleted ? CheckCircle2 : isPending ? FileCheck2 : ClipboardList;
          const iconColor = isCompleted ? 'var(--success)' : isPending ? 'var(--info)' : 'var(--text-tertiary)';
          const statusText = isCompleted
            ? (m.fileName || 'Document attached')
            : isPending
              ? (m.fileName || 'Document attached')
              : (mode === 'OCR' ? 'Not uploaded' : 'Not entered');
          const primaryLabel = isCompleted
            ? (mode === 'OCR' ? 'Re-upload' : 'Edit')
            : isPending
              ? (mode === 'OCR' ? 'Change' : 'Enter')
              : (loadingMonth === m.id ? (mode === 'OCR' ? 'Uploading…' : 'Saving…') : (mode === 'OCR' ? 'Upload' : 'Enter'));

          return (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                border: '1px solid var(--border)', borderRadius: 0,
                background: isCompleted ? 'var(--success-bg)' : isPending ? 'var(--info-bg)' : 'var(--bg-elevated)',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
              }}
            >
              <Icon size={15} color={iconColor} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, minWidth: 52 }}>{m.label}</span>
              <span
                style={{ flex: '1 1 100px', minWidth: 0, fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={m.fileName || undefined}
              >
                {statusText}
              </span>
              {isCompleted && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', flexShrink: 0 }}>
                  ₹{m.result?.net_salary?.toLocaleString('en-IN') || 0}
                </span>
              )}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: isMobile ? 'auto' : 0 }}>
                <button
                  type="button"
                  style={{ padding: '3px 9px', fontSize: 11, fontWeight: 700, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderRadius: 0, cursor: 'pointer' }}
                  onClick={() => mode === 'OCR' ? handleUploadClick(m.id) : handleManualClick(m.id)}
                  disabled={loadingMonth !== null || runningAllOcr}
                >
                  {primaryLabel}
                </button>
                {m.isUploaded && (
                  <button
                    type="button"
                    title={`Remove ${m.label} salary slip`}
                    aria-label={`Remove ${m.label} salary slip`}
                    style={{ padding: '3px 7px', border: '1px solid var(--error)', background: 'var(--bg-surface)', color: 'var(--error)', borderRadius: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onClick={() => handleDeleteSlip(m.id)}
                    disabled={loadingMonth !== null || runningAllOcr}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {mode === 'OCR' && months.some(m => m.isUploaded && m.ocrStatus !== 'COMPLETED') && (
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
            padding: '6px 12px', marginBottom: 10, border: 'none', borderRadius: 0,
            background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
          onClick={handleRunAllOcr}
          disabled={runningAllOcr || loadingMonth !== null}
        >
          {runningAllOcr ? 'Processing OCR…' : <>Run OCR on Uploaded Slips <Upload size={13} /></>}
        </button>
      )}

      {/* Single inline strip instead of a boxed 2x2 grid of sub-cards — same
          four figures (employer, avg gross, avg deductions, net take-home),
          read left-to-right in one line instead of a padded block. */}
      {completedCount > 0 && summary && summary.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px',
          padding: '6px 10px', background: 'var(--success-bg)', border: '1px solid var(--success)', fontSize: 11,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--success)', flexShrink: 0 }}>
            <CheckCircle2 size={12} /> {completedCount}/3 processed
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Employer: <strong style={{ color: 'var(--text-primary)' }}>{employerName || 'Not detected'}</strong>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Avg Gross: <strong style={{ color: 'var(--text-primary)' }}>₹{avgGross.toLocaleString('en-IN')}</strong>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Avg Deductions: <strong style={{ color: 'var(--text-primary)' }}>₹{avgDeductions.toLocaleString('en-IN')}</strong>
          </span>
          <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 'auto' }}>
            Net Take-Home: ₹{avgNet.toLocaleString('en-IN')}/mo
          </span>
        </div>
      )}
    </div>
  );
};

export default SalarySlipUploader;
