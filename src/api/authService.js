import api from './axiosInstance';

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data; // { message, user, token }
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data; // current user with role and dsa info
};

// Marks one PageTour screen seen/skipped, on the account itself rather than
// just this browser, so it never shows again on any other device either.
// Payload is two small fields, response is one boolean, deliberately the
// smallest this endpoint could be.
export const updateTourFlag = async (pageKey, value = true) => {
  const response = await api.patch('/auth/tour-flags', { pageKey, value });
  return response.data; // { success: true }
};
