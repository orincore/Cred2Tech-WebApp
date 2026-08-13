import api from './axiosInstance';

// Setup/challenge calls authenticate with their own short-lived token
// (returned by /auth/login as setupToken/challengeToken) instead of the
// stored session token — the user isn't fully logged in yet at this point.
const withToken = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

// Public, unauthenticated — whether the backend's own NODE_ENV currently
// allows the dev-bypass endpoints to work at all. No token needed since this
// is checked before a setup/challenge token even exists.
export const getDevBypassStatus = () =>
  api.get('/auth/mfa/dev-bypass-status').then((r) => r.data);

// ---- First-time forced setup ----
export const setupStatus = (setupToken) =>
  api.get('/auth/mfa/setup/status', withToken(setupToken)).then((r) => r.data);

export const setupTotpInit = (setupToken) =>
  api.post('/auth/mfa/setup/totp/init', {}, withToken(setupToken)).then((r) => r.data);

export const setupTotpConfirm = (setupToken, { secret, code }) =>
  api.post('/auth/mfa/setup/totp/confirm', { secret, code }, withToken(setupToken)).then((r) => r.data);

export const setupEmailInit = (setupToken) =>
  api.post('/auth/mfa/setup/email/init', {}, withToken(setupToken)).then((r) => r.data);

export const setupEmailConfirm = (setupToken, { code }) =>
  api.post('/auth/mfa/setup/email/confirm', { code }, withToken(setupToken)).then((r) => r.data);

// Local-dev only — backend hard-refuses with 403 when NODE_ENV === 'production'.
export const setupDevBypass = (setupToken) =>
  api.post('/auth/mfa/setup/dev-bypass', {}, withToken(setupToken)).then((r) => r.data);

// ---- Login-time challenge verification ----
export const challengeSendEmailOtp = (challengeToken) =>
  api.post('/auth/mfa/challenge/send-email-otp', {}, withToken(challengeToken)).then((r) => r.data);

// trustDevice: when true, the backend mints a 30-day "skip MFA on this
// device" cookie on success (see trustedDevice.service.js) — the cookie
// itself is httpOnly, so the frontend never sees or stores it directly,
// the browser just sends it back automatically on the next /auth/login.
export const challengeVerifyTotp = (challengeToken, code, trustDevice = false) =>
  api.post('/auth/mfa/challenge/verify-totp', { code, trustDevice }, withToken(challengeToken)).then((r) => r.data);

export const challengeVerifyEmailOtp = (challengeToken, code, trustDevice = false) =>
  api.post('/auth/mfa/challenge/verify-email-otp', { code, trustDevice }, withToken(challengeToken)).then((r) => r.data);

export const challengeSendMobileOtp = (challengeToken) =>
  api.post('/auth/mfa/challenge/send-mobile-otp', {}, withToken(challengeToken)).then((r) => r.data);

export const challengeVerifyMobileOtp = (challengeToken, code, trustDevice = false) =>
  api.post('/auth/mfa/challenge/verify-mobile-otp', { code, trustDevice }, withToken(challengeToken)).then((r) => r.data);

export const challengeVerifyBackupCode = (challengeToken, code, trustDevice = false) =>
  api.post('/auth/mfa/challenge/verify-backup-code', { code, trustDevice }, withToken(challengeToken)).then((r) => r.data);

// Local-dev only — backend hard-refuses with 403 when NODE_ENV === 'production'.
export const challengeDevBypass = (challengeToken) =>
  api.post('/auth/mfa/challenge/dev-bypass', {}, withToken(challengeToken)).then((r) => r.data);

// ---- Settings-driven management (normal session, step-up password) ----
export const manageStatus = () => api.get('/auth/mfa/manage/status').then((r) => r.data);

// Local-dev only — backend hard-refuses with 403 when NODE_ENV === 'production'.
export const manageDevBypass = () => api.post('/auth/mfa/manage/dev-bypass').then((r) => r.data);

export const manageTotpInit = (currentPassword) =>
  api.post('/auth/mfa/manage/totp/init', { currentPassword }).then((r) => r.data);

export const manageTotpConfirm = ({ secret, code }) =>
  api.post('/auth/mfa/manage/totp/confirm', { secret, code }).then((r) => r.data);

export const manageTotpDisable = (currentPassword) =>
  api.post('/auth/mfa/manage/totp/disable', { currentPassword }).then((r) => r.data);

export const manageEmailInit = (currentPassword, newEmail) =>
  api.post('/auth/mfa/manage/email/init', { currentPassword, newEmail }).then((r) => r.data);

export const manageEmailConfirm = ({ code }) =>
  api.post('/auth/mfa/manage/email/confirm', { code }).then((r) => r.data);

export const manageEmailDisable = (currentPassword) =>
  api.post('/auth/mfa/manage/email/disable', { currentPassword }).then((r) => r.data);

export const manageRegenerateBackupCodes = (currentPassword) =>
  api.post('/auth/mfa/manage/backup-codes/regenerate', { currentPassword }).then((r) => r.data);

export const changePassword = ({ currentPassword, newPassword }) =>
  api.post('/auth/mfa/manage/change-password', { currentPassword, newPassword }).then((r) => r.data);

// ---- Admin-forced reset ----
export const adminResetMfa = (userId) =>
  api.post(`/auth/mfa/admin/users/${userId}/reset`).then((r) => r.data);

// ---- Trusted devices (Profile page) ----
export const listTrustedDevices = () => api.get('/auth/trusted-devices').then((r) => r.data);

export const revokeTrustedDevice = (deviceId) =>
  api.post(`/auth/trusted-devices/${deviceId}/revoke`).then((r) => r.data);
