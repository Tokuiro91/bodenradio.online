"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface Reaction {
    id: string
    userId: string
    username: string
    packId: string
    stickerId: string
    stickerType: "emoji" | "image" | "lottie"
    value?: string   // for emoji
    url?: string     // for image/lottie
    sentAt: number
}

const WS_URL = typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : ""

export function useReactions() {
    const [reactions, setReactions] = useState<Reaction[]>([])
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    const connect = useCallback(() => {
        if (!mountedRef.current || !WS_URL) return

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === "reaction") {
                    setReactions(prev => {
                        // Keep max 50 reactions in state; oldest gets removed
                        const next = [...prev, data as Reaction]
                        return next.slice(-50)
                    })
                }
            } catch { /* ignore parse errors */ }
        }

        ws.onclose = () => {
            if (!mountedRef.current) return
            // Reconnect after 3 seconds
            reconnectRef.current = setTimeout(connect, 3000)
        }

        ws.onerror = () => ws.close()
    }, [])

    useEffect(() => {
        mountedRef.current = true
        connect()
        return () => {
            mountedRef.current = false
            if (reconnectRef.current) clearTimeout(reconnectRef.current)
            wsRef.current?.close()
        }
    }, [connect])

    const removeReaction = useCallback((id: string) => {
        setReactions(prev => prev.filter(r => r.id !== id))
    }, [])

    const addLocalReaction = useCallback((reaction: Reaction) => {
        setReactions(prev => {
            const next = [...prev, reaction]
            return next.slice(-50)
        })
    }, [])

    return { reactions, removeReaction, addLocalReaction }
}
