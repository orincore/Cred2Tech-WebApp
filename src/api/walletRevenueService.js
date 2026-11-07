import axiosInstance from './axiosInstance';

// Same rule as adminTransactionsService: only real params are sent, so an
// empty field never turns into an accidental `?month=` filter.
const buildParams = (filters = {}) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value;
  });
  return params;
};

const downloadBlob = (response, fallbackName) => {
  const disposition = response.headers?.['content-disposition'] || '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
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

export const walletRevenueService = {
  financialYears: async () => (await axiosInstance.get('/admin/wallet-revenue/financial-years')).data,
  summary: async (period = {}) => (await axiosInstance.get('/admin/wallet-revenue/summary', { params: buildParams(period) })).data,
  register: async (params = {}) => (await axiosInstance.get('/admin/wallet-revenue/register', { params: buildParams(params) })).data,
  // `sections`: sheet names to include (see exportSections); leave empty for the whole workbook.
  exportExcel: async (period = {}, sections = []) => {
    const response = await axiosInstance.get('/admin/wallet-revenue/export.xlsx', {
      params: buildParams({ ...period, sections: sections.length ? sections.join(',') : undefined }), responseType: 'blob',
    });
    downloadBlob(response, 'Cred2Tech_Wallet_Revenue_GST.xlsx');
  },
  exportSections: async () => (await axiosInstance.get('/admin/wallet-revenue/export-sections')).data.sections,
  // The invoice register with the screen's search / filters / sort, all pages.
  exportRegister: async (params = {}) => {
    const response = await axiosInstance.get('/admin/wallet-revenue/register/export.xlsx', { params: buildParams(params), responseType: 'blob' });
    downloadBlob(response, 'Cred2Tech_Invoice_Register.xlsx');
  },
  // Any table(s) exactly as shown: { title, tables: [{ title, subtitle, columns: [{label, type, total}], rows: [[...]] }] }.
  exportTables: async (payload) => {
    const response = await axiosInstance.post('/admin/wallet-revenue/export-table.xlsx', payload, { responseType: 'blob' });
    downloadBlob(response, 'Cred2Tech_Export.xlsx');
  },
};

export default walletRevenueService;
