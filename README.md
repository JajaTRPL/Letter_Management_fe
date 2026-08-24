# Letter Management — Frontend

Vite + TypeScript SPA (vanilla, client-side routed — no framework) for the
DTEDI letter-management system. Talks to the Laravel backend via relative
`fetch('/api/...')` / `fetch('/storage/...')` calls (see
`src/shared/api-client.ts`), so it must be served **same-origin** with the
backend (via a reverse proxy) — it does not do cross-origin API calls.

- **Local development:** `npm install && npm run dev` (proxies `/api` and
  `/storage` to `http://localhost:8000`, see `vite.config.ts`). Full
  onboarding steps (env vars, shared Google Client ID) are in
  [`../letter_management_be/SETUP_GUIDE.md`](../letter_management_be/SETUP_GUIDE.md)
  — not duplicated here.
- **Production deployment:** this is a static build (`npm run build` →
  `dist/`) served directly by nginx — no Node process and no container in
  production. The nginx vhost and redeploy script live in
  [`letter_management_fe_deploy`](https://github.com/JajaTRPL/letter_management_fe_deploy),
  not in this repo.

## Build

```bash
npm ci
npm run build   # tsc && vite build -> dist/
```

`VITE_GOOGLE_CLIENT_ID` is read from `.env` at **build** time and inlined
into the JS bundle — it's a public OAuth Client ID (not a secret; Google's
GIS flow is designed to have it visible in the browser), but it's still
kept out of git so each environment can point at its own Google Cloud
project. See `.env.example` and `SETUP_GUIDE.md` § Google OAuth.

## Backend origin

In production, `/api/*` and `/storage/*` are reverse-proxied to the
backend by the nginx vhost in `letter_management_fe_deploy` — see that
repo for how the two are wired together.
