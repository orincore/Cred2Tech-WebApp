# Cred2Tech WebApp

The production frontend for Cred2Tech (technology platform for sourcing partners and direct MSMEs).

- Stack: React 19, Vite 6, Tailwind CSS 3.4, React Router 7, Axios, Socket.IO client,
  Framer Motion.
- Hosting: Vercel (`app.cred2tech.com`); `vercel.json` rewrites all routes to `index.html`.
- Backend: the `Cred2Tech` repo. Locally the dev server (port 3003) proxies `/api`
  to `http://localhost:5001`.

## Run

```
npm install
npm run dev     # http://localhost:3003
npm run build
```

## Installable app (PWA)

The WebApp installs to a phone's home screen or a desktop as "Cred2Tech" and opens full-screen.

| Piece | Where |
|---|---|
| Manifest (name, icons, colours) | `public/manifest.json` (not `.webmanifest`: servers serve `.json` correctly with no extra MIME setting) |
| Icons, iOS launch images, splash artwork | `public/icons/` (generated from the logo; any-purpose, maskable, 180px Apple icon) |
| Animated launch splash | inline in `index.html`; shown only in an installed (standalone) window, removed once the app has rendered (`window.__c2tSplashHide`, called from `src/main.jsx`). Says "still loading" after 7s and offers Reload after 16s |
| Service worker | `public/sw.js` (caching, offline fallback, web push). `vite.config.js` (`c2tServiceWorker`) stamps each release's file list into `dist/sw.js` at build time |
| Install card (phones only) | `src/components/InstallPrompt.jsx`, mounted in `AppRouter.jsx` |

What the service worker caches: content-hashed `/assets/*` (cache-first, kept across releases so an open tab never loses a chunk), the app shell
(index.html, offline page, manifest, icons, logos, app fonts, one consistent set per release) and Google Fonts. Page loads are network-first
but fall back to the cached shell after 3.5s, so a slow connection opens the app instead of hanging. It never touches `/api/*`, `/socket.io`
or `/version.json` (the offline overlay uses it to prove real connectivity), and never stores user data.

White-label organisation hosts are not Cred2Tech: `index.html` strips every `data-c2t-brand` tag (manifest, icons, app name, launch images)
and the install card hides itself there, so an org's site is never presented as Cred2Tech. The host rule is the same as
`isOrgCandidateHost()` in `src/branding/brandingCore.js`, fed by `VITE_WL_BASE_DOMAINS` / `VITE_MAIN_APP_HOSTS` at build time; keep the two in step.

Phone-only layout fixes live under `@media (max-width: 768px)` / `(max-width: 560px)` in `src/index.css` (`c2t-page-header-actions`,
`c2t-top-offset`, `c2t-stack-sm`) so desktop rendering is unchanged.

## Layout

| Path | Contents |
|---|---|
| `src/pages/` | One file per screen (login, MFA, cases, ESR, wallet, admin) |
| `src/components/ui/` | Shared primitives; reuse before writing new ones |
| `src/api/` | One service file per backend area; `axiosInstance.js` is the shared client |
| `src/context/` | Auth, MSME auth, theme, notifications |
| `src/routes/` | Router and route guards |
| `src/theme.ts` | Design tokens (colors, fonts, radii, shadows) |

Design and porting rules are in the workspace `CLAUDE.md`. Full product and
architecture docs are in the backend repo: `Cred2Tech/docs/`.
