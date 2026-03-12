import { NextResponse } from "next/server"
import os from "os"
import { execSync } from "child_process"

function fmtBytes(bytes: number) {
    const gb = bytes / 1024 / 1024 / 1024
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`
}

async function getIcecastStats() {
    try {
        const icecastPass = process.env.ICECAST_PASSWORD || "admin"
        const res = await fetch(`http://admin:${icecastPass}@localhost:8000/admin/stats`, {
            signal: AbortSignal.timeout(2000),
        })
        if (!res.ok) return null
        const xml = await res.text()
        const listeners = parseInt(xml.match(/<listeners>(\d+)<\/listeners>/)?.[1] ?? "0")
        const maxListeners = parseInt(xml.match(/<listener_peak>(\d+)<\/listener_peak>/)?.[1] ?? "0") ||
                             parseInt(xml.match(/<max_listeners>(\d+)<\/max_listeners>/)?.[1] ?? "100")
        return { listeners, maxListeners }
    } catch {
        return null
    }
}

export async function GET() {
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
            // df outputs KB on Linux with -k
            const df = execSync("df -k / | tail -1").toString().trim().split(/\s+/)
            // columns: Filesystem 1K-blocks Used Available Use% Mounted
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
        // Use 100 as default max if we can't get it; peak is better than max_listeners
        const broadcastMax = Math.max(icecast?.maxListeners ?? 100, broadcastListeners, 1)
        const broadcastPercent = Math.min(100, Math.round((broadcastListeners / broadcastMax) * 100))

        return NextResponse.json({
            // legacy fields (used by existing components)
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
            broadcastMax,
            broadcastPercent,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
