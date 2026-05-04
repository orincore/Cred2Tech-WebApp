import axiosInstance from './axiosInstance';

export const caseService = {
  getAllCases: async () => {
    const response = await axiosInstance.get('/cases');
    return response.data;
  },

  getCaseById: async (id) => {
    const response = await axiosInstance.get(`/cases/${id}`);
    return response.data;
  },

  createCase: async (customer_id) => {
    const response = await axiosInstance.post('/cases/create', { customer_id });
    return response.data;
  },

  addApplicant: async (caseId, applicantData) => {
    const response = await axiosInstance.post(`/cases/${caseId}/add-applicant`, applicantData);
    return response.data;
  },

  updateProduct: async (caseId, product_type) => {
    const response = await axiosInstance.patch(`/cases/${caseId}/product`, { product_type });
    return response.data;
  },

  getCaseSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/summary`);
    return response.data;
  },

  getCoBorrowers: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/co-borrowers`);
    return response.data;
  },

  getActivityLog: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/activity-log`);
    return response.data;
  },

  // Phase 1 —— Product & Property
  updateProductProperty: async (caseId, payload) => {
    const response = await axiosInstance.put(`/cases/${caseId}/product-property`, payload);
    return response.data;
  },

  // Phase 1 —— Income Summary
  getIncomeSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/income-summary`);
    return response.data;
  },
  addIncomeEntry: async (caseId, entry) => {
    const response = await axiosInstance.post(`/cases/${caseId}/income-entries`, entry);
    return response.data;
  },
  deleteIncomeEntry: async (caseId, entryId) => {
    const response = await axiosInstance.delete(`/cases/${caseId}/income-entries/${entryId}`);
    return response.data;
  },
  confirmIncomeSummary: async (caseId) => {
    const response = await axiosInstance.put(`/cases/${caseId}/income-summary/confirm`);
    return response.data;
  },

  // Phase 1 —— Bureau Obligations
  syncObligations: async (caseId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/bureau-obligations/sync`);
    return response.data;
  },
  getObligations: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/bureau-obligations`);
    return response.data;
  },
  addObligation: async (caseId, obligation) => {
    const response = await axiosInstance.post(`/cases/${caseId}/bureau-obligations`, obligation);
    return response.data;
  },
  updateObligation: async (caseId, oblId, data) => {
    const response = await axiosInstance.put(`/cases/${caseId}/bureau-obligations/${oblId}`, data);
    return response.data;
  },

  // Phase 1 —— ESR
  generateESR: async (caseId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/esr/generate`);
    return response.data;
  },
  getESR: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/esr`);
    return response.data;
  },

  // Phase 2 —— Proposals
  createProposal: async (caseId, payload) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/create`, payload);
    return response.data;
  },
  listProposals: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/proposals`);
    return response.data;
  },
  getProposal: async (caseId, proposalId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/proposals/${proposalId}`);
    return response.data;
  },
  updateProposal: async (caseId, proposalId, data) => {
    const response = await axiosInstance.patch(`/cases/${caseId}/proposals/${proposalId}`, data);
    return response.data;
  },
  attachProposalDocs: async (caseId, proposalId, document_ids) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/documents`, { document_ids });
    return response.data;
  },
  detachProposalDoc: async (caseId, proposalId, docId) => {
    const response = await axiosInstance.delete(`/cases/${caseId}/proposals/${proposalId}/documents/${docId}`);
    return response.data;
  },
  submitProposal: async (caseId, proposalId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/submit`);
    return response.data;
  },
  cloneProposal: async (caseId, proposalId, payload) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/clone`, payload);
    return response.data;
  },
};
