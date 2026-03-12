// BØDEN Radio — Service Worker
// Cache strategy: network-first for pages/API, cache-first for static assets

const CACHE_NAME = "boden-v2"
const OFFLINE_URL = "/offline"

const PRECACHE = [
    "/",
    "/offline",
    "/manifest.json",
    "/favicon.png",
    "/favicon.svg",
]

// ── Install: precache essential assets ───────────────────────────────────────
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
    )
    self.skipWaiting()
})

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    )
    self.clients.claim()
})

// ── Fetch: network-first with offline fallback ────────────────────────────────
self.addEventListener("fetch", (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET and cross-origin requests
    if (request.method !== "GET" || url.origin !== self.location.origin) return

    // Skip API and WS routes — always network
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) return

    // Static assets (/_next/, /fonts/, /icons/) — cache-first
    if (
        url.pathname.startsWith("/_next/static") ||
        url.pathname.startsWith("/fonts/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.match(/\.(png|svg|jpg|webp|woff2?)$/)
    ) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached
                return fetch(request).then(response => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then(c => c.put(request, clone))
                    }
                    return response
                })
            })
        )
        return
    }

    // Pages — network-first, fall back to offline page
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then(c => c.put(request, clone))
                }
                return response
            })
            .catch(() =>
                caches.match(request).then(cached => cached ?? caches.match(OFFLINE_URL))
            )
    )
})

// ── Push: show notification when received ────────────────────────────────────
self.addEventListener("push", (event) => {
    if (!event.data) return

    try {
        const data = event.data.json()
        const options = {
            body: data.body || "Set starts in 15 minutes!",
            icon: data.icon || "/icons/icon-192.png",
            badge: "/icons/badge-96.png",
            data: {
                url: data.url || "/"
            },
            vibrate: [100, 50, 100],
        }

        event.waitUntil(
            self.registration.showNotification(data.title || "BØDEN Radio", options)
        )
    } catch (err) {
        console.error("Push event error:", err)
    }
})

// ── Notification Click: focus/open the application ───────────────────────────
self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const urlToOpen = event.notification.data.url || "/"

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window open with this URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i]
                if (client.url === urlToOpen && "focus" in client) {
                    return client.focus()
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen)
            }
        })
    )
})
