"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Smile, Lock } from "lucide-react"
import dynamic from "next/dynamic"
import { useReactions } from "@/hooks/use-reactions"

interface Sticker {
    id: string
    type: "emoji" | "image" | "lottie"
    value?: string
    url?: string
}

interface Pack {
    id: string
    name: string
    tier: "free" | "plus"
    locked: boolean
    stickers: Sticker[]
}

export function ReactionPicker({ isFixed = true, className = "" }: { isFixed?: boolean; className?: string }) {
    const { data: session } = useSession()
    const { addLocalReaction } = useReactions()
    const [packs, setPacks] = useState<Pack[]>([])
    const [open, setOpen] = useState(false)
    const [activePack, setActivePack] = useState<string>("basic")
    const [sending, setSending] = useState(false)
    const [cooldown, setCooldown] = useState(false)

    const isLoggedIn = !!session?.user

    // Load packs
    useEffect(() => {
        if (!isLoggedIn) return
        fetch("/api/reactions/send")
            .then(r => r.json())
            .then(data => {
                setPacks(data)
                if (data.length) setActivePack(data[0].id)
            })
            .catch(console.error)
    }, [isLoggedIn])

    const sendReaction = useCallback(async (pack: Pack, sticker: Sticker) => {
        if (pack.locked || sending || cooldown) return
        setSending(true)

        try {
            // Local echo: trigger the animation immediately
            addLocalReaction({
                id: `local-${Date.now()}`,
                userId: session?.user?.id || "local",
                username: session?.user?.name || "Me",
                packId: pack.id,
                stickerId: sticker.id,
                stickerType: sticker.type,
                value: sticker.value,
                url: sticker.url,
                sentAt: Date.now(),
            })

            const res = await fetch("/api/reactions/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ packId: pack.id, stickerId: sticker.id }),
            })
            if (res.status === 429) {
                setCooldown(true)
                setTimeout(() => setCooldown(false), 1000)
            }
        } catch { /* ignore network errors */ }
        finally { setSending(false) }
    }, [sending, cooldown])

    if (!isLoggedIn) return null

    const currentPack = packs.find(p => p.id === activePack)

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={isFixed
                    ? "fixed bottom-6 right-6 z-[9997] w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#99CCCC] hover:bg-[#99CCCC]/10 transition-colors shadow-lg"
                    : `w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#99CCCC] hover:bg-[#99CCCC]/10 transition-colors shadow-lg ${className}`
                }
                aria-label="Open reaction picker"
            >
                <Smile className="w-5 h-5" />
            </button>

            {/* Picker panel */}
            {open && (
                <div className={isFixed
                    ? "fixed bottom-20 right-6 z-[9997] w-72 bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
                    : "absolute bottom-16 right-0 z-[9997] w-72 bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
                }>
                    {/* Pack tabs */}
                    <div className="flex border-b border-[#2a2a2a] overflow-x-auto">
                        {packs.map(pack => (
                            <button
                                key={pack.id}
                                onClick={() => !pack.locked && setActivePack(pack.id)}
                                className={`flex-shrink-0 px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${activePack === pack.id
                                    ? "text-[#99CCCC] border-b-2 border-[#99CCCC]"
                                    : "text-[#737373] hover:text-white"
                                    } ${pack.locked ? "opacity-50 cursor-not-allowed" : ""}`}
                                title={pack.locked ? "BØDEN Plus required" : pack.name}
                            >
                                {pack.locked && <Lock className="w-3 h-3" />}
                                {pack.name}
                            </button>
                        ))}
                    </div>

                    {/* Sticker grid */}
                    <div className="p-3 grid grid-cols-5 gap-2">
                        {currentPack?.stickers.map(sticker => (
                            <button
                                key={sticker.id}
                                onClick={() => currentPack && sendReaction(currentPack, sticker)}
                                disabled={currentPack?.locked || cooldown}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all
                  hover:bg-[#99CCCC]/10 hover:scale-125 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${cooldown ? "animate-pulse" : ""}
                `}
                                title={sticker.id}
                            >
                                {sticker.type === "emoji" && sticker.value}
                                {sticker.type === "image" && sticker.url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={sticker.url} alt={sticker.id} className="w-8 h-8 object-contain" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Plus upsell */}
                    {packs.some(p => p.locked) && (
                        <div className="border-t border-[#2a2a2a] px-3 py-2 text-[10px] font-mono text-[#737373] text-center">
                            <span className="text-[#99CCCC] font-tektur">BØDEN Plus</span> — unlock premium sticker packs
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
