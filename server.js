// Custom Next.js server with WebSocket support for real-time reactions
// Run with: node server.js
// In package.json dev script is updated to: node server.js

const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { WebSocketServer } = require("ws")

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT || "3000", 10)

const app = next({ dev })
const handle = app.getRequestHandler()

// Global WS server instance — shared with API routes via global
const webpush = require("web-push")
const fs = require("fs")
const path = require("path")

// VAPID keys should be in .env.local (Dotenv is loaded by Next.js, but for server.js we might need to load it manually or rely on process.env if run via npm)
// To be safe in standalone node, we can use a small helper or just rely on env vars being passed
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:chyrukoleksii@gmail.com"

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Track sent notifications to avoid duplicates: artistId-listenerEmail-timestamp
const sentNotifications = new Set()

/** @type {WebSocketServer} */
let wss

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true)
        handle(req, res, parsedUrl)
    })

    // Attach WebSocket server to the same HTTP server
    wss = new WebSocketServer({ noServer: true })

    // Expose globally so API routes can broadcast
    global.__wss = wss

    wss.on("connection", (ws, req) => {
        const ip = req.socket.remoteAddress
        console.log(`[WS] New connection from ${ip}`)
        ws.isAlive = true
        ws.on("pong", () => { ws.isAlive = true })
        ws.on("error", (err) => console.error(`[WS] Client error (${ip}):`, err))
        ws.on("close", () => console.log(`[WS] Connection closed (${ip})`))
    })

    // Heartbeat to clean up stale connections
    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate()
            ws.isAlive = false
            ws.ping()
        })
    }, 30000)

    wss.on("close", () => clearInterval(heartbeat))

    // Upgrade HTTP → WebSocket for /ws path
    server.on("upgrade", (req, socket, head) => {
        const { pathname } = parse(req.url)
        if (pathname === "/ws") {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req)
            })
        } else {
            socket.destroy()
        }
    })

    // ── PWA Notification Worker ──────────────────────────────────────────────
    async function checkNotifications() {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

        try {
            const listenersPath = path.join(process.cwd(), "data", "listeners.json")
            const artistsPath = path.join(process.cwd(), "data", "artists.json")

            if (!fs.existsSync(listenersPath) || !fs.existsSync(artistsPath)) return

            const listeners = JSON.parse(fs.readFileSync(listenersPath, "utf-8"))
            const artists = JSON.parse(fs.readFileSync(artistsPath, "utf-8"))

            const now = Date.now()
            const alertThreshold = 15 * 60 * 1000 // 15 minutes
            const windowLimit = 60 * 1000 // 1 minute window for checking

            artists.forEach(artist => {
                const startTime = new Date(artist.startTime).getTime()
                const timeToStart = startTime - now

                // Check if artist starts in 14-15 minutes
                if (timeToStart > alertThreshold - windowLimit && timeToStart <= alertThreshold) {
                    listeners.forEach(listener => {
                        const isFav = listener.favoriteArtists && listener.favoriteArtists.includes(artist.id)
                        const hasSubs = listener.pushSubscriptions && listener.pushSubscriptions.length > 0
                        const notificationKey = `${artist.id}-${listener.email}`

                        if (isFav && hasSubs && !sentNotifications.has(notificationKey)) {
                            console.log(`[Push] Sending alert to ${listener.email} for ${artist.name}`)

                            const payload = JSON.stringify({
                                title: "Artist Starting Soon!",
                                body: `${artist.name} starts their set in 15 minutes. Don't miss it!`,
                                icon: artist.image || "/icons/icon-192.png",
                                url: `/?scroll=artist-${artist.id}`
                            })

                            listener.pushSubscriptions.forEach(sub => {
                                webpush.sendNotification(sub, payload).catch(err => {
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        // Subscription expired or invalid — should ideally remove it
                                        console.log(`[Push] Subscription expired for ${listener.email}`)
                                    } else {
                                        console.error(`[Push] Error sending to ${listener.email}:`, err.message)
                                    }
                                })
                            })

                            sentNotifications.add(notificationKey)
                            // Cleanup old notifications from the set after 30 mins
                            setTimeout(() => sentNotifications.delete(notificationKey), 30 * 60 * 1000)
                        }
                    })
                }
            })
        } catch (err) {
            console.error("[Push Worker Error]:", err)
        }
    }

    // Run check every minute
    const notificationInterval = setInterval(checkNotifications, 60000)
    checkNotifications() // Run once on start

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"})`)
        console.log(`> WebSocket server listening on ws://localhost:${port}/ws`)
    })
})
