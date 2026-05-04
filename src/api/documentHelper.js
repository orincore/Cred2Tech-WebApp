/**
 * documentHelper.js
 *
 * Utility to trigger authenticated file downloads/views via the document storage API.
 * Uses axios (with auth interceptor) to fetch the file, then creates a blob URL
 * and clicks it — this correctly sends the Authorization header, unlike plain <a href>.
 */
import api from './axiosInstance';

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
 */
export async function uploadDocument(file, caseId, docType) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    formData.append('document_type', docType || 'OTHER');

    const response = await api.post('/documents/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}
