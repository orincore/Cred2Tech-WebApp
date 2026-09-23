import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/axiosInstance';
import { FileText, PenLine, CheckCircle2, FileCheck2, ClipboardList, Trash2 } from 'lucide-react';

const MONO_FONT = "'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace";

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The extraction vendor returns month as a zero-padded number ("08"), not a
// name — render it the same way the manual-entry dropdown's options read
// ("August") instead of surfacing the raw numeric string.
const formatSlipPeriod = (month, year) => {
  if (!month || !year) return null;
  const asNumber = parseInt(month, 10);
  const monthName = Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12
    ? MONTH_NAMES[asNumber - 1]
    : month;
  return `${monthName} ${year}`;
};

// A single extracted-field readout inside a completed slip's preview panel —
// lets the DSA actually verify the figures against the physical payslip
// instead of trusting the one net-salary number in the row header.
const MiniStat = ({ label, value }) => (
  <div style={{ minWidth: 92 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: MONO_FONT }}>
      {value}
    </div>
  </div>
);

const SalarySlipUploader = ({ caseId, applicantId, applicantName }) => {
  const [months, setMonths] = useState([
    { id: 'm1', label: 'Month 1', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
    { id: 'm2', label: 'Month 2', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
    { id: 'm3', label: 'Month 3', file: null, ocrStatus: 'PENDING', result: null, isUploaded: false, documentId: null, fileName: null },
  ]);
  const [loadingMonth, setLoadingMonth] = useState(null);
  const [summary, setSummary] = useState(null);

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
        // The API orders these by extracted year/month DESC (most recent pay
        // period first, see getSalarySummary), which has nothing to do with
        // which slot a slip was uploaded into — a July payslip uploaded
        // first and a March one uploaded second would otherwise swap
        // positions here the moment the March one's extraction completed.
        // document_id is assigned in upload order, so re-sorting on it keeps
        // slot 1/2/3 stable regardless of which slip finished processing
        // first or which calendar month it turned out to cover.
        const restorable = [
          ...completed,
          ...all.filter(r => r.ocr_status === 'PENDING' || r.ocr_status === 'PROCESSING'),
        ]
          .sort((a, b) => a.document_id - b.document_id)
          .slice(0, 3);

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
              toast.success('All uploaded slips extracted successfully!');
              setRunningAllOcr(false);
            } else {
              toast.success(`Data extracted successfully for ${months[monthIndex].label}`);
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
              toast.error(res.data.data.error_message || 'Extraction failed for the uploaded slips.');
              setRunningAllOcr(false);
            } else {
              toast.error(res.data.data.error_message || 'Extraction failed. Please try again.');
              setMonths(prev => {
                const newM = [...prev];
                newM[monthIndex].ocrStatus = 'FAILED';
                return newM;
              });
            }
            setLoadingMonth(null);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            toast.error('Extraction timed out. Please try again.');
            setLoadingMonth(null);
            if (monthIndex === -1) setRunningAllOcr(false);
          }
        }
      } catch (err) {
        clearInterval(interval);
        toast.error('Error checking extraction status.');
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

    // Captured before the upload overwrites this slot's tracked documentId
    // below — a re-upload ("Change"/"Re-upload") creates a brand new
    // Document row for the same slot, and this old one otherwise never gets
    // cleaned up: it just silently stops being tracked here (see the state
    // update below), but stays ACTIVE in the DB with its file still in S3 —
    // invisible on this page (only the latest per slot is shown/deletable)
    // yet still listed under "Income Documents" on the Prepare Proposal
    // page, which lists every active SALARY_SLIP document for the case.
    const previousDocumentId = months[monthIndex].documentId;

    setLoadingMonth(currentUploadMonth);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', 'SALARY_SLIP');

    let documentId;
    try {
      const uploadRes = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      documentId = uploadRes.data?.data?.id;
      if (!documentId) throw new Error('Upload failed to return document ID');

      toast.success(`Salary slip uploaded for ${months[monthIndex].label}`);

      // Clean up the slip this one just replaced — same endpoint the
      // explicit delete button uses, which soft-deletes the Document row
      // AND removes the file from S3 (documentService.deleteDocument).
      // Best-effort/fire-and-forget: it must never block or fail the
      // upload the DSA is actually waiting on.
      if (previousDocumentId && previousDocumentId !== documentId) {
        api.delete(`/cases/${caseId}/applicants/${applicantId}/salary-slips/${previousDocumentId}`)
          .catch(err => console.error('Failed to clean up replaced salary slip document:', err));
      }

      const newMonths = [...months];
      newMonths[monthIndex].isUploaded = true;
      newMonths[monthIndex].documentId = documentId;
      newMonths[monthIndex].fileName = file.name;
      // A re-upload replaces the file for this slot with a brand new
      // Document row, so any previous extraction result no longer applies -
      // without resetting these, a slot that was already COMPLETED (or a
      // stale PENDING one mislabeled COMPLETED, see fetchSummary) stayed
      // marked COMPLETED and the automatic re-extraction below would have
      // skipped it.
      newMonths[monthIndex].ocrStatus = 'PENDING';
      newMonths[monthIndex].result = null;
      setMonths(newMonths);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload salary slip');
      console.error(error);
      setLoadingMonth(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Extraction now starts the instant the upload finishes — no separate
    // manual "Extract Data" click. loadingMonth stays set the whole time
    // (it now means "extracting" rather than "uploading"); startExtraction /
    // pollOcrStatus clear it once the result actually lands.
    await startExtraction(monthIndex, documentId);
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

  // Fires the extraction vendor call for exactly the slip that was just
  // uploaded (see handleFileChange) and starts polling it. loadingMonth is
  // already set to this slot's id by the caller before this runs, so the
  // row reads "Extracting…" and stays disabled with no gap between upload
  // finishing and extraction starting.
  const startExtraction = async (monthIndex, documentId) => {
    try {
      const ocrRes = await api.post(`/cases/${caseId}/applicants/${applicantId}/salary-slips/ocr-batch`, {
        documentIds: [{ documentId, month: `M${monthIndex + 1}`, year: new Date().getFullYear().toString() }]
      });

      if (ocrRes.data?.success) {
        pollOcrStatus(documentId, monthIndex);
      } else {
        setLoadingMonth(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start data extraction');
      setLoadingMonth(null);
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
    <div className="salary-ocr">
      <style>{`
        .salary-ocr { animation: salaryOcrIn 400ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes salaryOcrIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .salary-ocr button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .salary-ocr .mode-tab { transition: background 150ms ease, color 150ms ease; }
        .salary-ocr .mode-tab:not(.active):hover { background: var(--bg-surface); color: var(--text-primary); }
        .salary-ocr .slip-row { transition: border-color 150ms ease, box-shadow 150ms ease; animation: salaryOcrIn 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }
        .salary-ocr .slip-row:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
        .salary-ocr .slip-action-danger { color: var(--text-secondary); }
        .salary-ocr .slip-action-danger:hover:not(:disabled) { background: var(--error-bg); color: var(--error); }
        /* iOS Safari auto-zooms the page on focusing any input/select whose
           font-size is under 16px — the global .form-control is 14px, which
           is what was actually causing the "zooms in when tapping" report. */
        .salary-ocr .form-control, .salary-ocr select.form-control { font-size: 16px; }
        /* Real media queries instead of the old JS-computed isMobile flag
           for anything layout-critical — more predictable on an actual
           device than a resize-event-driven inline style, and Apple HIG's
           44x44pt minimum touch target applies specifically here. */
        .salary-ocr button { -webkit-tap-highlight-color: transparent; }
        /* Base (desktop) flex behavior lives here, in CSS, rather than as an
           inline style — an inline style always wins over a plain stylesheet
           rule regardless of specificity, which silently defeated the
           max-width override below the first time this was written inline
           (the row never actually wrapped on mobile, so "Re-upload" + the
           delete button had no room and got squeezed/cut off). Keeping both
           the default and the override in CSS avoids that trap entirely. */
        .salary-ocr .slip-row-main { flex: 1 1 auto; }
        .salary-ocr .salary-summary-net { margin-left: auto; }
        @media (max-width: 640px) {
          .salary-ocr .slip-row-header { flex-wrap: wrap; }
          .salary-ocr .slip-row-main { flex-basis: 100%; }
          .salary-ocr .slip-row-actions { margin-left: 0; width: 100%; justify-content: flex-end; }
          .salary-ocr .manual-modal-row { flex-direction: column; }
          .salary-ocr .btn-sm { min-height: 44px; padding: 10px 16px; font-size: 14px; }
          .salary-ocr .btn-icon { width: 44px !important; height: 44px !important; }
          .salary-ocr .mode-tab { min-height: 44px; }
          .salary-ocr .salary-summary-net { flex-basis: 100%; margin-left: 0; margin-top: 4px; }
        }
      `}</style>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="application/pdf,image/jpeg,image/png"
      />

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 14, background: 'var(--bg-elevated)', borderRadius: 0, padding: 4 }}>
        <button
          type="button"
          className={`mode-tab${mode === 'OCR' ? ' active' : ''}`}
          onClick={() => setMode('OCR')}
          aria-pressed={mode === 'OCR'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 0,
            background: mode === 'OCR' ? 'var(--primary)' : 'transparent', color: mode === 'OCR' ? '#fff' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <FileText size={14} /> Auto Extract
        </button>
        <button
          type="button"
          className={`mode-tab${mode === 'MANUAL' ? ' active' : ''}`}
          onClick={() => setMode('MANUAL')}
          aria-pressed={mode === 'MANUAL'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 0,
            background: mode === 'MANUAL' ? 'var(--primary)' : 'transparent', color: mode === 'MANUAL' ? '#fff' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <PenLine size={14} /> Manual Entry
        </button>
      </div>

      {manualEntryMonth && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              Manual Salary Entry ({months.find(m => m.id === manualEntryMonth)?.label})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="manual-modal-row" style={{ display: 'flex', gap: 12 }}>
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

      {/* One row per slot — same three states (empty / uploaded-pending /
          completed), same actions, sized for comfortable reading and
          touch/click targets rather than shoehorned into a dense strip. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {months.map((m) => {
          const isCompleted = m.ocrStatus === 'COMPLETED';
          const isPending = !isCompleted && m.isUploaded;
          // Extraction now kicks off automatically right after upload (see
          // handleFileChange/startExtraction) — loadingMonth stays set for
          // this slot the whole time it's in flight, so "isPending AND
          // currently loading" means "extracting", not "just sitting there
          // uploaded and untouched" (the old, manual-trigger meaning).
          const isExtracting = isPending && loadingMonth === m.id;
          const r = m.result;
          // Once extraction actually tells us which real calendar month this
          // slip is for, that's far more useful than the generic slot
          // placeholder ("Month 1") — show it instead everywhere this slot
          // is labeled.
          const displayLabel = (isCompleted && formatSlipPeriod(r?.month, r?.year)) || m.label;
          const Icon = isCompleted ? CheckCircle2 : isPending ? FileCheck2 : ClipboardList;
          const iconColor = isCompleted ? 'var(--success)' : isPending ? 'var(--info)' : 'var(--text-tertiary)';
          const iconBg = isCompleted ? 'var(--success-bg)' : isPending ? 'var(--info-bg)' : 'var(--bg-elevated)';
          const statusText = isExtracting
            ? 'Extracting data…'
            : isCompleted
              ? (m.fileName || 'Document attached')
              : isPending
                ? (m.fileName || 'Document attached')
                : (mode === 'OCR' ? 'Not uploaded' : 'Not entered');
          const primaryLabel = isCompleted
            ? (mode === 'OCR' ? 'Re-upload' : 'Edit')
            : isExtracting
              ? 'Extracting…'
              : isPending
                ? (mode === 'OCR' ? 'Change' : 'Enter')
                : (loadingMonth === m.id ? (mode === 'OCR' ? 'Uploading…' : 'Saving…') : (mode === 'OCR' ? 'Upload' : 'Enter'));

          return (
            <div
              key={m.id}
              className="slip-row"
              style={{
                border: '1px solid var(--border)', borderRadius: 0,
                background: 'var(--bg-surface)', overflow: 'hidden',
              }}
            >
              <div className="slip-row-header" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              }}>
                <div className="slip-row-main" style={{
                  display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 34, height: 34, borderRadius: 0, background: iconBg,
                  }}>
                    <Icon size={17} color={iconColor} />
                  </div>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{displayLabel}</div>
                    <div
                      style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={m.fileName || undefined}
                    >
                      {statusText}
                    </div>
                  </div>
                </div>
                <div className="slip-row-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => mode === 'OCR' ? handleUploadClick(m.id) : handleManualClick(m.id)}
                    disabled={loadingMonth !== null}
                  >
                    {primaryLabel}
                  </button>
                  {m.isUploaded && (
                    <button
                      type="button"
                      className="btn btn-icon slip-action-danger"
                      title={`Remove ${displayLabel} salary slip`}
                      aria-label={`Remove ${displayLabel} salary slip`}
                      onClick={() => handleDeleteSlip(m.id)}
                      disabled={loadingMonth !== null}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Extracted-data preview — lets the DSA verify the figures
                  against the physical payslip right here instead of trusting
                  a single net-salary number, and fills what would otherwise
                  be a lot of empty space per completed slot. */}
              {isCompleted && r && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 16px',
                  borderTop: '1px dashed var(--border)', background: 'var(--bg-elevated)',
                }}>
                  <div style={{ marginRight: 12 }}>
                    <MiniStat label="Employer" value={r.employer_name || 'Not detected'} />
                  </div>
                  <MiniStat label="Gross Salary" value={`₹${(r.gross_salary || 0).toLocaleString('en-IN')}`} />
                  <MiniStat label="Deductions" value={`₹${(r.deductions || 0).toLocaleString('en-IN')}`} />
                  <MiniStat label="Net Salary" value={`₹${(r.net_salary || 0).toLocaleString('en-IN')}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Two-tier summary card instead of one long wrapping sentence — a
          status header (badge + employer) that reflows cleanly on narrow
          screens, then a stat row with Net Take-Home visually emphasized as
          the one figure that actually matters most here. */}
      {completedCount > 0 && summary && summary.length > 0 && (
        <div style={{ border: '1px solid var(--success)', borderRadius: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px',
            padding: '10px 16px', background: 'var(--success-bg)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--success)', fontSize: 13, flexShrink: 0 }}>
              <CheckCircle2 size={15} /> {completedCount}/3 processed
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Employer: <strong style={{ color: 'var(--text-primary)' }}>{employerName || 'Not detected'}</strong>
            </span>
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20,
            padding: '12px 16px', background: 'var(--bg-elevated)', borderTop: '1px dashed var(--success)',
          }}>
            <MiniStat label="Avg Gross" value={`₹${avgGross.toLocaleString('en-IN')}`} />
            <MiniStat label="Avg Deductions" value={`₹${avgDeductions.toLocaleString('en-IN')}`} />
            <div className="salary-summary-net">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                Net Take-Home / mo
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', fontFamily: MONO_FONT }}>
                ₹{avgNet.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipUploader;
