import { NextResponse } from "next/server"
import { AnalyticsSession, AnalyticsEvent, updateSession, appendEvent, getSessions } from "@/lib/analytics-store"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
    try {
        const data = await req.json()
        const { sessionId, type, path, referrer, userAgent, clientDurationMs } = data

        if (!sessionId || !type) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const serverSession = await auth()
        const isRegistered = !!serverSession?.user && serverSession.user.role === "listener"

        const now = Date.now()

        // Refined IP extraction
        const forwarded = req.headers.get("x-forwarded-for")
        const realIp = req.headers.get("x-real-ip")
        let ip = forwarded ? forwarded.split(",")[0].trim() : (realIp || "unknown")

        // Clean IPv6-to-IPv4 prefix
        if (ip.startsWith("::ffff:")) {
            ip = ip.substring(7)
        }

        let country = req.headers.get("x-vercel-ip-country") || undefined
        let city = req.headers.get("x-vercel-ip-city") ? decodeURIComponent(req.headers.get("x-vercel-ip-city")!) : undefined

        // Fallback geo-location if not on Vercel
        if (!country && ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("192.168.")) {
            try {
                const geoRes = await fetch(`http://ip-api.com/json/${ip.split(",")[0].trim()}`)
                const geoData = await geoRes.json()
                if (geoData.status === "success") {
                    country = geoData.countryCode
                    city = geoData.city
                }
            } catch (err) {
                console.error("Geo-location fallback failed:", err)
            }
        }

        // Determine source
        let source: AnalyticsSession["source"] = "direct"
        if (referrer) {
            const refUrl = referrer.toLowerCase()
            if (refUrl.includes("instagram.com") || refUrl.includes("t.me") || refUrl.includes("t.co") || refUrl.includes("facebook.com")) {
                source = "social"
            } else if (refUrl.includes("google.") || refUrl.includes("yandex.") || refUrl.includes("bing.")) {
                source = "search"
            } else {
                source = "referral"
            }
        }

        // Load existing sessions to see if this is new
        const sessions = getSessions()
        let session = sessions.find((s) => s.id === sessionId)

        if (!session) {
            // New session
            session = {
                id: sessionId,
                startedAt: now,
                lastActive: now,
                ip,
                userAgent: userAgent || req.headers.get("user-agent") || "unknown",
                referrer: referrer || "",
                source,
                country,
                city,
                totalDurationMs: 0,
                isRegistered,
            }
        } else {
            // Update existing session
            session.lastActive = now
            session.isRegistered = isRegistered // keep updated
            if (clientDurationMs) {
                session.totalDurationMs = Math.max(session.totalDurationMs, clientDurationMs)
            } else {
                session.totalDurationMs = now - session.startedAt
            }
        }

        // Save session
        updateSession(session)

        // Store the specific event
        const event: AnalyticsEvent = {
            sessionId,
            timestamp: now,
            type,
            path,
        }
        appendEvent(event)

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("Analytics track error:", err)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
