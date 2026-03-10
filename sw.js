/* ═══════════════════════════════════════════
   ANNOMUSS SERVICE WORKER v2
   Strategy:
   - App shell (HTML/CSS) → Cache First
   - API calls → Network First (never cache)
   - Images → Stale While Revalidate
   - Offline fallback page included
═══════════════════════════════════════════ */

const CACHE_NAME    = "annomuss-v2";
const OFFLINE_URL   = "/offline.html";

// Files to cache immediately on install (app shell)
const PRECACHE = [
  "/index.html",
  "/dashboard.html",
  "/randomchat.html",
  "/messages.html",
  "/challenge.html",
  "/confessions.html",
  "/trending.html",
  "/goals.html",
  "/levels.html",
  "/location.html",
  "/security.html",
  "/manifest.json",
  "/offline.html"
];

// ── INSTALL: pre-cache app shell ─────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches ──────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: routing strategy ──────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and browser extension requests
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // 2. API calls → Network Only (never serve stale data)
  if (url.hostname.includes("onrender.com") ||
      url.hostname.includes("cloudinary.com") ||
      url.hostname.includes("socket.io")) {
    return; // let it go to network naturally
  }

  // 3. Google Fonts → Cache First (they never change)
  if (url.hostname.includes("fonts.googleapis.com") ||
      url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // 4. HTML pages → Network First, fallback to cache, fallback to offline
  if (request.destination === "document" ||
      request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          // Update cache with fresh version
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return resp;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // 5. Everything else (JS, CSS, images) → Stale While Revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return resp;
      });
      return cached || networkFetch;
    })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────
self.addEventListener("push", event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: "Annomuss 🎭", body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || "Annomuss 🎭", {
      body:    data.body    || "Something new is waiting for you",
      icon:    data.icon    || "/icons/icon-192.png",
      badge:   data.badge   || "/icons/icon-96.png",
      image:   data.image   || undefined,
      tag:     data.tag     || "annomuss-notif",
      renotify: true,
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/dashboard.html",
        dateOfArrival: Date.now()
      },
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
      .then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// ── BACKGROUND SYNC (future: post queue) ────
self.addEventListener("sync", event => {
  if (event.tag === "sync-posts") {
    event.waitUntil(syncQueuedPosts());
  }
});

async function syncQueuedPosts() {
  // Placeholder for offline post queue sync
  const queue = await getQueuedPosts();
  for (const post of queue) {
    try {
      await fetch("/api/posts", { method: "POST", body: JSON.stringify(post) });
      await removeFromQueue(post.id);
    } catch(e) {}
  }
}

async function getQueuedPosts()   { return []; } // implement with IndexedDB
async function removeFromQueue(id) { return; }
