"use client"

import { useState, useEffect } from "react"

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

export function StickerPackManager() {
    const [packs, setPacks] = useState<Pack[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        fetch("/api/stickers")
            .then(r => r.json())
            .then(data => { setPacks(data); setLoading(false) })
            .catch(() => { setError("Failed to load"); setLoading(false) })
    }, [])

    const savePacks = async (newPacks: Pack[]) => {
        setError(""); setSuccess("")
        try {
            const res = await fetch("/api/stickers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPacks)
            })
            if (!res.ok) throw new Error("Save failed")
            setPacks(newPacks)
            setSuccess("Saved successfully")
            setTimeout(() => setSuccess(""), 3000)
        } catch {
            setError("Failed to save")
        }
    }

    const addPack = () => {
        const newPack: Pack = { id: `pack_${Date.now()}`, name: "New Pack", tier: "free", locked: false, stickers: [] }
        savePacks([...packs, newPack])
    }

    const removePack = (packId: string) => {
        if (confirm("Delete this pack?")) {
            savePacks(packs.filter(p => p.id !== packId))
        }
    }

    const updatePack = (packId: string, updates: Partial<Pack>) => {
        savePacks(packs.map(p => p.id === packId ? { ...p, ...updates } : p))
    }

    const addSticker = (packId: string) => {
        const newPacks = packs.map(p => {
            if (p.id === packId) {
                return {
                    ...p,
                    stickers: [...p.stickers, { id: `s_${Date.now()}`, type: "emoji" as const, value: "😊" }]
                }
            }
            return p
        })
        savePacks(newPacks)
    }

    const updateSticker = (packId: string, stickerId: string, updates: Partial<Sticker>) => {
        const newPacks = packs.map(pack => {
            if (pack.id === packId) {
                return {
                    ...pack,
                    stickers: pack.stickers.map(s => s.id === stickerId ? { ...s, ...updates } : s)
                }
            }
            return pack
        })
        savePacks(newPacks)
    }

    const removeSticker = (packId: string, stickerId: string) => {
        const newPacks = packs.map(pack => {
            if (pack.id === packId) {
                return {
                    ...pack,
                    stickers: pack.stickers.filter(s => s.id !== stickerId)
                }
            }
            return pack
        })
        savePacks(newPacks)
    }

    if (loading) return <div>Loading stickers...</div>

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-semibold font-mono text-[#99CCCC]">STICKER PACKS MANAGER</h2>
                <button onClick={addPack} className="px-3 py-1 text-xs bg-[#99CCCC] text-black font-bold rounded-sm hover:bg-white transition">
                    + Add Pack
                </button>
            </div>

            {error && <div className="text-red-400 text-xs mb-3 font-mono">{error}</div>}
            {success && <div className="text-[#99CCCC] text-xs mb-3 font-mono">{success}</div>}

            <div className="space-y-6">
                {packs.map(pack => (
                    <div key={pack.id} className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                        <div className="flex gap-4 items-center mb-4">
                            <input
                                value={pack.name}
                                onChange={e => updatePack(pack.id, { name: e.target.value })}
                                placeholder="Pack Name"
                                className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white"
                            />
                            <select
                                value={pack.tier}
                                onChange={e => updatePack(pack.id, { tier: e.target.value as "free" | "plus" })}
                                className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white"
                            >
                                <option value="free">Free</option>
                                <option value="plus">Plus (Premium)</option>
                            </select>
                            <button onClick={() => removePack(pack.id)} className="text-[10px] text-red-500 hover:underline">
                                Delete Pack
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {pack.stickers.map(sticker => (
                                <div key={sticker.id} className="flex gap-2 items-center bg-[#111] p-2 border border-[#2a2a2a]">
                                    <select
                                        value={sticker.type}
                                        onChange={e => updateSticker(pack.id, sticker.id, { type: e.target.value as any })}
                                        className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white w-24"
                                    >
                                        <option value="emoji">Emoji</option>
                                        <option value="image">Image URL</option>
                                        <option value="lottie">Lottie URL</option>
                                    </select>

                                    {sticker.type === "emoji" ? (
                                        <input
                                            value={sticker.value || ""}
                                            onChange={e => updateSticker(pack.id, sticker.id, { value: e.target.value })}
                                            placeholder="Emoji (e.g. 🔥)"
                                            className="flex-1 bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white"
                                        />
                                    ) : (
                                        <input
                                            value={sticker.url || ""}
                                            onChange={e => updateSticker(pack.id, sticker.id, { url: e.target.value })}
                                            placeholder="URL (https://...png)"
                                            className="flex-1 bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white"
                                        />
                                    )}

                                    <button onClick={() => removeSticker(pack.id, sticker.id)} className="text-[10px] text-red-500 mx-2">
                                        X
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => addSticker(pack.id)} className="text-[10px] border border-[#2a2a2a] px-2 py-1 text-[#737373] hover:text-white">
                            + Add Sticker
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
