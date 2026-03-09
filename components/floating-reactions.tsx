"use client"

import { useEffect, useState, useCallback } from "react"
import { socketService } from "@/lib/socket"
import { AnimatePresence, motion } from "framer-motion"

interface FloatingReaction {
    id: string
    value?: string
    url?: string
    type: "emoji" | "image" | "lottie"
    x: number // horizontal position %
}

export function FloatingReactions() {
    const [reactions, setReactions] = useState<FloatingReaction[]>([])

    const addReaction = useCallback((data: any) => {
        const newReaction: FloatingReaction = {
            id: `${data.id || Date.now()}-${Math.random()}`,
            value: data.value,
            url: data.url,
            type: data.stickerType || "emoji",
            x: Math.random() * 80 + 10, // 10% to 90%
        }

        setReactions(prev => [...prev.slice(-20), newReaction]) // Keep last 20

        // Auto remove after animation
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== newReaction.id))
        }, 4000)
    }, [])

    useEffect(() => {
        const socket = socketService.connect()

        // Listen for global socket reactions
        socket.on("reaction", addReaction)

        // Listen for local system events (optional, if we want to show our own too)
        const handleLocal = (e: any) => addReaction(e.detail)
        window.addEventListener("local-reaction", handleLocal)

        return () => {
            socket.off("reaction", addReaction)
            window.removeEventListener("local-reaction", handleLocal)
        }
    }, [addReaction])

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            <AnimatePresence>
                {reactions.map(r => (
                    <motion.div
                        key={r.id}
                        initial={{ y: "100vh", x: `${r.x}vw`, opacity: 0, scale: 0.5, rotate: 0 }}
                        animate={{
                            y: "-10vh",
                            opacity: [0, 1, 1, 0],
                            scale: [0.5, 1.2, 1, 0.8],
                            rotate: Math.random() * 40 - 20
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 3.5, ease: "easeOut" }}
                        className="absolute text-4xl select-none"
                    >
                        {r.type === "emoji" && r.value}
                        {r.type === "image" && r.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.url} alt="reaction" className="w-12 h-12 object-contain" />
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
