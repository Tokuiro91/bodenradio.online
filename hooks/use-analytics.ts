"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

function generateId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export function useAnalytics() {
    const pathname = usePathname()
    const sessionIdRef = useRef<string | null>(null)
    const sessionStartRef = useRef<number>(Date.now())
    const lastTrackedPathRef = useRef<string | null>(null)

    // 1. Initialize session on mount
    useEffect(() => {
        let sid = localStorage.getItem("analytics_session_id")
        let startStr = sessionStorage.getItem("analytics_session_start")

        const now = Date.now()

        if (!sid || !startStr) {
            sid = generateId()
            startStr = now.toString()
            localStorage.setItem("analytics_session_id", sid)
            sessionStorage.setItem("analytics_session_start", startStr)
        }

        sessionIdRef.current = sid
        sessionStartRef.current = parseInt(startStr, 10)
    }, [])

    // 2. Track Pageviews & send beacon
    useEffect(() => {
        if (!sessionIdRef.current) return
        if (pathname === lastTrackedPathRef.current) return

        lastTrackedPathRef.current = pathname

        const duration = Date.now() - sessionStartRef.current

        // Send the track event
        fetch("/api/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: sessionIdRef.current,
                type: "pageview",
                path: pathname,
                referrer: document.referrer,
                userAgent: navigator.userAgent,
                clientDurationMs: duration,
            }),
        }).catch(console.error)
    }, [pathname])

    // 3. Keepalive and cleanup logic for session duration updates
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!sessionIdRef.current) return
            const duration = Date.now() - sessionStartRef.current
            const payload = JSON.stringify({
                sessionId: sessionIdRef.current,
                type: "keepalive",
                clientDurationMs: duration,
            })

            // Try beacon first
            if (typeof navigator.sendBeacon === "function") {
                navigator.sendBeacon("/api/analytics/track", new Blob([payload], { type: "application/json" }))
            } else {
                fetch("/api/analytics/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    keepalive: true,
                }).catch(() => { })
            }
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        window.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                handleBeforeUnload()
            }
        })

        // Tick every minute
        const interval = setInterval(handleBeforeUnload, 60000)

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload)
            clearInterval(interval)
        }
    }, [])
}
