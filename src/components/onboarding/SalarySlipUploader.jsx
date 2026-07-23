import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/axiosInstance';

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
        const results = res.data.data;
        setSummary(results);

        const newMonths = [...months];
        results.forEach((r, idx) => {
          if (idx < 3) {
            newMonths[idx].ocrStatus = 'COMPLETED';
            newMonths[idx].result = r;
          }
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
      setMonths(newMonths);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload salary slip');
      console.error(error);
    } finally {
      setLoadingMonth(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
  const avgNet = summary?.length > 0
    ? summary.reduce((sum, s) => sum + (s.net_salary || 0), 0) / summary.length
    : 0;

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="application/pdf,image/jpeg,image/png"
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setMode('OCR')}
          className="btn"
          style={{ flex: 1, justifyContent: 'center', border: mode === 'OCR' ? '2px solid var(--primary)' : '1px solid var(--border)', background: mode === 'OCR' ? 'var(--primary-subtle)' : 'var(--bg-surface)', fontWeight: 600, color: mode === 'OCR' ? 'var(--primary-dark)' : 'var(--text-secondary)' }}
        >
          📄 Upload OCR
        </button>
        <button
          type="button"
          onClick={() => setMode('MANUAL')}
          className="btn"
          style={{ flex: 1, justifyContent: 'center', border: mode === 'MANUAL' ? '2px solid var(--primary)' : '1px solid var(--border)', background: mode === 'MANUAL' ? 'var(--primary-subtle)' : 'var(--bg-surface)', fontWeight: 600, color: mode === 'MANUAL' ? 'var(--primary-dark)' : 'var(--text-secondary)' }}
        >
          ✍️ Manual Entry
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

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        {months.map((m) => (
          <div key={m.id} style={{ background: 'var(--bg-elevated)', border: '1.5px dashed var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
            {m.ocrStatus === 'COMPLETED' ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>{m.label} Processed</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>Net: ₹{m.result?.net_salary?.toLocaleString('en-IN') || 0}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => mode === 'OCR' ? handleUploadClick(m.id) : handleManualClick(m.id)}
                  disabled={loadingMonth !== null}
                >
                  {mode === 'OCR' ? 'Re-upload' : 'Edit Details'}
                </button>
              </>
            ) : m.isUploaded ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--info)', marginBottom: 4 }}>{m.label} Uploaded</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.fileName || 'Salary slip document'}>
                  {m.fileName || 'Document attached'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => mode === 'OCR' ? handleUploadClick(m.id) : handleManualClick(m.id)}
                  disabled={loadingMonth !== null || runningAllOcr}
                >
                  {mode === 'OCR' ? 'Change File' : 'Enter Details'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>{mode === 'OCR' ? 'Upload salary slip PDF / image' : 'Enter manual salary values'}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', opacity: loadingMonth === m.id ? 0.7 : 1 }}
                  onClick={() => mode === 'OCR' ? handleUploadClick(m.id) : handleManualClick(m.id)}
                  disabled={loadingMonth !== null || runningAllOcr}
                >
                  {loadingMonth === m.id ? (mode === 'OCR' ? 'Uploading...' : 'Saving...') : (mode === 'OCR' ? 'Upload Slip' : 'Enter Details')}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {mode === 'OCR' && months.some(m => m.isUploaded && m.ocrStatus !== 'COMPLETED') && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <button
            type="button"
            className="btn btn-lg"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', border: 'none', width: '100%', maxWidth: 300, justifyContent: 'center' }}
            onClick={handleRunAllOcr}
            disabled={runningAllOcr || loadingMonth !== null}
          >
            {runningAllOcr ? 'Processing OCR...' : 'Run OCR on Uploaded Slips ✨'}
          </button>
        </div>
      )}

      {completedCount > 0 && summary && summary.length > 0 && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 12, padding: 16, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>OCR Extraction Complete — {applicantName || summary[0]?.employee_name}</span>
            <span style={{ marginLeft: 'auto', background: 'var(--bg-surface)', color: 'var(--success)', padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
              {completedCount} slip{completedCount > 1 ? 's' : ''} processed
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Employer</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{summary[0]?.employer_name || '-'}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Latest Gross Salary</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>₹{summary[0]?.gross_salary?.toLocaleString('en-IN') || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>/ month</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Deductions</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>₹{summary[0]?.deductions?.toLocaleString('en-IN') || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>/ month</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', border: '2px solid var(--success)', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Net Take-Home</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--success)' }}>₹{avgNet.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>/ month (avg {completedCount} mo)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipUploader;
