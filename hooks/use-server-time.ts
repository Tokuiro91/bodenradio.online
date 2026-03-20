"use client"

import { useState, useEffect } from "react"

/** 
 * Returns the estimated offset between client and server time in ms.
 * offset = serverTime - clientTime.
 * True time = Date.now() + offset.
 */
export function useServerTimeSync() {
    const [offset, setOffset] = useState<number>(0)
    const [synced, setSynced] = useState(false)

    useEffect(() => {
        async function sync() {
            try {
                const start = Date.now()
                const res = await fetch("/api/time", { cache: "no-store" })
                if (!res.ok) return
                const data = await res.json()
                const end = Date.now()

                const rtt = end - start
                // Assume symmetric latency: server time was exact at (start + rtt/2)
                const serverTime = data.time
                const clientTimeAtServerRecv = start + rtt / 2

                setOffset(serverTime - clientTimeAtServerRecv)
                setSynced(true)
            } catch (err) {
                console.warn("Server time sync failed, falling back to local time", err)
            }
        }
        sync()

        // Resync every 15 minutes to account for clock drift
        const interval = setInterval(sync, 15 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    return { offset, synced }
}

/** Global getter for synced time across decoupled modules (if offset is known) */
let globalOffset = 0
export function setGlobalTimeOffset(offset: number) {
    globalOffset = offset
}
export function getSyncedTime() {
    return Date.now() + globalOffset
}

/**
 * Icecast stream buffer delay. Cards use this offset so they transition
 * ~5 seconds after the server clock boundary, matching what listeners actually hear.
 * Audio engine is NOT affected — only UI card display.
 */
export const STREAM_BUFFER_MS = 5_000
