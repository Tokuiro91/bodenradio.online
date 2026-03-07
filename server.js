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

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"})`)
        console.log(`> WebSocket server listening on ws://localhost:${port}/ws`)
    })
})
