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

// The platform dashboard covers the main app AND every white-label organisation ('all'), added up. A caller may
// still pass its own org_id (one organisation, or 'main' for the main app only).
const platformParams = (params = {}) => ({ org_id: 'all', ...params });

export const getPlatformSummary = async (params) => {
  const response = await api.get('/dashboard/platform/summary', { params: platformParams(params) });
  return response.data;
};

export const getPlatformApiUsage = async (params) => {
  const response = await api.get('/dashboard/platform/api-usage', { params: platformParams(params) });
  return response.data;
};

export const getPlatformFunnel = async (params) => {
  const response = await api.get('/dashboard/platform/funnel', { params: platformParams(params) });
  return response.data;
};

export const getTopDsas = async (params) => {
  const response = await api.get('/dashboard/platform/top-dsas', { params: platformParams(params) });
  return response.data;
};

export const getTopLenders = async (params) => {
  const response = await api.get('/dashboard/platform/top-lenders', { params: platformParams(params) });
  return response.data;
};
