/* ═══════════════════════════════════════════
   ANNOMUSS SERVICE WORKER v5
   Caches all pages, fonts, icon
═══════════════════════════════════════════ */

const CACHE_NAME  = "annomuss-v5";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  "/index.html",
  "/dashboard.html",
  "/messages.html",
  "/security.html",
  "/badges.html",
  "/confessions.html",
  "/terms.html",
  "/404.html",
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
];

// ── INSTALL — skip waiting immediately ───────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting()) // ← force activate immediately
  );
});

// ── ACTIVATE — delete ALL old caches ─────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // ← take control of all tabs immediately
  );
});

// ── FETCH ─────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // ── NEVER intercept these ──
  if (url.hostname.includes("onrender.com"))    return; // API calls
  if (url.hostname.includes("cloudinary.com"))  return; // media
  if (url.hostname.includes("socket.io"))       return; // websocket
  if (url.hostname.includes("firebasejs"))      return; // firebase SDK
  if (url.pathname.startsWith("/api/"))         return; // API routes
  if (url.pathname.includes(".well-known"))     return; // chrome noise
  if (url.hostname.includes("bigdatacloud"))    return; // location API
  if (url.hostname.includes("googleapis.com") &&
      !url.hostname.includes("fonts"))          return; // google APIs except fonts

  // ── Fonts / CDN → Cache first ──
  if (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("cdnjs.cloudflare.com")
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp && resp.ok && resp.status === 200) {
            const clone = resp.clone(); // clone BEFORE returning
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // ── HTML pages → Network first ──
  if (
    request.destination === "document" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          if (resp && resp.ok && resp.status === 200) {
            const clone = resp.clone(); // clone BEFORE returning
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ── Everything else → Cache first, network fallback ──
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp && resp.ok && resp.status === 200) {
          const clone = resp.clone(); // clone BEFORE returning
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return resp;
      }).catch(() => new Response("Offline", { status: 503 }));
    })
  );
});

// ── PUSH ─────────────────────────────────────
self.addEventListener("push", event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) {
    data = { title: "Annomuss 🎭", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Annomuss 🎭", {
      body:    data.body || "Something new is waiting for you",
      icon:    "/icon.svg",
      badge:   "/icon.svg",
      tag:     data.tag || "annomuss-notif",
      renotify: true,
      vibrate: [100, 50, 100],
      data:    { url: data.url || "/dashboard.html", type: data.type },
      actions: [
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
  const url = event.notification.data?.url || "/dashboard.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(list => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && "focus" in c) {
            c.postMessage({ type: "PUSH_CLICK", data: event.notification.data });
            return c.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

// ── MESSAGE FROM APP ─────────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
