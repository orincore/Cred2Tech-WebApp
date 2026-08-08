import api from './axiosInstance';

// Leads submitted through the marketing site's (Cred2Tech-UI) public
// /request-demo form — see backend demoRequest.routes.js.
export const demoRequestService = {
  listForAdmin: async (params) => {
    const res = await api.get('/demo-requests', { params });
    return res.data;
  },
  unreadCount: async () => {
    const res = await api.get('/demo-requests/unread-count');
    return res.data.count;
  },
  getById: async (id) => {
    const res = await api.get(`/demo-requests/${id}`);
    return res.data.data;
  },
  markAsRead: async (id) => {
    const res = await api.post(`/demo-requests/${id}/read`);
    return res.data.data;
  },
};
