import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // "prompt" (not "autoUpdate"): a new service worker installs and
      // waits rather than seizing control of open tabs on its own.
      // EHRAL is full of forms (leave requests, employee edits, payroll,
      // messaging) - autoUpdate forces workbox.skipWaiting/clientsClaim
      // to true, which activates a new worker over an open tab the
      // instant it's installed, out from under whatever the user is
      // mid-typing. UpdateToast.jsx (src/pwa/UpdateToast.jsx) already
      // implements the prompt workflow - it just wasn't matched by this
      // setting. See that file for how/when the update is applied.
      registerType: "prompt",

      manifest: {
        name: "Ehral",
        short_name: "Ehral",
        description:
          "Ehral business management and workforce platform",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/maskable-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        // Old precached JS/CSS/HTML from the previous deploy are removed
        // once the new worker actually activates - not before, so an
        // already-open tab never has an asset vanish out from under it
        // mid-session.
        cleanupOutdatedCaches: true,
        // Left at their workbox defaults (false): the new worker installs
        // and waits. It only calls self.skipWaiting() when it receives
        // the SKIP_WAITING message that updateServiceWorker(true) sends
        // (see UpdateToast.jsx) - and only then does it claim existing
        // clients and the page reload onto it. Forcing these to true here
        // (autoUpdate's behavior) is what made the previous config fight
        // with UpdateToast's own prompt/reload logic.
      },
    }),
  ],

  build: {
    sourcemap: false,
  },
});