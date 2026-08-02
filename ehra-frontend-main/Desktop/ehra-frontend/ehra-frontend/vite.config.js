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
      ],

      manifest: {
        id: "/",
        name: "Ehral",
        short_name: "Ehral",
        description:
          "Ehral — workforce, attendance and business management, in your pocket.",
        theme_color: "#0b141a",
        background_color: "#0b141a",
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
        skipWaiting: false, // we prompt instead — see registerType above

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

  server: {
    https: true,
    host: "0.0.0.0",
    strictPort: false,

    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});