// misService.js
// API service for the MIS Reports module (DSA Admin only).

import api from './axiosInstance';

export const listMisReports = () =>
  api.get('/mis/reports').then(r => r.data);

export const getMisFilterOptions = () =>
  api.get('/mis/filter-options').then(r => r.data);

export const getMisReport = (reportId, params = {}) =>
  api.get(`/mis/reports/${reportId}`, { params }).then(r => r.data);

// Streams an .xlsx file straight through the browser's own download prompt —
// same pattern as the existing Lender Commission / Sub-DSA Payout exports.
export const exportMisReport = async (reportId, params = {}) => {
  const response = await api.get(`/mis/reports/${reportId}/export`, { params, responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match ? match[1].trim() : `${reportId}.xlsx`;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
