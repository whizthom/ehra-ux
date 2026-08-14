import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),

    // ── PWA (manifest + service worker) ─────────────────────────────────
    //
    // registerType: "prompt" — we own the "a new version is available"
    // UI ourselves (see src/pwa/UpdateToast.jsx) instead of silently
    // auto-reloading underneath someone mid-form. The service worker is
    // registered from src/main.jsx via `virtual:pwa-register/react`.
    VitePWA({
      registerType: "prompt",
      injectRegister: false, // we call registerSW ourselves (see main.jsx)
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/*.png",
        "splash/*.png",
      ],

      manifest: {
        id: "/",
        name: "Ehral",
        short_name: "Ehral",
        description:
          "Ehral — workforce, attendance and business management, in your pocket.",
        theme_color: "#f0f4f3",
        background_color: "#f0f4f3",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any" },
          { src: "icons/icon-96x96.png", sizes: "96x96", type: "image/png", purpose: "any" },
          { src: "icons/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "any" },
          { src: "icons/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any" },
          { src: "icons/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "any" },
          { src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: {
        // App-shell fallback: any navigation that isn't precached (e.g. a
        // deep link opened while offline, on a device that has never
        // fetched that exact route) resolves to the cached index.html so
        // React Router can still render it client-side, instead of the
        // browser's own "no internet" page. See offline.html for the one
        // case this can't cover (nothing has ever been cached at all).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // A new service worker finishing install used to sit in a
        // "waiting" state until every open tab closed, or someone
        // explicitly triggered it — an ordinary reload doesn't release
        // that, so a plain refresh could keep serving the OLD version
        // for a while after a real deploy, sometimes needing several
        // reloads (or the UpdateToast's "Reload now" button) before it
        // actually took effect. skipWaiting: true (paired with
        // clientsClaim above) makes a newly-installed worker activate
        // immediately in the background as soon as it's ready — so the
        // very next reload, ordinary or otherwise, always gets the
        // latest deploy on the first try.
        //
        // The UpdateToast prompt (registerType: "prompt" above) still
        // shows and still matters: the worker activating doesn't change
        // what's already running in an open tab's memory — someone
        // mid-form won't get yanked onto new code without reloading —
        // it just guarantees that whenever a reload DOES happen (the
        // toast's button, or just an ordinary refresh), it's immediate
        // instead of a coin flip.
        skipWaiting: true,

        runtimeCaching: [
          // Google Fonts stylesheet
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          // Google Fonts + Tabler icon font files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "tabler-icons-cdn" },
          },
          // Read-only GET calls to the backend — lets recently visited
          // pages (dashboard lists, profile, etc.) still render offline
          // with last-known data. Never touches non-GET requests, so
          // clock-ins, form submits, etc. are untouched and simply fail
          // fast (as they always did) when offline.
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "api-get-cache",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        // Service worker is disabled in `vite dev` by default; flip this
        // on locally (and use `npm run build && npm run preview`, which
        // is the more accurate way to test PWA behavior anyway) if you
        // need to debug the worker itself.
        enabled: false,
        type: "module",
      },
    }),
  ],

  build: {
    rollupOptions: {
      // vite-plugin-pwa's own generator.js dynamically imports
      // @vite-pwa/assets-generator (an opt-in CLI tool for auto-cropping
      // icons from a source image, gated behind a `pwaAssets` config
      // option we never set — we generate/commit our icons ourselves,
      // see public/icons/). Under Rolldown that unreached dynamic import
      // still gets statically analyzed and bundled as reachable output
      // chunks instead of tree-shaken away — pulling in that tool's
      // entire dependency chain (postcss, a config loader, cert
      // generation for its own local dev server, ...) as multi-megabyte
      // dead chunks in dist/assets/, which then blew past the service
      // worker's default 2 MiB precache limit and failed the build.
      // Marking the package external stops Rolldown from ever
      // traversing into it — correct, since this code path is never
      // actually invoked at runtime.
      // vite-plugin-pwa's own dist/index.js does
      // `import("./generator-XXXX.js")` — a RELATIVE path — to reach its
      // optional assets-generator integration (see comment above). A
      // package-name-based external (e.g. matching "@vite-pwa/assets-
      // generator") only catches that generator file's OWN imports, not
      // the relative import that pulls the file itself in — so
      // generator.js (and everything reachable only through it: a
      // config loader, postcss, image/cert tooling) was still ending up
      // bundled. Matching on the resolved id instead of the specifier
      // string catches the file itself, cutting off the whole subtree
      // at its one entry point.
      external: (id) =>
        id.includes("@vite-pwa/assets-generator") ||
        /vite-plugin-pwa[\\/]dist[\\/]generator/.test(id),
    },
  },

  server: {
    https: true,
    host: "0.0.0.0",
    strictPort: false,

    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Real-time messaging (STOMP over SockJS) — SockJS negotiates its
      // transport over plain HTTP first (an XHR "info" request, polling,
      // etc.) and only upgrades to a real WebSocket when possible, so this
      // needs `ws: true` for the upgrade case AND to be reachable as a
      // normal proxied path for the others.
      "/ws-messaging": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});