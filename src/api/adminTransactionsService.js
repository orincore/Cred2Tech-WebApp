import axiosInstance from './axiosInstance';

// Only real filter keys are ever sent — undefined/empty values are dropped so
// the backend's default (no filter on that field) applies instead of an
// accidental `?status=` or `?date_from=` matching nothing.
const buildParams = (filters = {}) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value;
  });
  return params;
};

const downloadBlob = (response, fallbackName) => {
  const disposition = response.headers?.['content-disposition'] || '';
  const utf8FileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedFileName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = utf8FileName ? decodeURIComponent(utf8FileName) : (quotedFileName || fallbackName);

  const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const adminTransactionsService = {
  list: async (filters = {}) => {
    const response = await axiosInstance.get('/admin/transactions', { params: buildParams(filters) });
    return response.data;
  },

  summary: async (filters = {}) => {
    const response = await axiosInstance.get('/admin/transactions/summary', { params: buildParams(filters) });
    return response.data;
  },

  exportExcel: async (filters = {}) => {
    const response = await axiosInstance.get('/admin/transactions/export.xlsx', {
      params: buildParams(filters),
      responseType: 'blob',
    });
    downloadBlob(response, 'Cred2Tech_Transactions.xlsx');
  },

  exportPdf: async (filters = {}) => {
    const response = await axiosInstance.get('/admin/transactions/export.pdf', {
      params: buildParams(filters),
      responseType: 'blob',
    });
    downloadBlob(response, 'Cred2Tech_Transactions.pdf');
  },

  // Everything about one transaction (the "tap a row" view).
  details: async ({ source, id }) => {
    const response = await axiosInstance.get('/admin/transactions/details', { params: { source, id } });
    return response.data;
  },

  // Every refund of one tenant (the tenant page's Refunds tab).
  listTenantRefunds: async (tenantId, { page = 1, limit = 25 } = {}) => {
    const response = await axiosInstance.get('/admin/transactions/refunds', { params: { tenant_id: tenantId, page, limit } });
    return response.data;
  },

  // ── Refunds (Razorpay refund + wallet credits + GST credit note) ──────────────
  // What a refund would do. No side effects — safe to call as the admin types.
  refundPreview: async ({ source, id, amountInr, full }) => {
    const response = await axiosInstance.get('/admin/transactions/refunds/preview', {
      params: buildParams({ source, id, amount_inr: amountInr, full: full ? 'true' : undefined }),
    });
    return response.data;
  },

  // Issues the refund. `idempotencyKey` is generated once per open modal, so a double click
  // or a retry after a dropped connection returns the same refund instead of a second one.
  issueRefund: async ({ source, id, mode, amountInr, reason, idempotencyKey, speed, allowLowBalance }) => {
    const response = await axiosInstance.post('/admin/transactions/refunds', {
      source, id, mode, amount_inr: amountInr, reason, idempotency_key: idempotencyKey, speed,
      allow_low_balance: allowLowBalance === true,
    });
    return response.data;
  },

  listRefunds: async ({ source, id }) => {
    const response = await axiosInstance.get('/admin/transactions/refunds', { params: { source, id } });
    return response.data.refunds;
  },

  // Asks Razorpay now for the real state of one refund (for a refund still pending on our side).
  recheckRefund: async (refundId) => {
    const response = await axiosInstance.post(`/admin/transactions/refunds/${refundId}/recheck`);
    return response.data.refund;
  },

  downloadCreditNote: async (refundId) => {
    const response = await axiosInstance.get(`/admin/transactions/refunds/${refundId}/credit-note.pdf`, { responseType: 'blob' });
    downloadBlob(response, 'Credit_Note.pdf');
  },
};

export default adminTransactionsService;
