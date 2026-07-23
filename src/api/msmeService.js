import api from './axiosInstance';

// MSME Direct Portal — OTP auth (public)
export const msmeAuthApi = {
  sendOtp: (mobile) => api.post('/msme/auth/send-otp', { mobile }),
  verifyOtp: (mobile, otp) => api.post('/msme/auth/verify-otp', { mobile, otp }),
};

// MSME Direct Portal — authenticated (MSME_CUSTOMER token)
export const msmeApi = {
  getDashboard: () => api.get('/msme/dashboard'),
  updateProfile: (data) => api.put('/msme/profile', data),

  initiateEligibility: () => api.post('/msme/eligibility/initiate'),
  startForm: () => api.get('/msme/eligibility/start-form'),

  updateBusinessDetails: (data) => api.put('/msme/case/business-details', data),
  updateLoanDetails: (data) => api.put('/msme/case/loan-details', data),

  getPaymentConfig: () => api.get('/msme/payment/config'),
  createPaymentOrder: () => api.post('/msme/payment/create-order'),
  verifyPayment: (data) => api.post('/msme/payment/verify', data),

  runEligibility: () => api.post('/msme/eligibility/run'),
  getEligibilityResult: () => api.get('/msme/eligibility/result'),

  selectLender: (esr_lender_id) => api.post('/msme/lender/select', { esr_lender_id }),
  submitCase: () => api.post('/msme/case/submit'),
};
