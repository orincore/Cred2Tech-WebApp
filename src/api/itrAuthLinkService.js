import api from './axiosInstance';
import { getApiBaseUrl } from '../lib/apiBase';
import axios from 'axios';

// Same split as consentService.js: DSA-side calls carry the normal auth
// token via the shared axios instance; the public auth-page calls
// (getPublicDetails/submit) go through plain axios with the API base URL,
// since there is no logged-in session for a customer following an emailed
// link.

export const itrAuthLinkService = {
  // DSA-side (authenticated) — sends the customer an emailed link to
  // self-authorise the ITR pull instead of the DSA keying in the portal
  // password themselves.
  requestLink: async ({ customer_id, case_id, applicant_id, channel, override_email, override_mobile }) => {
    const response = await api.post('/itr-auth-link/request', { customer_id, case_id, applicant_id, channel, override_email, override_mobile });
    return response.data;
  },

  // DSA-side (authenticated) — revokes a still-pending link before the
  // customer has used it.
  cancelLink: async (id) => {
    const response = await api.post(`/itr-auth-link/${id}/cancel`);
    return response.data;
  },

  // Public — the customer's own page, no auth.
  getPublicDetails: async (token) => {
    const response = await axios.get(`${getApiBaseUrl()}/itr-auth-link/${token}`);
    return response.data;
  },

  submit: async (token, { pan, password }) => {
    const response = await axios.post(`${getApiBaseUrl()}/itr-auth-link/${token}/submit`, { pan, password });
    return response.data;
  },
};
