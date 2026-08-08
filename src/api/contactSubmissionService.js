import api from './axiosInstance';

// Leads submitted through the marketing site's (Cred2Tech-UI) public
// /contact form — see backend contactSubmission.routes.js.
export const contactSubmissionService = {
  listForAdmin: async (params) => {
    const res = await api.get('/contact-submissions', { params });
    return res.data;
  },
  unreadCount: async () => {
    const res = await api.get('/contact-submissions/unread-count');
    return res.data.count;
  },
  getById: async (id) => {
    const res = await api.get(`/contact-submissions/${id}`);
    return res.data.data;
  },
  markAsRead: async (id) => {
    const res = await api.post(`/contact-submissions/${id}/read`);
    return res.data.data;
  },
};
