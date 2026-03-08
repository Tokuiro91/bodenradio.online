import { NextResponse } from "next/server"
import { getSessions } from "@/lib/analytics-store"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
    const serverSession = await auth()
    if (!serverSession?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const url = new URL(req.url)
        const period = url.searchParams.get("period") || "all" // day, week, month, all

        const sessions = getSessions()
        const now = Date.now()

        // Filter by period
        const filteredSessions = sessions.filter(s => {
            if (period === "day") return now - s.startedAt <= 24 * 60 * 60 * 1000
            if (period === "week") return now - s.startedAt <= 7 * 24 * 60 * 60 * 1000
            if (period === "month") return now - s.startedAt <= 30 * 24 * 60 * 60 * 1000
            return true
        })

        const totalVisitors = filteredSessions.length
        let totalDurationMs = 0
        let registeredCount = 0
        let guestCount = 0

        const sourcesMap: Record<string, number> = {
            direct: 0,
            search: 0,
            social: 0,
            referral: 0,
            other: 0,
        }

        const geoMap: Record<string, number> = {}
        const hoursMap: Record<number, number> = Array(24).fill(0)
        const timelineMap: Record<string, number> = {}

        for (const s of filteredSessions) {
            totalDurationMs += s.totalDurationMs || 0

            if (s.isRegistered) registeredCount++
            else guestCount++

            sourcesMap[s.source] = (sourcesMap[s.source] || 0) + 1

            const geoKey = s.country || "Unknown"
            geoMap[geoKey] = (geoMap[geoKey] || 0) + 1

            const dateObj = new Date(s.startedAt)
            // If period is day, use hours for timeline? No, keep it as is for now or use something more granular
            const dayStr = dateObj.toISOString().split("T")[0]
            timelineMap[dayStr] = (timelineMap[dayStr] || 0) + 1

            const hour = dateObj.getHours()
            hoursMap[hour] = (hoursMap[hour] || 0) + 1
        }

        const avgDurationS = totalVisitors > 0 ? Math.round(totalDurationMs / totalVisitors / 1000) : 0

        const sourcesData = Object.entries(sourcesMap).map(([name, value]) => ({ name, value }))
        const geoData = Object.entries(geoMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)

        const timelineData = Object.entries(timelineMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, visitors]) => ({ date, visitors }))

        const heatmapData = Object.entries(hoursMap).map(([hour, count]) => ({
            hour: parseInt(hour, 10),
            count,
        }))

        return NextResponse.json({
            totalVisitors,
            registeredCount,
            guestCount,
            avgDurationS,
            sourcesData,
            geoData,
            timelineData,
            heatmapData,
            rawSessions: filteredSessions.map(s => ({
                id: s.id,
                startedAt: s.startedAt,
                duration: s.totalDurationMs,
                source: s.source,
                country: s.country,
                isRegistered: s.isRegistered
            })).slice(-50).reverse()
        })
    } catch (err) {
        console.error("Failed to load stats:", err)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
