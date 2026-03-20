import { getEvents } from "./analytics-store"

/**
 * Computes total listening time (ms) for a given time slot
 * by cross-referencing play/pause events from analytics.
 */
export function computeListeningMsForSlot(slotStartMs: number, slotEndMs: number): number {
    const events = getEvents()

    // Group play/pause events by session
    const playPauseBySession: Record<string, { timestamp: number; type: "play" | "pause" }[]> = {}
    for (const e of events) {
        if (e.type !== "play" && e.type !== "pause") continue
        if (!playPauseBySession[e.sessionId]) playPauseBySession[e.sessionId] = []
        playPauseBySession[e.sessionId].push({ timestamp: e.timestamp, type: e.type as "play" | "pause" })
    }

    let totalMs = 0

    for (const evts of Object.values(playPauseBySession)) {
        const sorted = evts.sort((a, b) => a.timestamp - b.timestamp)
        let playStart: number | null = null

        for (const evt of sorted) {
            if (evt.type === "play") {
                if (playStart === null) playStart = evt.timestamp
            } else if (evt.type === "pause" && playStart !== null) {
                const overlapStart = Math.max(slotStartMs, playStart)
                const overlapEnd = Math.min(slotEndMs, evt.timestamp)
                if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart
                playStart = null
            }
        }

        // Window without a closing pause — clamp to slot end
        if (playStart !== null) {
            const overlapStart = Math.max(slotStartMs, playStart)
            const overlapEnd = Math.min(slotEndMs, Date.now())
            if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart
        }
    }

    return totalMs
}
