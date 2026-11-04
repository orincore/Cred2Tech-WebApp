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
