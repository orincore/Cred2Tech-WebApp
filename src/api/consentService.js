import api from './axiosInstance';
import { getApiBaseUrl } from '../lib/apiBase';
import axios from 'axios';

// The DSA-side calls below carry the normal auth token via the shared
// axios instance. The public consent-page calls (getPublicDetails/approve)
// must NOT — there is no logged-in session for a customer following an
// emailed link, and axiosInstance's interceptor would attach/ react to a
// stale or absent token. They go through plain axios with the API base URL
// instead.

export const consentService = {
  // DSA-side (authenticated). Pass applicant_id when this is a specific
  // co-applicant's own consent request (PAN only, sent to their own email)
  // rather than the primary customer's (PAN+GST+ITR+Bank).
  requestConsent: async ({ customer_id, case_id, applicant_id }) => {
    const response = await api.post('/consent/request', { customer_id, case_id, applicant_id });
    return response.data;
  },

  getStatus: async (requestId) => {
    const response = await api.get(`/consent/status/${requestId}`);
    return response.data;
  },

  // Rehydrates whatever consent request is still live for this subject
  // (PENDING or GRANTED) — used on mount so a page reload / re-login doesn't
  // lose track of a request that only ever existed as this tab's React
  // state. Returns null when there's nothing active to resume. case_id is
  // required for the primary lookup (applicant_id omitted) — consent is
  // per-case, so this must never return a sibling case's own request.
  getLatest: async ({ customer_id, case_id, applicant_id } = {}) => {
    const response = await api.get('/consent/latest', { params: { customer_id, case_id, applicant_id } });
    return response.data;
  },

  // Public — the customer's own page, no auth.
  getPublicDetails: async (token) => {
    const response = await axios.get(`${getApiBaseUrl()}/consent/${token}`);
    return response.data;
  },

  approve: async (token, otp) => {
    const response = await axios.post(`${getApiBaseUrl()}/consent/${token}/approve`, { agreed: true, otp });
    return response.data;
  },

  resendOtp: async (token) => {
    const response = await axios.post(`${getApiBaseUrl()}/consent/${token}/resend-otp`);
    return response.data;
  },

  // Direct MSME self-service (authenticated) — a separate mechanism from
  // the DSA-side requestConsent/approve/resendOtp above, not a variant of
  // them: no link is ever sent, and the customer is the one already
  // logged in, granting their own consent inline (see
  // AddCustomerWizardPage's self-consent modal) rather than approving on a
  // separate public page reached via SMS/email.
  requestSelf: async ({ customer_id, case_id, applicant_id }) => {
    const response = await api.post('/consent/self/request', { customer_id, case_id, applicant_id });
    return response.data;
  },

  approveSelf: async ({ id, otp, case_id }) => {
    const response = await api.post(`/consent/self/${id}/approve`, { otp, case_id });
    return response.data;
  },

  resendOtpSelf: async ({ id, case_id }) => {
    const response = await api.post(`/consent/self/${id}/resend-otp`, { case_id });
    return response.data;
  },
};
