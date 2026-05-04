import api from './axiosInstance';
import axios from 'axios';

export const getTenants = async () => {
  const response = await api.get('/tenants');
  return response.data;
};

export const createTenant = async (tenantData) => {
  const response = await api.post('/tenants', tenantData);
  return response.data;
};

export const updateTenantStatus = async (id, status) => {
  const response = await api.patch(`/tenants/${id}/status`, { status });
  return response.data;
};

// Public — no auth token required
export const publicRegisterDSA = async (data) => {
  // We use the base axios instance without the interceptor to avoid injecting tokens on public routes
  const response = await axios.post(`${api.defaults.baseURL || ''}/tenants/public-register`, data);
  return response.data;
};

export const getTenantSummary = async (tenantId) => {
  const response = await api.get(`/admin/tenants/${tenantId}/summary`);
  return response.data;
};
