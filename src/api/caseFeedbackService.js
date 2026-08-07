import api from './axiosInstance';

export const caseFeedbackService = {
  // DSA-facing — case_id + type ('PARTIAL' | 'FULL') + rating (1-5) + optional comment.
  submit: async ({ case_id, type, rating, comment }) => {
    const res = await api.post('/case-feedback', { case_id, type, rating, comment });
    return res.data.data;
  },

  // Admin-facing — filters + sort + pagination, mirrors ticketService.listForAdmin's shape.
  listForAdmin: async (params) => {
    const res = await api.get('/case-feedback', { params });
    return res.data;
  },
};
