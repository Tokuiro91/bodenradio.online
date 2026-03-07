"use client"

import { useEffect, useRef, useCallback } from "react"
import { useReactions, type Reaction } from "@/hooks/use-reactions"

// ── Individual floating reaction bubble ───────────────────────────────────────

function FloatingReaction({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        // Random horizontal start position (40%–60% of viewport to overlap card)
        const x = 40 + Math.random() * 20
        el.style.left = `${x}%`

        // Random horizontal drift during float (-20px to +20px)
        const drift = -20 + Math.random() * 40
        el.style.setProperty("--drift", `${drift}px`)

        // Animate: pop in, float up slowly, fade out
        el.animate(
            [
                { transform: "translateY(0) translateX(0) scale(0)", opacity: 0 },
                { transform: "translateY(-20px) translateX(calc(var(--drift) * 0.5)) scale(2)", opacity: 1, offset: 0.2 },
                { transform: "translateY(-100px) translateX(calc(var(--drift))) scale(2.5)", opacity: 0, offset: 1 },
            ],
            {
                duration: 2000 + Math.random() * 500,
                easing: "ease-out",
                fill: "forwards",
            }
        ).onfinish = onDone

        return () => { }
    }, [onDone])

    const size = reaction.stickerType === "emoji" ? "text-4xl" : "w-16 h-16"

    return (
        <div
            ref={ref}
            className="absolute bottom-1/2 pointer-events-none select-none"
            style={{
                willChange: "transform, opacity",
                zIndex: 9998,
                // --drift is set programmatically above
            }}
        >
            {reaction.stickerType === "emoji" && (
                <span className={`${size} drop-shadow-lg`} role="img" aria-label={reaction.value}>
                    {reaction.value}
                </span>
            )}
            {reaction.stickerType === "image" && reaction.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reaction.url} alt="reaction" className="w-10 h-10 object-contain" />
            )}
            {/* Username label */}
            <div className="text-center text-[9px] font-mono text-white/40 mt-0.5 truncate max-w-[60px]">
                {reaction.username}
            </div>
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
