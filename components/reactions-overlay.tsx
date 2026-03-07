"use client"

import { useEffect, useRef, useCallback } from "react"
import { useReactions, type Reaction } from "@/hooks/use-reactions"

// ── Individual floating reaction bubble ───────────────────────────────────────

function FloatingReaction({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        // Random horizontal start position centered around the card (45%–55%)
        const x = 45 + Math.random() * 10
        el.style.left = `${x}%`

        // Random horizontal drift during float (-30px to +30px)
        const drift = -30 + Math.random() * 60
        el.style.setProperty("--drift", `${drift}px`)

        // Animate: Fly from bottom (30%) to top (80%) over 2 seconds
        el.animate(
            [
                { transform: "translateY(0) scale(0.5)", opacity: 0 },
                { transform: "translateY(-50px) scale(2)", opacity: 1, offset: 0.2 },
                { transform: "translateY(-400px) translateX(calc(var(--drift))) scale(1.5)", opacity: 0, offset: 1 },
            ],
            {
                duration: 2000,
                easing: "ease-out",
                fill: "forwards",
            }
        ).onfinish = onDone

        return () => { }
    }, [onDone])

    const size = reaction.stickerType === "emoji" ? "text-4xl" : "w-12 h-12"

    return (
        <div
            ref={ref}
            className="absolute bottom-[30%] pointer-events-none select-none"
            style={{
                willChange: "transform, opacity",
                zIndex: 9999,
            }}
        >
            {reaction.stickerType === "emoji" && (
                <span className={`${size} drop-shadow-2xl`} role="img" aria-label={reaction.value}>
                    {reaction.value}
                </span>
            )}
            {reaction.stickerType === "image" && reaction.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reaction.url} alt="reaction" className="w-10 h-10 object-contain drop-shadow-2xl" />
            )}
        </div>
    )
}

// ── Reactions overlay — renders all floating reactions ────────────────────────

export function ReactionsOverlay() {
    const { reactions, removeReaction } = useReactions()

    // Keep max 30 simultaneous animations for performance
    const visible = reactions.slice(-30)

    return (
        <div
            className="fixed inset-0 overflow-hidden pointer-events-none"
            style={{ zIndex: 9998 }}
            aria-hidden="true"
        >
            {visible.map((r) => (
                <FloatingReaction
                    key={r.id}
                    reaction={r}
                    onDone={() => removeReaction(r.id)}
                />
            ))}
        </div>
    )
}
