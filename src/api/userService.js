import api from './axiosInstance';

export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data; // filtered list based on current user's role
};

export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};

export const updateUser = async (id, userData) => {
  const response = await api.patch(`/users/${id}`, userData);
  return response.data;
};

// NOTE: deleteUser (DELETE /users/:id) is not yet implemented in the backend.
// The UI will show a placeholder with appropriate messaging.
export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};
