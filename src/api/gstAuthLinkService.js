import api from './axiosInstance';
import axios from 'axios';

// Same split as itrAuthLinkService.js: DSA-side calls carry the normal auth
// token via the shared axios instance; the public auth-page calls
// (getPublicDetails/submit) go through plain axios with the API base URL,
// since there is no logged-in session for a customer following an emailed
// link.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const gstAuthLinkService = {
  // DSA-side (authenticated) — sends the customer an emailed link to
  // self-authorise the GST pull instead of the DSA keying in the portal
  // password themselves. gstin is the only pull parameter the DSA supplies —
  // the date window is fixed/auto-computed server-side (see
  // gstAuthLink.service.js's computeGstDateWindow), same as the DSA-direct
  // form already hides it.
  requestLink: async ({ customer_id, case_id, applicant_id, gstin }) => {
    const response = await api.post('/gst-auth-link/request', { customer_id, case_id, applicant_id, gstin });
    return response.data;
  },

  // DSA-side (authenticated) — revokes a still-pending link before the
  // customer has used it.
  cancelLink: async (id) => {
    const response = await api.post(`/gst-auth-link/${id}/cancel`);
    return response.data;
  },

  // Public — the customer's own page, no auth.
  getPublicDetails: async (token) => {
    const response = await axios.get(`${API_BASE_URL}/gst-auth-link/${token}`);
    return response.data;
  },

  submit: async (token, { username, password, authType }) => {
    const response = await axios.post(`${API_BASE_URL}/gst-auth-link/${token}/submit`, { username, password, auth_type: authType });
    return response.data;
  },

  // Public — the OTP step for an OTP-mode request already in OTP_PENDING
  // (see getPublicDetails' 'OTP_PENDING' status), entered on the same page.
  submitOtp: async (token, otp) => {
    const response = await axios.post(`${API_BASE_URL}/gst-auth-link/${token}/submit-otp`, { otp });
    return response.data;
  },
};
