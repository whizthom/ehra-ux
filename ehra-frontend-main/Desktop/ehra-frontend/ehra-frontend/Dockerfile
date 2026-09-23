# Railway auto-detects a Dockerfile at the service root and uses it
# instead of Nixpacks. See ../../../DEPLOY.md ("Deploying to Railway")
# for why this exists: `npm run preview`/`vite preview` is a dev-grade
# server not meant for production traffic, and Railway (unlike Render)
# has no static-site product with its own headers/rewrites config, so
# the app needs an actual production web server it can hand $PORT to.
# Caddy serves the built `dist/` folder and applies the Cache-Control
# strategy in ./Caddyfile - that file is the one that actually makes
# deployments "take effect" without users clearing site data.

# ---- Build stage ----------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_* vars are baked into the bundle at build time (see .env.example).
# Railway must have these set as build-time variables on this service for
# the app to call the right backend/Firebase project.
RUN npm run build

# ---- Serve stage ------------------------------------------------------
FROM caddy:2-alpine
WORKDIR /app

COPY Caddyfile ./Caddyfile
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/dist ./dist

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]