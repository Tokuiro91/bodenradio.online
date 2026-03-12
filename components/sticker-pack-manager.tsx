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
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [dirty, setDirty] = useState(false)
    const [uploading, setUploading] = useState<string | null>(null)

    useEffect(() => {
        fetch("/api/stickers")
            .then(r => r.json())
            .then(data => { setPacks(data); setLoading(false) })
            .catch(() => { setError("Failed to load"); setLoading(false) })
    }, [])

    const savePacks = async () => {
        setSaving(true)
        setError(""); setSuccess("")
        try {
            const res = await fetch("/api/stickers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(packs)
            })
            if (!res.ok) throw new Error("Save failed")
            setSuccess("Saved")
            setDirty(false)
            setTimeout(() => setSuccess(""), 3000)
        } catch {
            setError("Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const update = (newPacks: Pack[]) => {
        setPacks(newPacks)
        setDirty(true)
    }

    const addPack = () => {
        const newPack: Pack = {
            id: `pack_${Date.now()}`,
            name: "New Pack",
            tier: "free",
            locked: false,
            stickers: []
        }
        update([...packs, newPack])
    }

    const removePack = (packId: string) => {
        if (confirm("Delete this pack?")) update(packs.filter(p => p.id !== packId))
    }

    const updatePack = (packId: string, updates: Partial<Pack>) => {
        update(packs.map(p => p.id === packId ? { ...p, ...updates } : p))
    }

    const addSticker = (packId: string) => {
        update(packs.map(p => p.id === packId
            ? { ...p, stickers: [...p.stickers, { id: `s_${Date.now()}`, type: "emoji" as const, value: "😊" }] }
            : p
        ))
    }

    const updateSticker = (packId: string, stickerId: string, updates: Partial<Sticker>) => {
        update(packs.map(pack => pack.id === packId
            ? { ...pack, stickers: pack.stickers.map(s => s.id === stickerId ? { ...s, ...updates } : s) }
            : pack
        ))
    }

    const removeSticker = (packId: string, stickerId: string) => {
        update(packs.map(pack => pack.id === packId
            ? { ...pack, stickers: pack.stickers.filter(s => s.id !== stickerId) }
            : pack
        ))
    }

    const uploadImage = async (packId: string, stickerId: string, file: File) => {
        setUploading(stickerId)
        setError("")
        try {
            const fd = new FormData()
            fd.append("file", file)
            const res = await fetch("/api/upload/image", { method: "POST", body: fd })
            if (!res.ok) throw new Error("Upload failed")
            const { url } = await res.json()
            updateSticker(packId, stickerId, { url })
        } catch {
            setError("Image upload failed")
        } finally {
            setUploading(null)
        }
    }

    if (loading) return <div className="p-4 text-xs text-[#9ca3af] font-mono">Loading stickers...</div>

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold font-mono text-[#99CCCC]">STICKER PACKS MANAGER</h2>
                    {dirty && <span className="text-[10px] text-yellow-500 font-mono">● Unsaved changes</span>}
                </div>
                <div className="flex gap-2 items-center">
                    {success && <span className="text-[10px] text-[#99CCCC] font-mono">{success}</span>}
                    <button
                        onClick={addPack}
                        className="px-3 py-1 text-xs border border-[#2a2a2a] text-[#737373] hover:text-white rounded-sm transition"
                    >
                        + Add Pack
                    </button>
                    <button
                        onClick={savePacks}
                        disabled={!dirty || saving}
                        className={`px-3 py-1 text-xs font-bold rounded-sm transition ${
                            dirty && !saving
                                ? "bg-[#99CCCC] text-black hover:bg-white"
                                : "bg-[#111] text-[#333] cursor-not-allowed"
                        }`}
                    >
                        {saving ? "Saving..." : "Save All"}
                    </button>
                </div>
            </div>

            {error && <div className="text-red-400 text-xs mb-3 font-mono">{error}</div>}

            <div className="space-y-6">
                {packs.length === 0 && (
                    <div className="text-xs text-[#444] font-mono">No packs. Click "+ Add Pack" to create one.</div>
                )}

                {packs.map(pack => (
                    <div key={pack.id} className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                        <div className="flex gap-3 items-center mb-4 flex-wrap">
                            <input
                                value={pack.name}
                                onChange={e => updatePack(pack.id, { name: e.target.value })}
                                placeholder="Pack Name"
                                className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white rounded-sm focus:border-[#99CCCC] outline-none"
                            />
                            <select
                                value={pack.tier}
                                onChange={e => updatePack(pack.id, { tier: e.target.value as "free" | "plus" })}
                                className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white rounded-sm"
                            >
                                <option value="free">Free</option>
                                <option value="plus">Plus (Premium)</option>
                            </select>
                            <button
                                onClick={() => removePack(pack.id)}
                                className="text-[10px] text-red-500 hover:underline ml-auto"
                            >
                                Delete Pack
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {pack.stickers.map(sticker => (
                                <div key={sticker.id} className="flex gap-2 items-center bg-[#111] p-2 border border-[#1a1a1a] rounded-sm">
                                    {/* Live preview */}
                                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm">
                                        {sticker.type === "emoji"
                                            ? <span className="text-xl leading-none">{sticker.value || "?"}</span>
                                            : sticker.url
                                                ? <img src={sticker.url} alt="" className="w-6 h-6 object-contain" />
                                                : <span className="text-[9px] text-[#333]">—</span>
                                        }
                                    </div>

                                    <select
                                        value={sticker.type}
                                        onChange={e => updateSticker(pack.id, sticker.id, { type: e.target.value as "emoji" | "image" | "lottie" })}
                                        className="bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white w-24 rounded-sm flex-shrink-0"
                                    >
                                        <option value="emoji">Emoji</option>
                                        <option value="image">Image</option>
                                        <option value="lottie">Lottie</option>
                                    </select>

                                    {sticker.type === "emoji" ? (
                                        <input
                                            value={sticker.value || ""}
                                            onChange={e => updateSticker(pack.id, sticker.id, { value: e.target.value })}
                                            placeholder="🔥"
                                            className="w-16 bg-black border border-[#2a2a2a] px-2 py-1 text-xl text-center text-white rounded-sm focus:border-[#99CCCC] outline-none"
                                        />
                                    ) : sticker.type === "image" ? (
                                        <div className="flex flex-1 gap-2 items-center min-w-0">
                                            <input
                                                value={sticker.url || ""}
                                                onChange={e => updateSticker(pack.id, sticker.id, { url: e.target.value })}
                                                placeholder="https://... or upload →"
                                                className="flex-1 min-w-0 bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white rounded-sm focus:border-[#99CCCC] outline-none"
                                            />
                                            <label className={`flex-shrink-0 px-2 py-1 text-[10px] border rounded-sm cursor-pointer transition ${
                                                uploading === sticker.id
                                                    ? "border-[#2a2a2a] text-[#444] cursor-not-allowed"
                                                    : "border-[#2a2a2a] text-[#9ca3af] hover:border-[#99CCCC] hover:text-[#99CCCC]"
                                            }`}>
                                                {uploading === sticker.id ? "Uploading…" : "Upload"}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/gif,image/webp,image/jpeg"
                                                    className="hidden"
                                                    disabled={uploading === sticker.id}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0]
                                                        if (file) uploadImage(pack.id, sticker.id, file)
                                                        e.target.value = ""
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    ) : (
                                        <input
                                            value={sticker.url || ""}
                                            onChange={e => updateSticker(pack.id, sticker.id, { url: e.target.value })}
                                            placeholder="https://...lottie.json"
                                            className="flex-1 bg-black border border-[#2a2a2a] px-2 py-1 text-xs text-white rounded-sm focus:border-[#99CCCC] outline-none"
                                        />
                                    )}

                                    <button
                                        onClick={() => removeSticker(pack.id, sticker.id)}
                                        className="text-[10px] text-red-500 hover:text-red-400 flex-shrink-0 px-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => addSticker(pack.id)}
                            className="text-[10px] border border-[#2a2a2a] px-3 py-1 text-[#737373] hover:text-white rounded-sm transition"
                        >
                            + Add Sticker
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
