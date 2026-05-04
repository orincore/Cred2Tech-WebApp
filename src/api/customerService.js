import axiosInstance from './axiosInstance';

export const customerService = {
  checkExistingByPan: async (pan) => {
    try {
      const response = await axiosInstance.get(`/customers/check-existing-by-pan?pan=${pan}`);
      return response.data;
    } catch (error) {
      // If customer doesn't exist or any issue occurs, we gracefully return null 
      // so the flow falls back to creating the stub customer.
      console.warn("checkExistingByPan returned an error (likely 404):", error?.response?.data || error);
      return null;
    }
  },

  createOrAttach: async (data) => {
    const response = await axiosInstance.post('/customers/create-or-attach', data);
    return response.data;
  },

  getCustomerProfile: async (customerId) => {
    const response = await axiosInstance.get(`/customers/${customerId}/profile`);
    return response.data;
  },

  getApiAvailability: async (customerId) => {
    const response = await axiosInstance.get(`/customers/${customerId}/api-availability`);
    return response.data;
  }
};
