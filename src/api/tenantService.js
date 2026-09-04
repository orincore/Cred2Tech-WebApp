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

export const updateTenantVirtualWorkspace = async (id, isActive) => {
  const response = await api.patch(`/tenants/${id}/virtual-workspace`, { is_active: isActive });
  return response.data;
};

export const getTenantById = async (id) => {
  const response = await api.get(`/tenants/${id}`);
  return response.data;
};

export const updateTenant = async (id, tenantData) => {
  const response = await api.put(`/tenants/${id}`, tenantData);
  return response.data;
};

// The DSA Partner Agreement is generated fresh per request (the tenant's
// name is substituted in server-side), not a static file — returns a Blob
// so the caller can preview it (object URL in a new tab) rather than
// forcing a download, matching how the registration page's Terms of
// Use/Privacy Policy links open in a new tab too.
export const getDsaAgreementPdfBlob = async (id) => {
  const response = await api.get(`/tenants/${id}/dsa-agreement`, { responseType: 'blob' });
  return new Blob([response.data], { type: 'application/pdf' });
};

// Public — no auth token required
export const publicRegisterDSA = async (data) => {
  // We use the base axios instance without the interceptor to avoid injecting tokens on public routes
  const response = await axios.post(`${api.defaults.baseURL || ''}/tenants/public-register`, data);
  return response.data;
};

// Public — PAN/GST auto-fill lookup used by the registration wizard.
export const publicLookupPan = async (pan_number, turnstile_token) => {
  const response = await axios.post(`${api.defaults.baseURL || ''}/tenants/public-lookup-pan`, { pan_number, turnstile_token });
  return response.data;
};

// Global cross-tenant listing for the dedicated admin Subscriptions page.
export const listAllVirtualWorkspaceSubscriptions = async () => {
  const response = await api.get(`/admin/virtual-workspace/subscriptions`);
  return response.data;
};

export const getTenantSummary = async (tenantId) => {
  const response = await api.get(`/admin/tenants/${tenantId}/summary`);
  return response.data;
};

export const grantFreeVirtualWorkspace = async (tenantId) => {
  const response = await api.post(`/admin/tenants/${tenantId}/virtual-workspace/grant-free`);
  return response.data;
};

export const adminSubscribeVirtualWorkspace = async (tenantId, { planId, paymentMethod, promoCode }) => {
  const response = await api.post(`/admin/tenants/${tenantId}/virtual-workspace/subscribe`, { plan_id: planId, payment_method: paymentMethod, promo_code: promoCode });
  return response.data;
};

// Switches an already-subscribed tenant to a different plan — takes effect
// immediately (see upgradePlan() in virtualWorkspaceSubscription.service.js).
export const adminUpgradeVirtualWorkspacePlan = async (tenantId, { planId, promoCode }) => {
  const response = await api.post(`/admin/tenants/${tenantId}/virtual-workspace/upgrade`, { plan_id: planId, promo_code: promoCode });
  return response.data;
};

export const adminExtendVirtualWorkspace = async (tenantId, newEndDate) => {
  const response = await api.post(`/admin/tenants/${tenantId}/virtual-workspace/extend`, { new_end_date: newEndDate });
  return response.data;
};

// Free admin credit allocation directly to a tenant's own wallet.
export const adminTopupTenantWallet = async (tenantId, credits, remarks) => {
  const response = await api.post(`/admin/tenants/${tenantId}/wallet/topup`, { credits, remarks });
  return response.data;
};
export const adminDeductTenantWallet = async (tenantId, credits, remarks) => {
  const response = await api.post(`/admin/tenants/${tenantId}/wallet/deduct`, { credits, remarks });
  return response.data;
};

// Team/employee credit management — allocate or revoke credits between the
// tenant's own wallet and one member's (sub-DSA/employee) wallet.
export const getTenantEmployees = async (tenantId) => {
  const response = await api.get(`/admin/tenants/${tenantId}/employees`);
  return response.data;
};
export const allocateTenantEmployeeCredits = async (tenantId, userId, credits, note) => {
  const response = await api.post(`/admin/tenants/${tenantId}/employees/${userId}/allocate`, { credits, note });
  return response.data;
};
export const revokeTenantEmployeeCredits = async (tenantId, userId, credits, note) => {
  const response = await api.post(`/admin/tenants/${tenantId}/employees/${userId}/revoke`, { credits, note });
  return response.data;
};
export const getTenantEmployeeTransactions = async (tenantId, userId) => {
  const response = await api.get(`/admin/tenants/${tenantId}/employees/${userId}/transactions`);
  return response.data;
};

export const adminCancelVirtualWorkspace = async (tenantId) => {
  const response = await api.post(`/admin/tenants/${tenantId}/virtual-workspace/cancel`);
  return response.data;
};

// Public — DSA registration wizard's email/mobile OTP verification.
export const sendDsaVerificationOtp = async ({ session_id, channel, destination }) => {
  const response = await axios.post(`${api.defaults.baseURL || ''}/tenants/verify/send-otp`, { session_id, channel, destination });
  return response.data;
};

export const confirmDsaVerificationOtp = async ({ session_id, channel, destination, otp }) => {
  const response = await axios.post(`${api.defaults.baseURL || ''}/tenants/verify/confirm-otp`, { session_id, channel, destination, otp });
  return response.data;
};
