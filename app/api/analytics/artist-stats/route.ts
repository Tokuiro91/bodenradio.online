import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getArtistDB } from "@/lib/artist-db-store"
import { getListeners } from "@/lib/listeners-store"
import { getSessions, getEvents } from "@/lib/analytics-store"
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
    const events = getEvents()

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

    // Build session index for lastActive lookup
    const sessionIndex: Record<string, { lastActive: number; endMs: number }> = {}
    for (const s of sessions) {
        sessionIndex[s.id] = {
            lastActive: s.lastActive,
            endMs: s.startedAt + (s.totalDurationMs || 0),
        }
    }

    // Build actual radio listening windows from play/pause events
    // Group play/pause events by sessionId, sorted by time
    const playPauseBySession: Record<string, { timestamp: number; type: "play" | "pause" }[]> = {}
    for (const e of events) {
        if (e.type !== "play" && e.type !== "pause") continue
        if (!playPauseBySession[e.sessionId]) playPauseBySession[e.sessionId] = []
        playPauseBySession[e.sessionId].push({ timestamp: e.timestamp, type: e.type as "play" | "pause" })
    }

    // Convert play/pause pairs into listening windows
    const listeningWindows: { startMs: number; endMs: number; sessionId: string }[] = []
    for (const [sessionId, evts] of Object.entries(playPauseBySession)) {
        const sorted = evts.sort((a, b) => a.timestamp - b.timestamp)
        let playStart: number | null = null

        for (const evt of sorted) {
            if (evt.type === "play") {
                // Start a new listening window (ignore double-play)
                if (playStart === null) playStart = evt.timestamp
            } else if (evt.type === "pause" && playStart !== null) {
                listeningWindows.push({ startMs: playStart, endMs: evt.timestamp, sessionId })
                playStart = null
            }
        }

        // Still playing (no pause) — use current server time as end
        if (playStart !== null) {
            listeningWindows.push({ startMs: playStart, endMs: Date.now(), sessionId })
        }
    }

    // Compute stats for each DBArtist
    const result = dbArtists.map(artist => {
        const bookmarks = bookmarkMap[artist.id] || 0
        const slots = slotsByDbId[artist.id] || []

        // Start with historically accumulated time from removed/moved slots
        let listeningTimeMs = artist.accumulatedListeningMs || 0
        const uniqueSessionIds = new Set<string>()

        for (const slot of slots) {
            for (const win of listeningWindows) {
                // Overlap between actual listening window and artist's time slot
                const overlapStart = Math.max(slot.startMs, win.startMs)
                const overlapEnd = Math.min(slot.endMs, win.endMs)
                if (overlapEnd > overlapStart) {
                    listeningTimeMs += overlapEnd - overlapStart
                    uniqueSessionIds.add(win.sessionId)
                }
            }
        }

        // Rating: weighted score (bookmarks × 3 + schedule count × 2 + hours listened)
        const listeningHours = listeningTimeMs / 3_600_000
        const scheduleCount = artist.scheduleCount || 0
        const rating = bookmarks * 3 + scheduleCount * 2 + listeningHours

        return {
            id: artist.id,
            name: artist.name,
            show: artist.show,
            image: artist.image,
            location: artist.location,
            bookmarks,
            slots: slots.length,
            scheduleCount: artist.scheduleCount || 0,
            listeningTimeMs,
            uniqueListeners: uniqueSessionIds.size,
            rating: parseFloat(rating.toFixed(2)),
        }
    })

    // Sort by rating descending by default
    result.sort((a, b) => b.rating - a.rating)

    return NextResponse.json(result)
}
