import api from './axiosInstance';

export const getRoles = async () => {
  const response = await api.get('/roles');
  return response.data; // [{ id, name }, ...]
};
