import api from './axiosInstance';

// ESR Public API: the client's own dashboard (/esr-api-portal) and the Super Admin console (/admin/esr-api).
// Every call returns the response body; errors carry { error, code } and are shown with apiError().
const data = (r) => r.data;
export const apiError = (err, fallback = 'Something went wrong') => err?.response?.data?.error || err?.message || fallback;

// The secret of a new key is shown once and must never be kept: this module does not cache any response.
const P = '/esr-api-portal';
const A = '/admin/esr-api';

export const esrApiPortal = {
  me: () => api.get(`${P}/me`).then(data),
  features: () => api.get(`${P}/features`).then(data),

  keys: () => api.get(`${P}/keys`).then(data),
  createKey: (body) => api.post(`${P}/keys`, body).then(data),
  rotateKey: (id, body = {}) => api.post(`${P}/keys/${id}/rotate`, body).then(data),
  revokeKey: (id, reason) => api.post(`${P}/keys/${id}/revoke`, { reason }).then(data),

  ips: () => api.get(`${P}/ip-allowlist`).then(data),
  addIp: (body) => api.post(`${P}/ip-allowlist`, body).then(data),
  removeIp: (id) => api.delete(`${P}/ip-allowlist/${id}`).then(data),

  logs: (params) => api.get(`${P}/logs`, { params }).then(data),
  log: (requestId) => api.get(`${P}/logs/${encodeURIComponent(requestId)}`).then(data),
  // The CSV needs the login token, which a plain link cannot send: fetch it and hand the browser the bytes.
  exportLogs: async (params) => {
    const r = await api.get(`${P}/logs/export.csv`, { params, responseType: 'blob' });
    return r.data;
  },
  usage: (params) => api.get(`${P}/usage`, { params }).then(data),

  billing: () => api.get(`${P}/billing`).then(data),
  ledger: (params) => api.get(`${P}/billing/ledger`, { params }).then(data),
  topups: (params) => api.get(`${P}/billing/topups`, { params }).then(data),
  createTopup: (amountInr) => api.post(`${P}/billing/topups`, { amount_inr: amountInr }).then(data),
  confirmTopup: (body) => api.post(`${P}/billing/topups/confirm`, body).then(data),
  topupPdf: (id) => api.get(`${P}/billing/topups/${id}/pdf`, { responseType: 'blob' }).then(data),
  invoices: (params) => api.get(`${P}/billing/invoices`, { params }).then(data),
  invoice: (id) => api.get(`${P}/billing/invoices/${id}`).then(data),
  invoicePdf: (id) => api.get(`${P}/billing/invoices/${id}/pdf`, { responseType: 'blob' }).then(data),
  payInvoice: (id) => api.post(`${P}/billing/invoices/${id}/pay`).then(data),
  confirmInvoicePayment: (id, body) => api.post(`${P}/billing/invoices/${id}/pay/confirm`, body).then(data),

  team: () => api.get(`${P}/team`).then(data),
  invite: (body) => api.post(`${P}/team`, body).then(data),
  updateMember: (id, body) => api.patch(`${P}/team/${id}`, body).then(data),
  resendInvite: (id) => api.post(`${P}/team/${id}/resend-invite`).then(data),
};

export const esrApiAdmin = {
  overview: () => api.get(`${A}/overview`).then(data),
  lenders: () => api.get(`${A}/lenders`).then((r) => r.data.lenders),
  clients: (params) => api.get(`${A}/clients`, { params }).then(data),
  client: (id) => api.get(`${A}/clients/${id}`).then(data),
  createClient: (body) => api.post(`${A}/clients`, body).then(data),
  updateSettings: (id, settings, reason) => api.patch(`${A}/clients/${id}/settings`, { settings, reason }).then(data),
  changeBillingMode: (id, body) => api.post(`${A}/clients/${id}/billing-mode`, body).then(data),

  createKey: (id, body) => api.post(`${A}/clients/${id}/keys`, body).then(data),
  rotateKey: (id, keyId, body = {}) => api.post(`${A}/clients/${id}/keys/${keyId}/rotate`, body).then(data),
  revokeKey: (id, keyId, reason) => api.post(`${A}/clients/${id}/keys/${keyId}/revoke`, { reason }).then(data),
  addIp: (id, body) => api.post(`${A}/clients/${id}/ip-allowlist`, body).then(data),
  removeIp: (id, ipId) => api.delete(`${A}/clients/${id}/ip-allowlist/${ipId}`).then(data),

  pricing: (params) => api.get(`${A}/pricing`, { params }).then(data),
  previewPricing: (body) => api.post(`${A}/pricing/preview`, body).then(data),
  addPricing: (body) => api.post(`${A}/pricing`, body).then(data),

  ledger: (id, params) => api.get(`${A}/clients/${id}/ledger`, { params }).then(data),
  adjust: (id, body) => api.post(`${A}/clients/${id}/adjustments`, body).then(data),
  reverseAdjustment: (id, ledgerId, reason) => api.post(`${A}/clients/${id}/adjustments/${ledgerId}/reverse`, { reason }).then(data),

  generateInvoice: (id, month) => api.post(`${A}/clients/${id}/invoices`, { month }).then(data),
  invoices: (params) => api.get(`${A}/invoices`, { params }).then(data),
  invoice: (id) => api.get(`${A}/invoices/${id}`).then(data),
  invoicePdf: (id) => api.get(`${A}/invoices/${id}/pdf`, { responseType: 'blob' }).then(data),
  recordPayment: (id, body) => api.post(`${A}/invoices/${id}/payments`, body).then(data),
  resendInvoice: (id) => api.post(`${A}/invoices/${id}/resend`).then(data),
  topups: (params) => api.get(`${A}/topups`, { params }).then(data),
  topupPdf: (id) => api.get(`${A}/topups/${id}/pdf`, { responseType: 'blob' }).then(data),

  // An API top-up is refunded through the one refund pipeline every other payment uses.
  refundPreview: (topupId, params) => api.get('/admin/transactions/refunds/preview', { params: { source: 'ESR_API_TOPUP', id: topupId, ...params } }).then(data),
  refund: (body) => api.post('/admin/transactions/refunds', { source: 'ESR_API_TOPUP', ...body }).then(data),
};

/** Saves a Blob the browser already holds, with a file name. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
