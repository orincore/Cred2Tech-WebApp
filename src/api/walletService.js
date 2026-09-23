import api from './axiosInstance';

// Only real filter keys are ever sent — undefined/empty values are dropped so
// the backend's default (no filter on that field) applies instead of an
// accidental `?date_from=` matching nothing. Same convention as
// adminTransactionsService.js.
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

export const walletService = {
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },

  getTransactions: async (filters = {}) => {
    const response = await api.get('/wallet/transactions', { params: buildParams(filters) });
    return response.data;
  },

  exportTransactions: async (filters = {}) => {
    const response = await api.get('/wallet/transactions/export', {
      params: buildParams(filters),
      responseType: 'blob',
    });
    downloadBlob(response, 'Wallet_Transactions.xlsx');
  },

  // ── Recharge (Razorpay top-up) ─────────────────────────────────────────
  // Amount-independent lookup — the first call the Recharge Wallet modal
  // makes when a code is typed in, before any amount exists. Tells the
  // frontend which UI to show: a FREEBIE code needs no amount input at all
  // (see redeemFreebiePromo), DISCOUNT/CASHBACK keep the normal flow.
  getPromoInfo: async (promoCode) => {
    const response = await api.get('/wallet/topups/promo-info', { params: { promo_code: promoCode } });
    return response.data;
  },

  // Read-only preview (dryRun promo check) — used to show the volume-
  // discount bonus tier and, once a code is typed in, its effect (discount
  // or cashback bonus), before the DSA commits to Checkout.
  getTopupPreview: async (amountInr, promoCode = null) => {
    const params = { amount_inr: amountInr };
    if (promoCode) params.promo_code = promoCode;
    const response = await api.get('/wallet/topups/preview', { params });
    return response.data;
  },

  createTopupOrder: async (amountInr, promoCode = null) => {
    const response = await api.post('/wallet/topups/create-order', { amount_inr: amountInr, promo_code: promoCode });
    return response.data;
  },

  // FREEBIE codes only — no amount, no Razorpay, no checkout. The credited
  // amount always comes from the code's own server-side-defined value;
  // there is nothing to pass here beyond the code itself.
  redeemFreebiePromo: async (promoCode) => {
    const response = await api.post('/wallet/topups/redeem-freebie', { promo_code: promoCode });
    return response.data;
  },

  verifyTopupCheckout: async (payload) => {
    const response = await api.post('/wallet/topups/verify-checkout', payload);
    return response.data;
  },

  getTopups: async (filters = {}) => {
    const response = await api.get('/wallet/topups', { params: buildParams(filters) });
    return response.data;
  },

  downloadInvoice: async (topupId, invoiceNumber) => {
    const response = await api.get(`/wallet/topups/${topupId}/invoice`, { responseType: 'blob' });
    downloadBlob(response, `${invoiceNumber || `invoice-${topupId}`}.pdf`);
  },

  // ── Employee credit allocation (DSA_ADMIN) ─────────────────────────────
  getEmployees: async () => {
    const response = await api.get('/wallet/employees');
    return response.data;
  },

  allocateEmployeeCredits: async (userId, credits, note) => {
    const response = await api.post(`/wallet/employees/${userId}/allocate`, { credits, note });
    return response.data;
  },

  revokeEmployeeCredits: async (userId, credits, note) => {
    const response = await api.post(`/wallet/employees/${userId}/revoke`, { credits, note });
    return response.data;
  },
};

export default walletService;
