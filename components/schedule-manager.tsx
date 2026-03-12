"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
    Trash2, Plus, Save, Music, Play, Pause,
    Upload, X, Search, RefreshCw, Radio,
    Users, ChevronLeft, ChevronRight, Loader2, Clock,
    ZoomIn, ZoomOut
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
    date: string       // YYYY-MM-DD (start date)
    time: string       // HH:MM:SS (start time)
    end_time: string   // HH:MM:SS (end time on end_date)
    end_date?: string  // YYYY-MM-DD (end date, defaults to date if absent)
    file: string       // bare filename
}

interface AudioFile {
    name: string
    url: string
    size: number
    mtime: string
}

interface IcecastStatus {
    online: boolean
    listeners: number
    title: string
    mountpoint: string
    bitrate: number
}

interface Artist {
    id: number
    name: string
    show: string
    image: string
    startTime: string  // ISO UTC string
    endTime: string    // ISO UTC string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_PX = 64
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const basename = (f: string) => f.split("/").pop() ?? f

// Build "YYYY-MM-DD" from a Date using LOCAL timezone components
function toDateStr(d: Date) {
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${day}`
}

// Build "HH:MM:SS" from a Date using LOCAL timezone components
function toTimeStr(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// Convert local date+time string → UTC date+time (for CSV storage)
function localDtToUtc(date: string, time: string): { date: string; time: string } {
    if (!date || !time) return { date, time }
    const dt = new Date(`${date}T${time}`)
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dt.getUTCDate()).padStart(2, '0')
    const h = String(dt.getUTCHours()).padStart(2, '0')
    const min = String(dt.getUTCMinutes()).padStart(2, '0')
    const s = String(dt.getUTCSeconds()).padStart(2, '0')
    return { date: `${y}-${m}-${d}`, time: `${h}:${min}:${s}` }
}

// Convert UTC date+time (from CSV) → local date+time (for UI display)
function utcDtToLocal(date: string, time: string): { date: string; time: string } {
    if (!date || !time) return { date, time }
    const dt = new Date(`${date}T${time}Z`)
    return { date: toDateStr(dt), time: toTimeStr(dt) }
}

// Convert a full ScheduleEntry from UTC storage → local display
function entryUtcToLocal(e: ScheduleEntry): ScheduleEntry {
    const start = utcDtToLocal(e.date, e.time)
    const endDate = e.end_date || e.date
    const end = e.end_time ? utcDtToLocal(endDate, e.end_time) : { date: endDate, time: '' }
    return { ...e, date: start.date, time: start.time, end_time: end.time, end_date: end.date }
}

// Convert a full ScheduleEntry from local display → UTC storage
function entryLocalToUtc(e: ScheduleEntry): ScheduleEntry {
    const start = localDtToUtc(e.date, e.time)
    const endDate = e.end_date || e.date
    const end = e.end_time ? localDtToUtc(endDate, e.end_time) : { date: '', time: '' }
    return { ...e, date: start.date, time: start.time, end_time: end.time, end_date: end.date }
}

function addDays(d: Date, n: number) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function getWeekStart(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00")
    d.setDate(d.getDate() - d.getDay())
    return d
}

function getMonthGrid(dateStr: string): Array<string | null> {
    const d = new Date(dateStr + "T12:00:00")
    const y = d.getFullYear(), mo = d.getMonth()
    const first = new Date(y, mo, 1)
    const last = new Date(y, mo + 1, 0)
    const cells: Array<string | null> = Array(first.getDay()).fill(null)
    for (let i = 1; i <= last.getDate(); i++) cells.push(toDateStr(new Date(y, mo, i)))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
}

function secsToHMS(secs: number) {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0")
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0")
    const s = String(secs % 60).padStart(2, "0")
    return `${h}:${m}:${s}`
}

function hmsToSecs(hms: string) {
    const [h, m, s] = (hms || "0:0:0").split(":").map(Number)
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
}

function nowHMS() { return new Date().toTimeString().slice(0, 8) }

function nextFreeSlot(entries: ScheduleEntry[], date: string) {
    const day = entries.filter(e => e.date === date).sort((a, b) => a.time.localeCompare(b.time))
    if (!day.length) return "00:00:00"
    return day[day.length - 1].end_time || day[day.length - 1].time
}

function findActiveEntry(schedule: ScheduleEntry[]): ScheduleEntry | null {
    const today = toDateStr(new Date())
    const hms = nowHMS()
    return schedule.find(e => {
        const endDate = e.end_date || e.date
        const endTime = e.end_time || "24:00:00"
        const startBeforeNow = e.date < today || (e.date === today && e.time <= hms)
        const endAfterNow = endDate > today || (endDate === today && endTime > hms)
        return startBeforeNow && endAfterNow
    }) ?? null
}

// Pixel segment an entry occupies within a single column day
interface Segment { top: number; height: number }

function getEntrySegment(entry: ScheduleEntry, day: string): Segment | null {
    const startDate = entry.date
    const endDate = entry.end_date || entry.date
    if (day < startDate || day > endDate) return null

    const isStartDay = day === startDate
    const isEndDay = day === endDate

    let startSecs = isStartDay ? hmsToSecs(entry.time) : 0
    let endSecs: number
    if (isEndDay) {
        endSecs = entry.end_time
            ? hmsToSecs(entry.end_time)
            : (isStartDay ? hmsToSecs(entry.time) + 3600 : 24 * 3600)
    } else {
        endSecs = 24 * 3600
    }
    // Same-day entry with end before start → show 1h minimum
    if (isStartDay && isEndDay && endSecs <= startSecs) endSecs = startSecs + 3600

    return {
        top: startSecs / 3600 * HOUR_PX,
        height: Math.max(24, (endSecs - startSecs) / 3600 * HOUR_PX)
    }
}

function getArtistSegment(artist: Artist, day: string): Segment | null {
    if (!artist.startTime || !artist.endTime) return null
    const start = new Date(artist.startTime)
    const end = new Date(artist.endTime)
    const startDate = toDateStr(start)
    const endDate = toDateStr(end)

    if (day < startDate || day > endDate) return null

    const isStartDay = day === startDate
    const isEndDay = day === endDate

    // Use local hours for positioning (consistent with timeline hour labels)
    const startSecs = isStartDay ? (start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds()) : 0
    const endSecs = isEndDay ? (end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds()) : 24 * 3600

    return {
        top: startSecs / 3600 * HOUR_PX,
        height: Math.max(24, (endSecs - startSecs) / 3600 * HOUR_PX)
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleManager() {
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [mediaFiles, setMediaFiles] = useState<AudioFile[]>([])
    const [artists, setArtists] = useState<Artist[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [icecast, setIcecast] = useState<IcecastStatus | null>(null)
    const [nowEntry, setNowEntry] = useState<ScheduleEntry | null>(null)

    const today = toDateStr(new Date())
    const [form, setForm] = useState<ScheduleEntry>({
        date: today, time: "00:00:00", end_time: "00:00:00", end_date: today, file: ""
    })
    const [editIndex, setEditIndex] = useState<number | null>(null)

    const [playingUrl, setPlayingUrl] = useState<string | null>(null)
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const uploadInputRef = useRef<HTMLInputElement | null>(null)

    // ── Fetch ──────────────────────────────────────────────────────────────

    const fetchSchedule = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch("/api/schedule")
            const d = await r.json()
            if (d.schedule) setSchedule(d.schedule.map(entryUtcToLocal))
        } catch { toast.error("Failed to load schedule") }
        finally { setLoading(false) }
    }, [])

    const fetchMedia = useCallback(async () => {
        try {
            const r = await fetch("/api/radio/media")
            const d = await r.json()
            if (d.files) setMediaFiles(d.files)
        } catch { }
    }, [])

    const fetchIcecast = useCallback(async () => {
        try {
            const r = await fetch("/api/radio/status")
            setIcecast(await r.json())
        } catch { }
    }, [])

    const fetchArtists = useCallback(async () => {
        try {
            const r = await fetch("/api/artists")
            const d = await r.json()
            if (Array.isArray(d)) setArtists(d)
        } catch { }
    }, [])

    useEffect(() => {
        fetchSchedule(); fetchMedia(); fetchIcecast(); fetchArtists()
        const iv = setInterval(fetchIcecast, 10_000)
        return () => clearInterval(iv)
    }, [fetchSchedule, fetchMedia, fetchIcecast, fetchArtists])

    // ── Reactive "now playing" ─────────────────────────────────────────────

    useEffect(() => {
        const update = () => setNowEntry(findActiveEntry(schedule))
        update()
        const iv = setInterval(update, 15_000)
        return () => clearInterval(iv)
    }, [schedule])

    // ── Init form ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!loading && editIndex === null) {
            const t = toDateStr(new Date())
            const slot = nextFreeSlot(schedule, t)
            setForm({ date: t, time: slot, end_time: slot, end_date: t, file: "" })
        }
    }, [loading]) // eslint-disable-line

    // ── Audio duration auto-detect ─────────────────────────────────────────

    const suggestEndTime = (filename: string, startTime: string) => {
        const f = mediaFiles.find(x => x.name === filename)
        if (!f) return
        const a = new Audio(f.url)
        a.addEventListener("loadedmetadata", () => {
            const totalSecs = hmsToSecs(startTime) + Math.ceil(a.duration)
            const overflowDays = Math.floor(totalSecs / 86400)
            setForm(prev => ({
                ...prev,
                end_time: secsToHMS(totalSecs % 86400),
                end_date: toDateStr(addDays(new Date(prev.date + "T12:00:00"), overflowDays))
            }))
        })
    }

    // ── Play preview ───────────────────────────────────────────────────────

    const togglePlay = (url: string) => {
        if (playingUrl === url) {
            audioRef.current?.pause(); setPlayingUrl(null)
        } else {
            setPlayingUrl(url)
            if (audioRef.current) { audioRef.current.src = url; audioRef.current.play() }
        }
    }

    // ── Save ───────────────────────────────────────────────────────────────

    const persist = async (entries: ScheduleEntry[]) => {
        setSaving(true)
        try {
            const r = await fetch("/api/schedule", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedule: entries.map(entryLocalToUtc) })
            })
            if (!r.ok) throw new Error()
            setSchedule(entries)
            toast.success("Schedule saved")
            reload()
        } catch { toast.error("Failed to save") }
        finally { setSaving(false) }
    }

    const reload = async () => {
        setSyncing(true)
        try {
            const r = await fetch("/api/radio/reload", { method: "POST" })
            if (r.ok) toast.success("Liquidsoap reloaded", { duration: 2000 })
            else toast.warning("Saved (engine offline)")
        } catch { toast.warning("Saved (engine offline)") }
        finally { setSyncing(false) }
    }

    const handleSubmit = () => {
        const entry: ScheduleEntry = {
            ...form,
            file: form.file || "SILENCE",
            end_date: form.end_date || form.date
        }
        const updated = editIndex !== null
            ? schedule.map((e, i) => i === editIndex ? entry : e)
            : [...schedule, entry]
        persist(updated)
        resetForm()
    }

    const resetForm = () => {
        const t = toDateStr(new Date())
        const slot = nextFreeSlot(schedule, t)
        setForm({ date: t, time: slot, end_time: slot, end_date: t, file: "" })
        setEditIndex(null)
    }

    const startEdit = (i: number) => {
        const entry = schedule[i]
        setEditIndex(i)
        setForm({ ...entry, end_date: entry.end_date || entry.date })
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const handleDelete = (i: number) => {
        if (!confirm("Delete this broadcast?")) return
        persist(schedule.filter((_, idx) => idx !== i))
    }

    const handleDeleteArtistFromSchedule = async (id: number) => {
        if (!confirm("Remove this artist from the schedule? (Their profile is not affected)")) return
        const updated = artists.map(a => a.id === id ? { ...a, startTime: "", endTime: "" } : a)
        try {
            const r = await fetch("/api/artists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artists: updated, newId: id })
            })
            if (r.ok) { setArtists(updated); toast.success("Artist removed from schedule") }
        } catch { toast.error("Failed to update") }
    }

    const handleSaveArtist = async (updated: Artist) => {
        const all = artists.map(a => a.id === updated.id ? updated : a)
        try {
            const r = await fetch("/api/artists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artists: all, newId: updated.id })
            })
            if (r.ok) {
                setArtists(all); setEditingArtist(null)
                toast.success("Artist schedule updated")
            } else {
                const d = await r.json()
                toast.error(d.error || "Failed to update")
            }
        } catch { toast.error("Failed to update") }
    }

    // ── Upload ─────────────────────────────────────────────────────────────

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        setUploading(true)
        const fd = new FormData(); fd.append("file", file)
        try {
            const r = await fetch("/api/radio/media", { method: "POST", body: fd })
            if (!r.ok) throw new Error()
            const d = await r.json()
            await fetchMedia()
            setForm(prev => ({ ...prev, file: d.name }))
            suggestEndTime(d.name, form.time)
            toast.success(`Uploaded: ${d.name}`)
        } catch { toast.error("Upload failed") }
        finally {
            setUploading(false)
            if (uploadInputRef.current) uploadInputRef.current.value = ""
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center p-20 text-[#444] font-mono text-[10px] uppercase tracking-widest">
            <Loader2 size={16} className="animate-spin mr-3" /> Synchronizing...
        </div>
    )

    return (
        <div className="space-y-4 max-w-[1800px] mx-auto">
            <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} hidden />
            <input ref={uploadInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />

            <NowPlayingBar icecast={icecast} nowEntry={nowEntry} syncing={syncing} onSync={reload} />

            {editingArtist && (
                <ArtistScheduleModal
                    artist={editingArtist}
                    onSave={handleSaveArtist}
                    onClose={() => setEditingArtist(null)}
                />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
                <ScheduleGrid
                    schedule={schedule} artists={artists}
                    nowEntry={nowEntry} onEdit={startEdit} onDelete={handleDelete}
                    onDeleteArtist={handleDeleteArtistFromSchedule}
                    onEditArtist={setEditingArtist}
                    onSyncArtist={handleSaveArtist}
                />
                <div className="space-y-4">
                    <BroadcastForm
                        form={form} setForm={setForm}
                        editIndex={editIndex} schedule={schedule}
                        mediaFiles={mediaFiles} playingUrl={playingUrl}
                        uploading={uploading} saving={saving}
                        onTogglePlay={togglePlay}
                        onUploadClick={() => uploadInputRef.current?.click()}
                        onSuggestEnd={suggestEndTime}
                        onSubmit={handleSubmit}
                        onReset={resetForm}
                    />
                    <AudioLibrary
                        files={mediaFiles} selectedFile={form.file} playingUrl={playingUrl}
                        onSelect={name => { setForm(p => ({ ...p, file: name })); suggestEndTime(name, form.time) }}
                        onPlay={togglePlay}
                        onDelete={async name => {
                            if (!confirm(`Delete ${name}?`)) return
                            await fetch("/api/radio/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: name }) })
                            fetchMedia()
                        }}
                        onUploadClick={() => uploadInputRef.current?.click()}
                    />
                </div>
            </div>

            <style jsx global>{`
                .rscroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .rscroll::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
            `}</style>
        </div>
    )
}

// ─── Now Playing Bar ──────────────────────────────────────────────────────────

function NowPlayingBar({ icecast, nowEntry, syncing, onSync }: {
    icecast: IcecastStatus | null
    nowEntry: ScheduleEntry | null
    syncing: boolean
    onSync: () => void
}) {
    const online = icecast?.online
    const trackTitle = icecast?.title || (nowEntry ? basename(nowEntry.file) : null)
    const timeRange = nowEntry ? `${nowEntry.time.slice(0, 8)} → ${(nowEntry.end_time || "?").slice(0, 8)}` : null

    return (
        <div className={`flex flex-wrap items-center gap-4 px-5 py-3 rounded-sm border text-[10px] font-mono uppercase tracking-widest transition-colors ${online ? "bg-[#050f05] border-[#0d2b0d]" : nowEntry ? "bg-[#0a0f0a] border-[#1a2a1a]" : "bg-[#080808] border-[#1a1a1a]"}`}>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse" : nowEntry ? "bg-[#99CCCC] shadow-[0_0_6px_#99CCCC] animate-pulse" : "bg-[#2a2a2a]"}`} />
                <Radio size={11} className={online ? "text-green-400" : nowEntry ? "text-[#99CCCC]" : "text-[#333]"} />
                <span className={online ? "text-green-400" : nowEntry ? "text-[#99CCCC]" : "text-[#3a3a3a]"}>
                    {online ? "LIVE" : nowEntry ? "SCHEDULED" : "OFFLINE"}
                </span>
                {icecast?.mountpoint && <span className="text-[#2a2a2a]">{icecast.mountpoint}</span>}
            </div>
            {trackTitle ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Music size={10} className="text-[#99CCCC] flex-shrink-0" />
                    <span className="text-[#99CCCC] truncate">{trackTitle}</span>
                    {timeRange && <span className="text-[#3a4a4a] flex-shrink-0 flex items-center gap-1"><Clock size={9} />{timeRange}</span>}
                </div>
            ) : (
                <span className="text-[#2a2a2a] flex-1">No active broadcast</span>
            )}
            <div className="flex items-center gap-4 ml-auto">
                {online && (
                    <div className="flex items-center gap-1.5 text-[#3a4a4a]">
                        <Users size={10} />
                        <span>{icecast!.listeners}</span>
                        {icecast!.bitrate > 0 && <span className="text-[#2a2a2a]">• {icecast!.bitrate}k</span>}
                    </div>
                )}
                <button onClick={onSync} disabled={syncing}
                    className="flex items-center gap-1.5 text-[#3a4a4a] hover:text-[#99CCCC] transition-colors disabled:opacity-30"
                    title="Clear state and skip to current schedule slot">
                    <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
                    APPLY NOW
                </button>
            </div>
        </div>
    )
}

