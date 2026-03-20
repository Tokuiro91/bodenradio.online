import { NextResponse } from "next/server"
import { getSessions } from "@/lib/analytics-store"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Session is considered "online" if active within the last 5 minutes
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

export async function GET() {
    const serverSession = await auth()
    if (!serverSession?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = Date.now()
    const sessions = getSessions()

    const active = sessions.filter(s => now - s.lastActive <= ONLINE_THRESHOLD_MS)

    // Registered users — list individually
    const registered = active
        .filter(s => s.isRegistered)
        .map(s => ({
            name: s.userName || "User",
            country: s.country || null,
            city: s.city || null,
            lastActive: s.lastActive,
        }))
        // deduplicate by name (same user can have multiple sessions/tabs)
        .filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i)
        .sort((a, b) => b.lastActive - a.lastActive)

    // Anonymous — group by country
    const anonMap: Record<string, number> = {}
    for (const s of active) {
        if (s.isRegistered) continue
        const key = s.country || "Unknown"
        anonMap[key] = (anonMap[key] || 0) + 1
    }
    const anonymous = Object.entries(anonMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)

    return NextResponse.json({
        totalOnline: active.length,
        registered,
        anonymous,
    }, {
        headers: {
            "Cache-Control": "no-store",
        }
    })
}
