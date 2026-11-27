// Service Worker des Projektsystems – nur für Benachrichtigungen (Timer abgelaufen).
// Bewusst ohne Caching: die App lädt immer die aktuelle Version.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); if ("navigate" in c) c.navigate("/#/heute"); return; }
    }
    await self.clients.openWindow("/#/heute");
  })());
});
