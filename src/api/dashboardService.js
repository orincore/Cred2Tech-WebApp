import api from './axiosInstance';

// ─── DSA Dashboard ─────────────────────────────────────────────────────────

export const getDsaSummary = async (params) => {
  const response = await api.get('/dashboard/dsa/summary', { params });
  return response.data;
};

export const getDsaWallet = async () => {
  const response = await api.get('/dashboard/dsa/wallet');
  return response.data;
};

export const getDsaCases = async (params) => {
  const response = await api.get('/dashboard/dsa/cases', { params });
  return response.data;
};

export const getDsaStageSummary = async (params) => {
  const response = await api.get('/dashboard/dsa/stage-summary', { params });
  return response.data;
};

// ─── Platform Dashboard (SUPER_ADMIN) ──────────────────────────────────────

export const getPlatformSummary = async (params) => {
  const response = await api.get('/dashboard/platform/summary', { params });
  return response.data;
};

export const getPlatformApiUsage = async (params) => {
  const response = await api.get('/dashboard/platform/api-usage', { params });
  return response.data;
};

export const getPlatformFunnel = async (params) => {
  const response = await api.get('/dashboard/platform/funnel', { params });
  return response.data;
};

export const getTopDsas = async (params) => {
  const response = await api.get('/dashboard/platform/top-dsas', { params });
  return response.data;
};

export const getTopLenders = async (params) => {
  const response = await api.get('/dashboard/platform/top-lenders', { params });
  return response.data;
};
