"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Star, Clock, Users, BarChart2, ChevronDown, ChevronUp, Radio } from "lucide-react"

interface ArtistStat {
    id: string
    name: string
    show: string
    image: string
    location: string
    bookmarks: number
    slots: number
    listeningTimeMs: number
    uniqueListeners: number
    rating: number
}

type SortKey = "rating" | "bookmarks" | "listeningTimeMs" | "uniqueListeners"

function fmtDuration(ms: number) {
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m`
    return `${totalSec}s`
}

export function ArtistAnalytics() {
    const [data, setData] = useState<ArtistStat[]>([])
    const [loading, setLoading] = useState(true)
    const [sortKey, setSortKey] = useState<SortKey>("rating")
    const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")

    useEffect(() => {
        const load = () => {
            fetch("/api/analytics/artist-stats")
                .then(r => r.json())
                .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
                .catch(() => setLoading(false))
        }
        load()
        const iv = setInterval(load, 30_000)
        return () => clearInterval(iv)
    }, [])

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === "desc" ? "asc" : "desc")
        } else {
            setSortKey(key)
            setSortDir("desc")
        }
    }

    const sorted = [...data].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey]
        return sortDir === "desc" ? -diff : diff
    })

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ChevronDown size={10} className="text-[#333]" />
        return sortDir === "desc"
            ? <ChevronDown size={10} className="text-[#99CCCC]" />
            : <ChevronUp size={10} className="text-[#99CCCC]" />
    }

    if (loading) return <div className="p-6 text-xs text-[#737373] font-mono">Loading artist analytics...</div>

    if (data.length === 0) return (
        <div className="p-6 text-center">
            <Radio size={32} className="text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-xs text-[#737373] font-mono">No artist data yet.</p>
            <p className="text-[10px] text-[#444] font-mono mt-1">Artists need to be linked via &quot;Sync All from Grid&quot; first.</p>
        </div>
    )

    const maxBookmarks = Math.max(...sorted.map(a => a.bookmarks), 1)
    const maxTime = Math.max(...sorted.map(a => a.listeningTimeMs), 1)

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-3">
                    <p className="text-[9px] text-[#444] uppercase font-mono tracking-widest mb-1">Artists</p>
                    <p className="text-2xl font-mono text-white">{data.length}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-3">
                    <p className="text-[9px] text-[#444] uppercase font-mono tracking-widest mb-1">Total Bookmarks</p>
                    <p className="text-2xl font-mono text-white">{data.reduce((s, a) => s + a.bookmarks, 0)}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-3">
                    <p className="text-[9px] text-[#444] uppercase font-mono tracking-widest mb-1">Total Listen Time</p>
                    <p className="text-2xl font-mono text-white">{fmtDuration(data.reduce((s, a) => s + a.listeningTimeMs, 0))}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-3">
                    <p className="text-[9px] text-[#444] uppercase font-mono tracking-widest mb-1">Scheduled Slots</p>
                    <p className="text-2xl font-mono text-white">{data.reduce((s, a) => s + a.slots, 0)}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#050505] border border-[#1a1a1a] rounded-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[32px_40px_1fr_80px_100px_90px_80px] gap-2 px-4 py-2 border-b border-[#1a1a1a] items-center">
                    <span className="text-[9px] text-[#333] font-mono uppercase">#</span>
                    <span></span>
                    <span className="text-[9px] text-[#444] font-mono uppercase tracking-widest">Artist</span>
                    <button onClick={() => handleSort("bookmarks")} className="flex items-center gap-1 text-[9px] text-[#444] font-mono uppercase tracking-widest hover:text-[#99CCCC] transition">
                        <Star size={9} /> ★ <SortIcon col="bookmarks" />
                    </button>
                    <button onClick={() => handleSort("listeningTimeMs")} className="flex items-center gap-1 text-[9px] text-[#444] font-mono uppercase tracking-widest hover:text-[#99CCCC] transition">
                        <Clock size={9} /> Time <SortIcon col="listeningTimeMs" />
                    </button>
                    <button onClick={() => handleSort("uniqueListeners")} className="flex items-center gap-1 text-[9px] text-[#444] font-mono uppercase tracking-widest hover:text-[#99CCCC] transition">
                        <Users size={9} /> Sess. <SortIcon col="uniqueListeners" />
                    </button>
                    <button onClick={() => handleSort("rating")} className="flex items-center gap-1 text-[9px] text-[#444] font-mono uppercase tracking-widest hover:text-[#99CCCC] transition">
                        <BarChart2 size={9} /> Rating <SortIcon col="rating" />
                    </button>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[#0f0f0f]">
                    {sorted.map((artist, idx) => {
                        const bPct = Math.round((artist.bookmarks / maxBookmarks) * 100)
                        const tPct = Math.round((artist.listeningTimeMs / maxTime) * 100)
                        const isTop3 = idx < 3
                        return (
                            <div
                                key={artist.id}
                                className={`grid grid-cols-[32px_40px_1fr_80px_100px_90px_80px] gap-2 px-4 py-2.5 items-center group hover:bg-[#0a0a0a] transition ${isTop3 ? "bg-[#0a0a0a]/50" : ""}`}
                            >
                                {/* Rank */}
                                <span className={`text-sm font-bold font-mono text-center ${idx === 0 ? "text-[#FFD700]" : idx === 1 ? "text-[#C0C0C0]" : idx === 2 ? "text-[#CD7F32]" : "text-[#333]"}`}>
                                    {idx + 1}
                                </span>

                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-sm overflow-hidden bg-[#111] relative flex-shrink-0">
                                    {artist.image
                                        ? <Image src={artist.image} alt={artist.name} fill className="object-cover" unoptimized />
                                        : <div className="w-full h-full flex items-center justify-center text-[8px] text-[#444] font-bold">{artist.name.slice(0, 2)}</div>
                                    }
                                </div>

                                {/* Name + show + ID */}
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{artist.name}</p>
                                    <p className="text-[9px] text-[#737373] truncate">{artist.show}</p>
                                    <p className="text-[8px] text-[#222] font-mono truncate group-hover:text-[#333] transition" title={artist.id}>{artist.id.slice(0, 8)}…</p>
                                </div>

                                {/* Bookmarks */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Star size={9} className="text-[#99CCCC] flex-shrink-0" />
                                        <span className="text-xs font-mono text-white">{artist.bookmarks}</span>
                                    </div>
                                    <div className="h-px bg-[#111] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#99CCCC]/50 transition-all" style={{ width: `${bPct}%` }} />
                                    </div>
                                </div>

                                {/* Listening time */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Clock size={9} className="text-[#99CCCC] flex-shrink-0" />
                                        <span className="text-xs font-mono text-white">{artist.listeningTimeMs > 0 ? fmtDuration(artist.listeningTimeMs) : "—"}</span>
                                    </div>
                                    <div className="h-px bg-[#111] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#99CCCC]/30 transition-all" style={{ width: `${tPct}%` }} />
                                    </div>
                                </div>

                                {/* Unique sessions */}
                                <div className="flex items-center gap-1.5">
                                    <Users size={9} className="text-[#737373] flex-shrink-0" />
                                    <span className="text-xs font-mono text-[#a3a3a3]">{artist.uniqueListeners}</span>
                                    {artist.slots > 0 && (
                                        <span className="text-[8px] font-mono text-[#333]">({artist.slots} slots)</span>
                                    )}
                                </div>

                                {/* Rating */}
                                <div className="text-right">
                                    <span className={`text-xs font-mono font-bold ${isTop3 ? "text-[#99CCCC]" : "text-[#555]"}`}>
                                        {artist.rating.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <p className="text-[9px] text-[#333] font-mono text-right">
                Rating = bookmarks×3 + sessions×2 + hours listened · auto-refreshes every 30s
            </p>
        </div>
    )
}