// ─── Schedule Grid ────────────────────────────────────────────────────────────

function ScheduleGrid({ schedule, artists, nowEntry, onEdit, onDelete, onDeleteArtist, onEditArtist, onSyncArtist }: {
    schedule: ScheduleEntry[]
    artists: Artist[]
    nowEntry: ScheduleEntry | null
    onEdit: (i: number) => void
    onDelete: (i: number) => void
    onDeleteArtist: (id: number) => void
    onEditArtist: (artist: Artist) => void
    onSyncArtist: (artist: Artist) => void
}) {
    const today = toDateStr(new Date())
    const [anchor, setAnchor] = useState(today)
    const [mode, setMode] = useState<"week" | "month">("week")
    const [search, setSearch] = useState("")
    const [zoom, setZoom] = useState(1.0)
    const gridRef = useRef<HTMLDivElement>(null)
    const hourPx = HOUR_PX * zoom

    useEffect(() => {
        if (mode === "week" && gridRef.current) {
            gridRef.current.scrollTop = Math.max(0, new Date().getHours() * hourPx - 120)
        }
    }, [mode, hourPx])

    // Ctrl+scroll zoom
    useEffect(() => {
        const el = gridRef.current
        if (!el) return
        const handler = (e: WheelEvent) => {
            if (!e.ctrlKey) return
            e.preventDefault()
            setZoom(z => Math.max(0.25, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1))))
        }
        el.addEventListener("wheel", handler, { passive: false })
        return () => el.removeEventListener("wheel", handler)
    }, [])

    const navigate = (dir: 1 | -1) => {
        const d = new Date(anchor + "T12:00:00")
        if (mode === "week") d.setDate(d.getDate() + dir * 7)
        else d.setMonth(d.getMonth() + dir)
        setAnchor(toDateStr(d))
    }

    const weekStart = getWeekStart(anchor)
    const weekDays = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekStart, i)))
    const rangeLabel = mode === "week"
        ? `${weekDays[0]} — ${weekDays[6]}`
        : new Date(anchor + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase()

    return (
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden flex flex-col" style={{ minHeight: 600 }}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white border border-[#1a1a1a] rounded-sm transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => setAnchor(today)} className="text-[9px] font-black uppercase px-3 py-1.5 border border-[#1a1a1a] text-[#444] hover:text-white hover:border-[#333] transition-colors rounded-sm tracking-widest">
                        Today
                    </button>
                    <button onClick={() => navigate(1)} className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white border border-[#1a1a1a] rounded-sm transition-colors">
                        <ChevronRight size={14} />
                    </button>
                    <span className="text-white font-black text-sm uppercase tracking-tight ml-2">{rangeLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#333]" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search..."
                            className="bg-black border border-[#1a1a1a] pl-6 pr-2 py-1.5 text-[9px] font-mono text-white outline-none focus:border-[#99CCCC] w-32 transition-colors" />
                    </div>
                    <div className="flex items-center border border-[#1a1a1a] rounded-sm overflow-hidden">
                        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                            className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white transition-colors border-r border-[#1a1a1a]"
                            title="Zoom out (Ctrl+scroll)">
                            <ZoomOut size={12} />
                        </button>
                        <span className="text-[9px] font-mono text-[#444] px-2 select-none">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                            className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white transition-colors border-l border-[#1a1a1a]"
                            title="Zoom in (Ctrl+scroll)">
                            <ZoomIn size={12} />
                        </button>
                    </div>
                    <div className="flex border border-[#1a1a1a] overflow-hidden rounded-sm">
                        {(["week", "month"] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? "bg-[#99CCCC] text-black" : "text-[#444] hover:text-white"}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {mode === "week" && (
                    <motion.div key="week" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-hidden flex flex-col">
                        {/* Day headers */}
                        <div className="flex flex-shrink-0 border-b border-[#1a1a1a]">
                            <div className="w-14 flex-shrink-0" />
                            {weekDays.map((date, i) => {
                                const isToday = date === today
                                const dayNum = new Date(date + "T12:00:00").getDate()
                                return (
                                    <div key={date} className={`flex-1 text-center py-2.5 border-l border-[#111] ${isToday ? "border-b-2 border-b-[#99CCCC]" : ""}`}>
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${isToday ? "text-[#99CCCC]" : "text-[#333]"}`}>{DAY_LABELS[i]}</div>
                                        <div className={`text-sm font-black mt-0.5 ${isToday ? "text-white" : "text-[#2a2a2a]"}`}>{dayNum}</div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Scrollable time grid */}
                        <div ref={gridRef} className="flex-1 overflow-y-auto rscroll">
                            <TimeGrid
                                days={weekDays} today={today} schedule={schedule}
                                artists={artists} search={search}
                                nowEntry={nowEntry} onEdit={onEdit} onDelete={onDelete}
                                onDeleteArtist={onDeleteArtist} onEditArtist={onEditArtist}
                                onSyncArtist={onSyncArtist}
                                hourPx={hourPx}
                            />
                        </div>
                    </motion.div>
                )}

                {mode === "month" && (
                    <motion.div key="month" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto rscroll">
                        <MonthView
                            viewDate={anchor} schedule={schedule} today={today}
                            onDayClick={d => { setAnchor(d); setMode("week") }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Time Grid ────────────────────────────────────────────────────────────────

function TimeGrid({ days, today, schedule, artists, search, nowEntry, onEdit, onDelete, onDeleteArtist, onEditArtist, onSyncArtist, hourPx }: {
    days: string[]
    today: string
    schedule: ScheduleEntry[]
    artists: Artist[]
    search: string
    nowEntry: ScheduleEntry | null
    onEdit: (i: number) => void
    onDelete: (i: number) => void
    onDeleteArtist: (id: number) => void
    onEditArtist: (artist: Artist) => void
    onSyncArtist: (artist: Artist) => void
    hourPx: number
}) {
    const zoom = hourPx / HOUR_PX
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const nowH = new Date().getHours()
    const nowM = new Date().getMinutes()
    const nowTopPx = (nowH + nowM / 60) * hourPx
    const [dragOverArtistId, setDragOverArtistId] = useState<number | null>(null)

    return (
        <div className="flex" style={{ height: 24 * hourPx }}>
            {/* Time axis */}
            <div className="w-14 flex-shrink-0 relative select-none">
                {hours.map(h => (
                    <div key={h} style={{ height: hourPx, top: h * hourPx }}
                        className="absolute w-full flex items-start justify-end pr-2 pt-1">
                        <span className={`text-[9px] font-mono font-black ${h === nowH ? "text-[#99CCCC]" : "text-[#222]"}`}>
                            {String(h).padStart(2, "0")}:00
                        </span>
                    </div>
                ))}
            </div>

            {/* Day columns */}
            <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                {/* Hour lines */}
                <div className="absolute inset-0 pointer-events-none" style={{ gridColumn: `1 / ${days.length + 1}` }}>
                    {hours.map(h => (
                        <div key={h} className={`absolute w-full border-t ${h === 0 ? "border-[#222]" : "border-[#0e0e0e]"}`}
                            style={{ top: h * hourPx }} />
                    ))}
                    {hours.map(h => (
                        <div key={`h-${h}`} className="absolute w-full border-t border-[#080808]"
                            style={{ top: h * hourPx + hourPx / 2 }} />
                    ))}
                </div>

                {days.map(date => {
                    const isToday = date === today

                    // Multi-day aware: include entries that span this date
                    const colEntries = schedule.filter(e =>
                        basename(e.file).toLowerCase().includes(search.toLowerCase()) &&
                        date >= e.date && date <= (e.end_date || e.date)
                    )

                    // Artist cards for this column (UTC date comparison)
                    const colArtists = artists.filter(a => {
                        if (!a.startTime || !a.endTime) return false
                        const aStart = toDateStr(new Date(a.startTime))
                        const aEnd = toDateStr(new Date(a.endTime))
                        return date >= aStart && date <= aEnd
                    })

                    const hasArtists = colArtists.length > 0

                    return (
                        <div key={date} className="relative border-l border-[#111]">
                            {/* Current time line */}
                            {isToday && (
                                <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                                    style={{ top: nowTopPx }}>
                                    <div className="w-2 h-2 rounded-full bg-[#99CCCC] flex-shrink-0 -ml-1" />
                                    <div className="flex-1 h-px bg-[#99CCCC]/60" />
                                </div>
                            )}

                            {/* Audio entries (left half if artists present, full width otherwise) */}
                            {colEntries.map(entry => {
                                const idx = schedule.indexOf(entry)
                                const seg = getEntrySegment(entry, date)
                                if (!seg) return null
                                const scaledTop = seg.top * zoom
                                const scaledHeight = Math.max(seg.height * zoom, 24)
                                const isNow = nowEntry?.date === entry.date && nowEntry?.time === entry.time && nowEntry?.file === entry.file
                                const rightStyle = hasArtists ? "calc(50% + 1px)" : "3px"

                                return (
                                    <div
                                        key={`${entry.date}-${entry.time}-${entry.file}`}
                                        style={{ top: scaledTop, height: scaledHeight, position: "absolute", left: 3, right: rightStyle, zIndex: 10 }}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("application/schedule-entry", JSON.stringify({
                                                date: entry.date,
                                                time: entry.time,
                                                end_time: entry.end_time,
                                                end_date: entry.end_date || entry.date,
                                            }))
                                            e.dataTransfer.effectAllowed = "copy"
                                        }}
                                        onClick={() => onEdit(idx)}
                                        className={`rounded-sm px-1.5 py-1 cursor-grab active:cursor-grabbing overflow-hidden group transition-all border ${isNow
                                            ? "bg-[#99CCCC]/25 border-[#99CCCC]/50 shadow-[0_0_12px_rgba(153,204,204,0.2)]"
                                            : "bg-[#99CCCC]/10 border-[#99CCCC]/20 hover:bg-[#99CCCC] hover:border-[#99CCCC]"
                                        }`}
                                    >
                                        <div className={`text-[8px] font-mono font-bold leading-tight ${isNow ? "text-[#99CCCC]" : "text-[#99CCCC] group-hover:text-black"}`}>
                                            {entry.time.slice(0, 8)}
                                            {entry.end_time && <span className="opacity-70"> → {entry.end_time.slice(0, 8)}</span>}
                                            {entry.end_date && entry.end_date !== entry.date && (
                                                <span className="ml-1 opacity-60">+{entry.end_date.slice(5)}</span>
                                            )}
                                            {isNow && <span className="ml-1 animate-pulse">●</span>}
                                        </div>
                                        {scaledHeight > 30 && (
                                            <div className={`text-[9px] font-bold truncate leading-tight mt-0.5 ${isNow ? "text-white" : "text-white group-hover:text-black"}`}>
                                                {basename(entry.file).replace(/\.[^.]+$/, "")}
                                            </div>
                                        )}
                                        <button
                                            onClick={e => { e.stopPropagation(); onDelete(idx) }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-black/50 hover:text-black transition-all"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )
                            })}

                            {/* Artist cards (right half) */}
                            {colArtists.map(artist => {
                                const seg = getArtistSegment(artist, date)
                                if (!seg) return null
                                const scaledTop = seg.top * zoom
                                const scaledHeight = Math.max(seg.height * zoom, 24)
                                const localStart = new Date(artist.startTime).toTimeString().slice(0, 8)
                                const localEnd = new Date(artist.endTime).toTimeString().slice(0, 8)
                                const isDragTarget = dragOverArtistId === artist.id
                                return (
                                    <div
                                        key={`artist-${artist.id}-${date}`}
                                        style={{ top: scaledTop, height: scaledHeight, position: "absolute", left: "calc(50% + 1px)", right: 3, zIndex: 10 }}
                                        className={`rounded-sm px-1.5 py-1 overflow-hidden border cursor-pointer group transition-all ${isDragTarget ? "bg-[#99CCCC]/25 border-[#99CCCC] ring-1 ring-[#99CCCC]" : "bg-[#CC99CC]/10 border-[#CC99CC]/20 hover:bg-[#CC99CC]/20"}`}
                                        title={isDragTarget ? "Drop to sync timeslot" : `${artist.name} — ${artist.show}`}
                                        onClick={() => onEditArtist(artist)}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy" }}
                                        onDragEnter={(e) => { e.preventDefault(); setDragOverArtistId(artist.id) }}
                                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverArtistId(null) }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            setDragOverArtistId(null)
                                            const raw = e.dataTransfer.getData("application/schedule-entry")
                                            if (!raw) return
                                            const ed = JSON.parse(raw) as { date: string; time: string; end_time: string; end_date: string }
                                            const startISO = new Date(`${ed.date}T${ed.time}`).toISOString()
                                            const endISO = new Date(`${ed.end_date}T${ed.end_time}`).toISOString()
                                            onSyncArtist({ ...artist, startTime: startISO, endTime: endISO })
                                        }}
                                    >
                                        <div className="text-[8px] font-mono font-bold leading-tight text-[#CC99CC] truncate">
                                            {localStart}<span className="opacity-60"> → {localEnd}</span>
                                        </div>
                                        {scaledHeight > 30 && (
                                            <div className="text-[9px] font-bold truncate leading-tight mt-0.5 text-white">
                                                {artist.name}
                                            </div>
                                        )}
                                        {scaledHeight > 50 && (
                                            <div className="text-[8px] font-mono text-[#CC99CC]/60 truncate leading-tight">
                                                {artist.show}
                                            </div>
                                        )}
                                        <button
                                            onClick={e => { e.stopPropagation(); onDeleteArtist(artist.id) }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[#CC99CC]/50 hover:text-red-400 transition-all"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ viewDate, schedule, today, onDayClick }: {
    viewDate: string
    schedule: ScheduleEntry[]
    today: string
    onDayClick: (date: string) => void
}) {
    const cells = getMonthGrid(viewDate)

    return (
        <div>
            <div className="grid grid-cols-7 border-b border-[#111]">
                {DAY_LABELS.map(l => (
                    <div key={l} className="py-2 text-center text-[9px] font-black uppercase text-[#2a2a2a] tracking-widest">{l}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-[#0d0d0d]">
                {cells.map((date, i) => {
                    if (!date) return <div key={`e-${i}`} className="min-h-[80px] bg-[#040404]" />
                    const entries = schedule.filter(e => date >= e.date && date <= (e.end_date || e.date))
                    const isToday = date === today
                    return (
                        <button key={date} onClick={() => onDayClick(date)}
                            className={`min-h-[80px] p-2 text-left hover:bg-white/[0.02] transition-colors flex flex-col gap-1 group ${isToday ? "ring-1 ring-inset ring-[#99CCCC]/50" : ""}`}>
                            <span className={`text-[11px] font-black font-mono ${isToday ? "text-[#99CCCC]" : "text-[#2a2a2a] group-hover:text-[#555]"}`}>
                                {new Date(date + "T12:00:00").getDate()}
                            </span>
                            <div className="space-y-0.5 w-full">
                                {entries.slice(0, 3).map((e, ei) => (
                                    <div key={ei} className="bg-[#99CCCC]/15 border border-[#99CCCC]/10 rounded-sm px-1.5 py-0.5 text-[7px] font-mono text-[#99CCCC] truncate">
                                        {e.time.slice(0, 5)} {basename(e.file).replace(/\.[^.]+$/, "").slice(0, 12)}
                                    </div>
                                ))}
                                {entries.length > 3 && <div className="text-[7px] font-mono text-[#333] pl-1">+{entries.length - 3}</div>}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Broadcast Form ───────────────────────────────────────────────────────────

function BroadcastForm({ form, setForm, editIndex, schedule, mediaFiles, playingUrl,
    uploading, saving, onTogglePlay, onUploadClick, onSuggestEnd, onSubmit, onReset }: {
        form: ScheduleEntry; setForm: React.Dispatch<React.SetStateAction<ScheduleEntry>>
        editIndex: number | null; schedule: ScheduleEntry[]; mediaFiles: AudioFile[]
        playingUrl: string | null; uploading: boolean; saving: boolean
        onTogglePlay: (url: string) => void; onUploadClick: () => void
        onSuggestEnd: (f: string, t: string) => void; onSubmit: () => void; onReset: () => void
    }) {
    const isEdit = editIndex !== null
    const selectedFile = mediaFiles.find(f => f.name === form.file)
    const endDate = form.end_date || form.date

    const changeDate = (date: string) => {
        const slot = nextFreeSlot(schedule, date)
        setForm(prev => ({ ...prev, date, time: slot, end_time: slot, end_date: prev.end_date || date }))
    }
    const changeTime = (time: string) => {
        setForm(prev => ({ ...prev, time }))
        if (form.file) onSuggestEnd(form.file, time)
    }
    const changeFile = (name: string) => {
        setForm(prev => ({ ...prev, file: name }))
        if (name) onSuggestEnd(name, form.time)
    }

    return (
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div>
                    <h3 className="text-white font-black text-sm uppercase tracking-tight">{isEdit ? "Edit Broadcast" : "New Broadcast"}</h3>
                    <p className="text-[9px] font-mono uppercase text-[#333] tracking-widest mt-0.5">{isEdit ? "Modify entry" : "Add to schedule"}</p>
                </div>
                {isEdit && <button onClick={onReset} className="text-[#444] hover:text-white transition-colors"><X size={16} /></button>}
            </div>
            <div className="p-5 space-y-4">

                {/* Start: date + time */}
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-[#99CCCC] tracking-[0.2em] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#99CCCC]" /> Start
                    </label>
                    <div className="flex gap-2 items-center flex-wrap">
                        <input type="date" value={form.date} onChange={e => changeDate(e.target.value)}
                            className="flex-1 min-w-[130px] bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#99CCCC] transition-colors rounded-sm" />
                        <TimeInput value={form.time} onChange={changeTime} />
                    </div>
                </div>

                {/* End: date + time */}
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-[#FF6347] tracking-[0.2em] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6347]" /> End <span className="text-[#333] font-normal normal-case">auto</span>
                    </label>
                    <div className="flex gap-2 items-center flex-wrap">
                        <input type="date" value={endDate} onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                            className="flex-1 min-w-[130px] bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#FF6347] transition-colors rounded-sm" />
                        <TimeInput value={form.end_time} onChange={v => setForm(prev => ({ ...prev, end_time: v }))} />
                    </div>
                </div>

                {/* Audio */}
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-[#444] tracking-[0.2em] flex items-center gap-1.5"><Music size={10} /> Audio</label>
                    <div className="flex gap-2">
                        <select value={form.file} onChange={e => changeFile(e.target.value)}
                            className="flex-1 bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#99CCCC] transition-colors appearance-none rounded-sm min-w-0">
                            <option value="">— select from library —</option>
                            {mediaFiles.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                        </select>
                        {selectedFile && (
                            <button onClick={() => onTogglePlay(selectedFile.url)}
                                className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-sm transition-all ${playingUrl === selectedFile.url ? "bg-red-500/20 text-red-400" : "bg-[#1a1a1a] text-[#99CCCC] hover:bg-[#99CCCC] hover:text-black"}`}>
                                {playingUrl === selectedFile.url ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                        )}
                        <button onClick={onUploadClick} disabled={uploading}
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-sm bg-[#1a1a1a] text-[#444] hover:text-[#99CCCC] border border-[#222] transition-all disabled:opacity-40"
                            title="Upload audio">
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        </button>
                    </div>
                    {selectedFile && (
                        <div className="text-[9px] font-mono text-[#333] px-1">
                            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB · {new Date(selectedFile.mtime).toLocaleDateString()}
                        </div>
                    )}
                </div>

                <button onClick={onSubmit} disabled={saving}
                    className="w-full bg-[#99CCCC] text-black text-[11px] font-black uppercase tracking-widest py-3.5 rounded-sm hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                        : isEdit ? <><Save size={14} /> Update</> : <><Plus size={14} /> Deploy to Schedule</>}
                </button>
            </div>
        </div>
    )
}

// ─── Audio Library ────────────────────────────────────────────────────────────

function AudioLibrary({ files, selectedFile, playingUrl, onSelect, onPlay, onDelete, onUploadClick }: {
    files: AudioFile[]; selectedFile: string; playingUrl: string | null
    onSelect: (n: string) => void; onPlay: (u: string) => void
    onDelete: (n: string) => void; onUploadClick: () => void
}) {
    const [search, setSearch] = useState("")
    const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                <span className="text-[9px] font-black uppercase text-[#444] tracking-[0.2em]">Audio Library</span>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#333]" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search..."
                            className="bg-black border border-[#1a1a1a] pl-6 pr-2 py-1 text-[9px] font-mono text-white outline-none focus:border-[#99CCCC] w-28 transition-colors" />
                    </div>
                    <button onClick={onUploadClick}
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-[#444] hover:text-[#99CCCC] px-2 py-1 border border-[#1a1a1a] hover:border-[#99CCCC] transition-colors">
                        <Upload size={10} /> Upload
                    </button>
                </div>
            </div>
            <div className="max-h-60 overflow-y-auto rscroll">
                {filtered.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[9px] font-mono uppercase text-[#2a2a2a] tracking-widest">
                        {files.length === 0 ? "No audio files. Upload one." : "No matches."}
                    </div>
                ) : filtered.map(f => (
                    <div key={f.name} onClick={() => onSelect(f.name)}
                        className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer border-b border-[#0d0d0d] hover:bg-white/[0.02] transition-colors group ${selectedFile === f.name ? "bg-[#99CCCC]/5" : ""}`}>
                        <button onClick={e => { e.stopPropagation(); onPlay(f.url) }}
                            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm transition-all ${playingUrl === f.url ? "bg-red-500/20 text-red-400" : "bg-[#111] text-[#444] hover:text-[#99CCCC]"}`}>
                            {playingUrl === f.url ? <Pause size={11} /> : <Play size={11} />}
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-bold truncate ${selectedFile === f.name ? "text-[#99CCCC]" : "text-[#888]"}`}>{f.name}</div>
                            <div className="text-[8px] font-mono text-[#2a2a2a]">{(f.size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                        {selectedFile === f.name && <span className="text-[8px] font-black uppercase text-[#99CCCC] flex-shrink-0">✓</span>}
                        <button onClick={e => { e.stopPropagation(); onDelete(f.name) }}
                            className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-red-500 transition-all flex-shrink-0">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Artist Schedule Modal ────────────────────────────────────────────────────

function ArtistScheduleModal({ artist, onSave, onClose }: {
    artist: Artist
    onSave: (a: Artist) => void
    onClose: () => void
}) {
    function isoToLocalDt(iso: string) {
        if (!iso) return ""
        const d = new Date(iso)
        const y = d.getFullYear()
        const mo = String(d.getMonth() + 1).padStart(2, "0")
        const da = String(d.getDate()).padStart(2, "0")
        const h = String(d.getHours()).padStart(2, "0")
        const mi = String(d.getMinutes()).padStart(2, "0")
        const s = String(d.getSeconds()).padStart(2, "0")
        return `${y}-${mo}-${da}T${h}:${mi}:${s}`
    }

    const [start, setStart] = useState(isoToLocalDt(artist.startTime))
    const [end, setEnd] = useState(isoToLocalDt(artist.endTime))

    const handleSave = () => {
        onSave({
            ...artist,
            startTime: start ? new Date(start).toISOString() : "",
            endTime: end ? new Date(end).toISOString() : ""
        })
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-tight">{artist.name}</h3>
                        <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest mt-0.5">{artist.show}</p>
                    </div>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-[#99CCCC] tracking-[0.2em] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#99CCCC]" /> Start
                        </label>
                        <input type="datetime-local" step="1" value={start} onChange={e => setStart(e.target.value)}
                            className="w-full bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#99CCCC] transition-colors rounded-sm" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-[#FF6347] tracking-[0.2em] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6347]" /> End
                        </label>
                        <input type="datetime-local" step="1" value={end} onChange={e => setEnd(e.target.value)}
                            className="w-full bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#FF6347] transition-colors rounded-sm" />
                    </div>
                </div>
                <button onClick={handleSave}
                    className="w-full bg-[#99CCCC] text-black text-[11px] font-black uppercase tracking-widest py-3 rounded-sm hover:bg-white transition-all flex items-center justify-center gap-2">
                    <Save size={13} /> Save Schedule
                </button>
            </div>
        </div>
    )
}

// ─── Time Input ───────────────────────────────────────────────────────────────

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const parts = (value || "00:00:00").split(":")
    const h = parts[0] || "00", m = parts[1] || "00", s = parts[2] || "00"
    const upd = (i: number, v: string) => {
        const p = [h, m, s]
        p[i] = String(Math.max(0, Math.min(i === 0 ? 23 : 59, parseInt(v) || 0))).padStart(2, "0")
        onChange(p.join(":"))
    }
    const cls = "w-11 bg-black border border-[#1a1a1a] py-2 text-center text-xs text-white font-mono outline-none focus:border-[#99CCCC] transition-colors rounded-sm"
    return (
        <div className="flex items-center gap-1 flex-shrink-0">
            <input type="number" min={0} max={23} value={h} onChange={e => upd(0, e.target.value)} className={cls} />
            <span className="text-[#222] font-black">:</span>
            <input type="number" min={0} max={59} value={m} onChange={e => upd(1, e.target.value)} className={cls} />
            <span className="text-[#222] font-black">:</span>
            <input type="number" min={0} max={59} value={s} onChange={e => upd(2, e.target.value)} className={cls} />
        </div>
    )
}
