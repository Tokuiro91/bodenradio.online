import { NextResponse } from "next/server"
import os from "os"
import { execSync } from "child_process"

// Realistic listener capacity for 1 vCPU server (128 kbps stream)
const BROADCAST_CAPACITY = 100

function fmtBytes(bytes: number) {
    const gb = bytes / 1024 / 1024 / 1024
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`
}

// 1-second server-side cache to avoid hammering on rapid polling
let cache: { data: any; ts: number } | null = null
const CACHE_TTL_MS = 1000

async function getIcecastStats() {
    try {
        const icecastPass = process.env.ICECAST_PASSWORD || "admin"
        const res = await fetch(`http://localhost:8000/admin/stats`, {
            signal: AbortSignal.timeout(2000),
            headers: {
                "Authorization": "Basic " + Buffer.from(`admin:${icecastPass}`).toString("base64"),
            },
        })
        if (!res.ok) return null
        const xml = await res.text()
        const listeners = parseInt(xml.match(/<listeners>(\d+)<\/listeners>/)?.[1] ?? "0")
        return { listeners }
    } catch {
        return null
    }
}

export async function GET() {
    // Return cached data if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
        return NextResponse.json(cache.data)
    }

    try {
        // CPU: load average / cpuCount → percentage
        const cpuCount = os.cpus().length
        const loadAvg1m = os.loadavg()[0]
        const cpuPercent = Math.min(100, (loadAvg1m / cpuCount) * 100)

        // RAM
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const ramPercent = (usedMem / totalMem) * 100

        // Disk: parse df output → total/free in GB
        let diskFreeBytes = 0
        let diskTotalBytes = 0
        let diskUsedPercent = 0
        try {
            const df = execSync("df -k / | tail -1").toString().trim().split(/\s+/)
            diskTotalBytes = parseInt(df[1]) * 1024
            const diskAvailBytes = parseInt(df[3]) * 1024
            diskFreeBytes = diskAvailBytes
            diskUsedPercent = parseInt(df[4]) || 0
        } catch {
            diskUsedPercent = 0
        }

        // Icecast broadcast load
        const icecast = await getIcecastStats()
        const broadcastListeners = icecast?.listeners ?? 0

        // Use realistic 100-listener capacity (1 vCPU server limit)
        const broadcastPercent = Math.min(100, Math.round((broadcastListeners / BROADCAST_CAPACITY) * 100))

        // Bandwidth estimate: 128 kbps per listener = 16 KB/s each
        const bandwidthKBs = broadcastListeners * 16
        const bandwidthStr = bandwidthKBs >= 1024
            ? `${(bandwidthKBs / 1024).toFixed(1)} MB/s`
            : `${bandwidthKBs} KB/s`

        const data = {
            // legacy fields
            cpu: `${cpuPercent.toFixed(1)}%`,
            memory: `${ramPercent.toFixed(1)}%`,
            storage: `${diskUsedPercent}%`,
            latency: "—",
            uptime: Math.floor(os.uptime() / 3600) + "h",

            // enriched fields
            cpuPercent: parseFloat(cpuPercent.toFixed(1)),
            ramPercent: parseFloat(ramPercent.toFixed(1)),
            ramFree: fmtBytes(freeMem),
            ramTotal: fmtBytes(totalMem),
            diskFree: fmtBytes(diskFreeBytes),
            diskTotal: fmtBytes(diskTotalBytes),
            diskUsedPercent,
            broadcastListeners,
            broadcastMax: BROADCAST_CAPACITY,
            broadcastPercent,
            bandwidthStr,
        }

        cache = { data, ts: Date.now() }
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
