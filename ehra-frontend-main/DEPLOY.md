# Deploying the frontend to Render

This repo now includes a `render.yaml` blueprint so it can be deployed on
Render as a **Static Site**.

## Option A — Blueprint (recommended)
1. Push this repo to GitHub/GitLab.
2. In Render: **New > Blueprint**, point it at the repo. It will read
   `render.yaml` and create the `ehra-frontend` static site automatically
   (root directory `Desktop/ehra-frontend/ehra-frontend`, build command
   `npm install && npm run build`, publish directory `dist`).
3. Fill in the environment variables it asks for (see below).

## Option B — Manual static site
1. **New > Static Site**, connect the repo.
2. Root directory: `Desktop/ehra-frontend/ehra-frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add a rewrite rule: source `/*` → destination `/index.html` (needed for
   client-side routing via react-router).
6. Add the environment variables below.

## Required environment variables
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Your deployed backend's API URL, e.g. `https://ehra-backend.onrender.com/api` |
| `VITE_FIREBASE_API_KEY` | Firebase Web SDK config (phone auth) |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_STORAGE_BUCKET` | " |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
| `VITE_FIREBASE_APP_ID` | " |

See `.env.example` in the project root for a template.

## What changed for deployment
- `src/api/authApi.js`: the API base URL is now read from
  `VITE_API_BASE_URL` at build time, falling back to `/api` (the existing
  Vite dev-proxy path) when it isn't set — so local dev is unaffected.
- `src/hooks/useMessageStream.js`: the SSE stream URL now uses that same
  configurable base instead of a hardcoded `/api` path.
- Added `.env.example` and `render.yaml` (with an SPA rewrite rule, since
  this is a client-side-routed React app).
