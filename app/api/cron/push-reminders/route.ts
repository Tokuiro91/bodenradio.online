import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import webpush from "web-push"
import { getListeners } from "@/lib/listeners-store"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:chyrukoleksii@gmail.com"
const CRON_SECRET = process.env.CRON_SECRET

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const ARTISTS_FILE = path.join(process.cwd(), "data", "artists.json")
const SENT_FILE = path.join(process.cwd(), "data", "push-sent.json")

// Windows: 24h ±10min and 10min ±1min
const WINDOW_24H_MS = 24 * 60 * 60 * 1000
const WINDOW_10MIN_MS = 10 * 60 * 1000
const TOLERANCE_24H_MS = 10 * 60 * 1000  // ±10 min
const TOLERANCE_10MIN_MS = 60 * 1000      // ±1 min

function readSent(): Record<string, boolean> {
    try {
        if (fs.existsSync(SENT_FILE)) return JSON.parse(fs.readFileSync(SENT_FILE, "utf-8"))
    } catch {}
    return {}
}

function writeSent(sent: Record<string, boolean>) {
    try {
        fs.writeFileSync(SENT_FILE, JSON.stringify(sent))
    } catch {}
}

function formatDateTime(iso: string): string {
    const d = new Date(iso)
    const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    return `${date} at ${time} UTC`
}

export async function GET(req: NextRequest) {
    // Auth check
    const auth = req.headers.get("authorization")
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        if (!fs.existsSync(ARTISTS_FILE)) {
            return NextResponse.json({ ok: true, skipped: "no artists file" })
        }

        const artists: any[] = JSON.parse(fs.readFileSync(ARTISTS_FILE, "utf-8"))
        const listeners = getListeners().filter(
            l => l.pushEnabled && l.pushSubscriptions && l.pushSubscriptions.length > 0
        )

        if (listeners.length === 0) {
            return NextResponse.json({ ok: true, skipped: "no eligible listeners" })
        }

        const now = Date.now()
        const sent = readSent()
        const pushes: Promise<any>[] = []
        let queued = 0

        for (const artist of artists) {
            if (artist.type === "ad") continue
            const startMs = new Date(artist.startTime).getTime()
            const msUntil = startMs - now
            const artistId = artist.dbId || String(artist.id)

            let type: "24h" | "10min" | null = null
            if (Math.abs(msUntil - WINDOW_24H_MS) < TOLERANCE_24H_MS) type = "24h"
            else if (Math.abs(msUntil - WINDOW_10MIN_MS) < TOLERANCE_10MIN_MS) type = "10min"
            if (!type) continue

            for (const listener of listeners) {
                if (!listener.favoriteArtists?.includes(artistId)) continue

                const key = `${listener.id}:${artistId}:${artist.startTime}:${type}`
                if (sent[key]) continue

                const body = type === "24h"
                    ? `Your favorite artist - ${artist.name}, plays ${formatDateTime(artist.startTime)}, don't miss it! ❤️`
                    : `Your favorite artist - ${artist.name}, starts in 10 minutes! ❤️`

                const payload = JSON.stringify({
                    title: "BØDEN Radio ❤️",
                    body,
                    icon: "/icons/icon-192.png",
                    url: "/",
                })

                listener.pushSubscriptions!.forEach(sub => {
                    pushes.push(
                        webpush.sendNotification(sub, payload)
                            .then(() => { sent[key] = true })
                            .catch(() => {}) // ignore dead subscriptions
                    )
                })
                queued++
            }
        }

        await Promise.allSettled(pushes)
        writeSent(sent)

        return NextResponse.json({ ok: true, queued })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
