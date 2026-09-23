import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { caseService } from '../../api/caseService';

const formatINR = (amount) => Number(amount || 0).toLocaleString('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
});

const BulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setOverwrite(false);
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await caseService.downloadBulkUploadTemplate();
      toast.success('Template downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download template');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const data = await caseService.uploadBulkCases(file, { overwrite });
      setResult(data);
      if (data.success) {
        toast.success(`Imported ${data.summary.createdCases} case(s). ESR generated for ${data.summary.esrGeneratedCases || 0}.`);
        if (onSuccess) onSuccess();
      } else {
        toast.error('Bulk upload failed. Check the errors below.');
      }
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data && data.errors) {
        setResult(data);
        toast.error('Validation failed. Check the errors below.');
      } else {
        toast.error('Error processing the file. Ensure it matches the template.');
      }
    } finally {
      setUploading(false);
    }
  };

  const failedRows = result?.summary?.failedRows || 0;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-box" style={{ maxWidth: 640, width: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Bulk Upload Cases</h2>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>Upload a multi-sheet Excel file to create cases and auto-generate ESR</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {/* Step 1 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Step 1 · Download Template</div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 12 }}>
              Download the official multi-sheet Excel template and follow the instructions in the first sheet.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate} disabled={downloading}>
              <FileSpreadsheet size={16} color="var(--success)" /> {downloading ? 'Downloading…' : 'Download Excel Template'}
            </button>
          </div>

          <div className="divider" />

          {/* Step 2 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Step 2 · Upload Filled File</div>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: 32,
                textAlign: 'center', background: 'var(--bg-elevated)', cursor: 'pointer'
              }}
            >
              <Upload size={30} color="var(--text-tertiary)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>
                Click to select a file
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {file ? file.name : 'Excel (.xlsx) files only'}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx"
                style={{ display: 'none' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Overwrite existing Case Refs — if a row's Case Ref already exists, replace that case with this row instead of failing it.
                Only applies to cases originally created via bulk upload with no payments, sanctions, or disbursements recorded against them.
              </span>
            </label>
          </div>

          {/* Results */}
          {result && (
            <div className={`notice ${failedRows > 0 ? 'notice-warning' : ''}`} style={{
              marginTop: 20, flexDirection: 'column', alignItems: 'stretch',
              background: failedRows > 0 ? 'var(--error-bg)' : 'var(--success-bg)',
              borderColor: failedRows > 0 ? 'var(--error)' : 'var(--success)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: failedRows > 0 ? 'var(--error)' : 'var(--success)' }}>
                {failedRows > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />} Upload Complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span>Total: <b>{result.summary?.totalRows || 0}</b></span>
                <span style={{ color: 'var(--success)' }}>Success: <b>{result.summary?.createdCases || 0}</b></span>
                <span style={{ color: 'var(--error)' }}>Failed: <b>{failedRows}</b></span>
                <span style={{ color: 'var(--primary)' }}>ESR Done: <b>{result.summary?.esrGeneratedCases || 0}</b></span>
                <span style={{ color: 'var(--warning)' }}>ESR Failed: <b>{result.summary?.esrFailedCases || 0}</b></span>
              </div>

              {result.createdCases?.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto', fontSize: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                        <th style={{ padding: '6px 8px' }}>Case Ref</th>
                        <th style={{ padding: '6px 8px' }}>Customer</th>
                        <th style={{ padding: '6px 8px' }}>ESR</th>
                        <th style={{ padding: '6px 8px' }}>Eligible Lenders</th>
                        <th style={{ padding: '6px 8px' }}>Final Eligibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.createdCases.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '6px 8px' }}>{c.caseRef}</td>
                          <td style={{ padding: '6px 8px' }}>{c.customerName}</td>
                          <td style={{ padding: '6px 8px', color: c.esrGenerated ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                            {c.esrGenerated ? 'Generated' : 'Failed'}
                          </td>
                          <td style={{ padding: '6px 8px' }}>{c.eligibleLenderCount || 0}/{c.totalLenderCount || 0}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{formatINR(c.finalLoanEligibility)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.warnings?.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto', fontSize: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--warning)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--warning)', textAlign: 'left', color: 'var(--warning)' }}>
                        <th style={{ padding: '6px 8px' }}>Row</th>
                        <th style={{ padding: '6px 8px' }}>Case Ref</th>
                        <th style={{ padding: '6px 8px' }}>Warning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.warnings.map((w, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '6px 8px' }}>{w.row}</td>
                          <td style={{ padding: '6px 8px' }}>{w.caseRef}</td>
                          <td style={{ padding: '6px 8px' }}>{w.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto', fontSize: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--error)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--error)', textAlign: 'left', color: 'var(--error)' }}>
                        <th style={{ padding: '6px 8px' }}>Row</th>
                        <th style={{ padding: '6px 8px' }}>Case Ref</th>
                        <th style={{ padding: '6px 8px' }}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '6px 8px' }}>{e.row}</td>
                          <td style={{ padding: '6px 8px' }}>{e.caseRef}</td>
                          <td style={{ padding: '6px 8px' }}>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Processing ESR…' : 'Upload, Import & Generate ESR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
