// True only for local `vite dev` and the shared dev deployment (dev.app), which
// is still a production Vite build but points at dev.api.cred2tech.com. Always
// false on production (app.cred2tech.com -> prod.api.cred2tech.com). Gate any
// debug-only UI on this so it can never show to real users.
export const IS_DEV_BUILD = import.meta.env.DEV
  || String(import.meta.env.VITE_API_BASE_URL || '').includes('dev.api.cred2tech.com');
