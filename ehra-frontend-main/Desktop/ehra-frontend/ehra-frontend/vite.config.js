import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "prompt",

      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
        "push-notifications.js",
      ],

      manifest: {
        id: "/",
        name: "Ehral",
        short_name: "Ehral",
        description:
          "Ehral is a modern workforce management platform for employers and employees.",
        theme_color: "#0f6e56",
        background_color: "#f0f4f3",

        display: "standalone",
        display_override: ["standalone", "minimal-ui"],

        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-192x192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        clientsClaim: false,
        skipWaiting: false,

        navigateFallback: "/index.html",

        navigateFallbackDenylist: [/^\/api\//],

        importScripts: ["/push-notifications.js"],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },

          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },

          {
            urlPattern:
              /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "tabler-icons",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],

  build: {
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
  },
});