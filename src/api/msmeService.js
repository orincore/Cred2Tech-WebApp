import api from './axiosInstance';

// MSME Direct Portal — OTP auth (public)
export const msmeAuthApi = {
  sendOtp: (mobile) => api.post('/msme/auth/send-otp', { mobile }),
  verifyOtp: (mobile, otp) => api.post('/msme/auth/verify-otp', { mobile, otp }),
  // Cross-app SSO bootstrap: silently logs the user in if they were recently
  // authenticated on scheme.cred2tech.com (proven by the shared c2t_sso
  // cookie). withCredentials is required here specifically — it's the one
  // call in this app that needs the browser to actually send a cross-site
  // cookie; every other call is pure bearer-token and doesn't need it.
  ssoCheck: () => api.get('/msme/auth/sso-check', { withCredentials: true }),
  ssoLogout: () => api.post('/msme/auth/sso-logout', {}, { withCredentials: true }),
  // Real logout — authenticated, revokes every session this user has on
  // THIS app and tells scheme.cred2tech.com's backend to do the same for
  // the same mobile, so logging out here ends both apps' sessions.
  logout: () => api.post('/msme/auth/logout'),
};

// MSME Direct Portal — authenticated (MSME_CUSTOMER token)
export const msmeApi = {
  getDashboard: () => api.get('/msme/dashboard'),
  getCases: () => api.get('/msme/cases'),
  getPayments: () => api.get('/msme/payments'),
  updateProfile: (data) => api.put('/msme/profile', data),

  initiateEligibility: () => api.post('/msme/eligibility/initiate'),
  startForm: () => api.get('/msme/eligibility/start-form'),

  updateBusinessDetails: (data) => api.put('/msme/case/business-details', data),
  updateLoanDetails: (data) => api.put('/msme/case/loan-details', data),

  getPaymentConfig: () => api.get('/msme/payment/config'),
  createPaymentOrder: (forceNew = false) => api.post('/msme/payment/create-order', { forceNew }),
  verifyPayment: (data) => api.post('/msme/payment/verify', data),

  runEligibility: () => api.post('/msme/eligibility/run'),
  getEligibilityResult: () => api.get('/msme/eligibility/result'),

  selectLender: (esr_lender_id) => api.post('/msme/lender/select', { esr_lender_id }),
  submitCase: (payload) => api.post('/msme/case/submit', payload),
};
