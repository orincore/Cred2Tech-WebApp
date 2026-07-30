/**
 * documentHelper.js
 *
 * Utility to trigger authenticated file downloads/views via the document storage API.
 * Uses axios (with auth interceptor) to fetch the file, then creates a blob URL
 * and clicks it — this correctly sends the Authorization header, unlike plain <a href>.
 */
import api from './axiosInstance';

/**
 * List stored documents for a case or customer (optionally scoped to one
 * applicant). At least one of caseId/customerId is required by the backend.
 * @param {{caseId?: number, customerId?: number, applicantId?: number, documentType?: string}} params
 */
export async function listDocuments({ caseId, customerId, applicantId, documentType } = {}) {
    const response = await api.get('/documents', {
        params: { case_id: caseId, customer_id: customerId, document_type: documentType },
    });
    const docs = response.data.data || [];
    return applicantId ? docs.filter(d => d.applicant_id === applicantId) : docs;
}

/**
 * Trigger a browser file download for a stored document.
 * @param {number} documentId
 * @param {string} fileName - display name for the saved file
 */
export async function downloadDocument(documentId, fileName) {
    const response = await api.get(`/documents/${documentId}/download`, {
        responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `document_${documentId}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

/**
 * Open a stored document inline in a new browser tab (for PDF preview etc.)
 * @param {number} documentId
 */
export async function viewDocument(documentId) {
    const response = await api.get(`/documents/${documentId}/view`, {
        responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after delay to allow tab to load
    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
}

/**
 * Get the direct URL for embedding in anchor tags when auth headers can be sent.
 * For most cases use downloadDocument() or viewDocument() above instead.
 */
export function getDocumentViewUrl(documentId) {
    return `/documents/${documentId}/view`;
}
/**
 * Upload a document directly to a case.
 * @param {File} file
 * @param {number} caseId
 * @param {string} docType
 * @param {{applicantId?: number, label?: string, category?: string, categoryLabel?: string}} [options] -
 *   applicantId scopes the document to one applicant (ID/address proof);
 *   label is a free-text name for docType OTHER uploads that don't fit a
 *   fixed sub-type; category tags which KYC document category an OTHER
 *   upload belongs to (docType OTHER is shared by several categories'
 *   "Others" option, the freeform bucket, and every user-created custom
 *   category, so this disambiguates them); categoryLabel is the display name
 *   for a custom category, persisted so it survives a reload.
 */
export async function uploadDocument(file, caseId, docType, options = {}) {
    const { applicantId, label, category, categoryLabel } = options;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    formData.append('document_type', docType || 'OTHER');
    if (applicantId) formData.append('applicant_id', applicantId);
    if (label) formData.append('label', label);
    if (category) formData.append('category', category);
    if (categoryLabel) formData.append('category_label', categoryLabel);

    const response = await api.post('/documents/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}
