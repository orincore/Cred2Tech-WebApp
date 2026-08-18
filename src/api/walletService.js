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
};

export default walletService;
