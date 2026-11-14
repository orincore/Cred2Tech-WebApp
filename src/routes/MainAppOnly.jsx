import { Navigate } from 'react-router-dom';
import { useBranding } from '../branding/brandingStore';

// Wraps routes that belong to the main Cred2Tech app only (sourcing-partner self-registration, the direct-MSME
// portal). On a white-label organisation's site they are not offered: visitors are sent to the org's own login.
// On the main app this renders its children unchanged, so nothing about the main app's pages or layout changes.
const MainAppOnly = ({ children }) => {
  const { isOrg } = useBranding();
  return isOrg ? <Navigate to="/login" replace /> : children;
};

export default MainAppOnly;
