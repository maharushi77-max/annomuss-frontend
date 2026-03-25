/* ═══════════════════════════════════════════
   ANNOMUSS SERVICE WORKER v3
   Clean single file — caching + push + offline
═══════════════════════════════════════════ */

const CACHE_NAME  = "annomuss-v3";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  "/index.html",
  "/dashboard.html",
  "/messages.html",
  "/security.html",
  "/badges.html",
  "/confessions.html",
  "/offline.html",
  "/manifest.json"
];

// ── INSTALL ──────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // Never cache API calls or socket
  if (
    url.hostname.includes("onrender.com") ||
    url.hostname.includes("cloudinary.com") ||
    url.hostname.includes("socket.io") ||
    url.pathname.startsWith("/api/")
  ) return;

  if (url.pathname.includes(".well-known")) return;

  // Fonts / CDN → Cache First
  if (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("cdnjs.cloudflare.com")
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()));
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML → Network First, fallback cache, fallback offline page
  if (request.destination === "document" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Everything else → Cache First, fallback network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()));
        return resp;
      }).catch(() => new Response("Offline", { status: 503 }));
    })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────
self.addEventListener("push", event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) {
    data = { title: "Annomuss 🎭", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Annomuss 🎭", {
      body:     data.body || "Something new is waiting for you",
      icon:     "/icons/icon-192.png",
      badge:    "/icons/icon-96.png",
      tag:      data.tag  || "annomuss-notif",
      renotify: true,
      vibrate:  [100, 50, 100],
      data:     { url: data.url || "/dashboard.html", type: data.type },
      actions:  [
        { action: "open",    title: "Open" },
        { action: "dismiss", title: "Dismiss" }
      ]
    })
  );
});

// ── NOTIFICATION CLICK ───────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url  = event.notification.data?.url  || "/dashboard.html";
  const type = event.notification.data?.type || "";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // Tell the open tab what was clicked
            client.postMessage({ type: "PUSH_CLICK", notifType: type, url });
            return client.focus();
          }
        }
        // No open tab — open a new one
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// ── MESSAGE FROM APP ─────────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
