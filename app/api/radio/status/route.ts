import { NextResponse } from "next/server"

const ICECAST_PASS = process.env.ICECAST_PASSWORD || "admin"
const ICECAST_URL = `http://localhost:8000/admin/stats`
const ICECAST_AUTH = "Basic " + Buffer.from(`admin:${ICECAST_PASS}`).toString("base64")
const CACHE_TTL_MS = 10_000

let cache: { data: IcecastStatus; ts: number } | null = null

interface IcecastStatus {
    online: boolean
    listeners: number
    title: string
    mountpoint: string
    bitrate: number
}

function extractXml(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))
    return match ? match[1].trim() : ""
}

async function fetchIcecastStatus(): Promise<IcecastStatus> {
    const res = await fetch(ICECAST_URL, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
        headers: { "Authorization": ICECAST_AUTH },
    })

    if (!res.ok) throw new Error(`Icecast returned ${res.status}`)

    const xml = await res.text()

    // Parse the first <source> block
    const sourceBlock = xml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? ""

    const listeners = parseInt(extractXml(sourceBlock || xml, "listeners") || "0", 10)
    const title = extractXml(sourceBlock, "title") || extractXml(xml, "server_name") || ""
    const mountpoint = xml.match(/mount="([^"]+)"/)?.[1] ?? ""
    const bitrate = parseInt(extractXml(sourceBlock, "bitrate") || "0", 10)

    return { online: true, listeners, title, mountpoint, bitrate }
}

export async function GET() {
    // Serve from cache if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
        return NextResponse.json(cache.data)
    }

    try {
        const status = await fetchIcecastStatus()
        cache = { data: status, ts: Date.now() }
        return NextResponse.json(status)
    } catch {
        const offline: IcecastStatus = { online: false, listeners: 0, title: "", mountpoint: "", bitrate: 0 }
        cache = { data: offline, ts: Date.now() }
        return NextResponse.json(offline)
    }
}
