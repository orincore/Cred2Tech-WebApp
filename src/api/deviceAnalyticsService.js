import axiosInstance from './axiosInstance';

// Super Admin Device Analytics. `from` / `to` are Indian calendar days (YYYY-MM-DD), `group` is all | staff | msme.
export const deviceAnalyticsService = {
  report: async ({ from, to, group } = {}) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (group && group !== 'all') params.group = group;
    return (await axiosInstance.get('/admin/device-analytics', { params })).data;
  },
};
