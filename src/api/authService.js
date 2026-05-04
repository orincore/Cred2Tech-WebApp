import api from './axiosInstance';

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data; // { message, user, token }
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data; // current user with role and dsa info
};
