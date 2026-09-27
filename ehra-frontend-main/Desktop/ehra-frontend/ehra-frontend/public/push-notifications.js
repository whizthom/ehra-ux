/* Imported by the existing Workbox service worker; do not register another worker. */
self.addEventListener("push", (event) => {
  const payload = (() => { try { return event.data?.json() || {}; } catch { return {}; } })();
  const route = typeof payload.route === "string" && payload.route.startsWith("/") ? payload.route : "/dashboard";
  event.waitUntil(Promise.all([
    self.registration.showNotification(payload.title || "Ehral", { body: payload.body || "You have a new update.", tag: payload.tag || "ehral-update", icon: "/icons/icon-192x192.png", badge: "/icons/icon-72x72.png", data: { route } }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage({ type: "EHRAL_PUSH", payload }))),
  ]));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data?.route || "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
    return client ? client.focus().then(() => client.navigate(route)) : self.clients.openWindow(route);
  }));
});
