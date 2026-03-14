import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getArtistDB } from "@/lib/artist-db-store"
import { getListeners } from "@/lib/listeners-store"
import { getSessions } from "@/lib/analytics-store"
import fs from "fs"
import path from "path"
import type { Artist } from "@/lib/artists-data"

const ARTISTS_FILE = path.join(process.cwd(), "data", "artists.json")

function readScheduleArtists(): Artist[] {
    try {
        if (!fs.existsSync(ARTISTS_FILE)) return []
        const raw = fs.readFileSync(ARTISTS_FILE, "utf-8")
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
    const serverSession = await auth()
    if (!serverSession?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbArtists = getArtistDB()
    const listeners = getListeners()
    const scheduleEntries = readScheduleArtists()
    const sessions = getSessions()

    // Build bookmark map: dbArtistId → count
    const bookmarkMap: Record<string, number> = {}
    for (const listener of listeners) {
        for (const favId of listener.favoriteArtists || []) {
            bookmarkMap[favId] = (bookmarkMap[favId] || 0) + 1
        }
    }

    // Group schedule entries by dbId
    const slotsByDbId: Record<string, { startMs: number; endMs: number }[]> = {}
    for (const entry of scheduleEntries) {
        if (!entry.dbId) continue
        const startMs = new Date(entry.startTime).getTime()
        const endMs = new Date(entry.endTime).getTime()
        if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) continue
        if (!slotsByDbId[entry.dbId]) slotsByDbId[entry.dbId] = []
        slotsByDbId[entry.dbId].push({ startMs, endMs })
    }

    // Pre-process sessions
    const sessionWindows = sessions.map(s => ({
        id: s.id,
        startMs: s.startedAt,
        endMs: s.startedAt + (s.totalDurationMs || 0),
    })).filter(s => s.endMs > s.startMs)

    // Compute stats for each DBArtist
    const result = dbArtists.map(artist => {
        const bookmarks = bookmarkMap[artist.id] || 0
        const slots = slotsByDbId[artist.id] || []

        let listeningTimeMs = 0
        const uniqueSessionIds = new Set<string>()

        for (const slot of slots) {
            for (const sess of sessionWindows) {
                // Calculate overlap between slot and session
                const overlapStart = Math.max(slot.startMs, sess.startMs)
                const overlapEnd = Math.min(slot.endMs, sess.endMs)
                if (overlapEnd > overlapStart) {
                    listeningTimeMs += overlapEnd - overlapStart
                    uniqueSessionIds.add(sess.id)
                }
            }
        }

        // Rating: weighted score (bookmarks × 3 + unique listeners × 2 + hours)
        const listeningHours = listeningTimeMs / 3_600_000
        const rating = bookmarks * 3 + uniqueSessionIds.size * 2 + listeningHours

        return {
            id: artist.id,
            name: artist.name,
            show: artist.show,
            image: artist.image,
            location: artist.location,
            bookmarks,
            slots: slots.length,
            listeningTimeMs,
            uniqueListeners: uniqueSessionIds.size,
            rating: parseFloat(rating.toFixed(2)),
        }
    })

    // Sort by rating descending by default
    result.sort((a, b) => b.rating - a.rating)

    return NextResponse.json(result)
}
