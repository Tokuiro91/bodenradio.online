"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
    Trash2, Plus, Save, Music, Play, Pause,
    Upload, X, Edit2, Search, RefreshCw, Radio,
    Users, ChevronLeft, ChevronRight, Loader2, Clock
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
    date: string      // YYYY-MM-DD
    time: string      // HH:MM:SS
    end_time: string  // HH:MM:SS
    file: string      // bare filename
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

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_PX = 64          // pixels per hour in the grid
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const basename = (f: string) => f.split("/").pop() ?? f

function toDateStr(d: Date) { return d.toISOString().split("T")[0] }

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

function nowHMS() {
    return new Date().toTimeString().slice(0, 8)
}

// ─── Timezone Helpers (Local <-> UTC) ────────────────────────────────────────

function toUTC(dateStr: string, hms: string) {
    const d = new Date(`${dateStr}T${hms}`);
    if (isNaN(d.getTime())) return { date: dateStr, time: hms };
    const iso = d.toISOString(); // YYYY-MM-DDTHH:MM:SS.SSSZ
    return {
        date: iso.split('T')[0],
        time: iso.split('T')[1].slice(0, 8)
    };
}

function fromUTC(dateStr: string, hms: string) {
    const d = new Date(`${dateStr}T${hms}Z`);
    if (isNaN(d.getTime())) return { date: dateStr, time: hms };
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;
    const localTime = d.toTimeString().slice(0, 8);
    
    return { date: localDate, time: localTime };
}

function nextFreeSlot(entries: ScheduleEntry[], date: string) {
    const day = entries.filter(e => e.date === date).sort((a, b) => a.time.localeCompare(b.time))
    if (!day.length) return "00:00:00"
    return day[day.length - 1].end_time || day[day.length - 1].time
}

function findActiveEntry(schedule: ScheduleEntry[]): ScheduleEntry | null {
    const today = toDateStr(new Date())
    const hms = nowHMS()
    return schedule.find(e =>
        e.date === today &&
        e.time <= hms &&
        (e.end_time ? e.end_time > hms : true)
    ) ?? null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleManager() {
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [mediaFiles, setMediaFiles] = useState<AudioFile[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [icecast, setIcecast] = useState<IcecastStatus | null>(null)
    const [nowEntry, setNowEntry] = useState<ScheduleEntry | null>(null)

    const [form, setForm] = useState<ScheduleEntry>({
        date: toDateStr(new Date()),
        time: "00:00:00", end_time: "00:00:00", file: ""
    })
    const [editIndex, setEditIndex] = useState<number | null>(null)

    const [playingUrl, setPlayingUrl] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const uploadInputRef = useRef<HTMLInputElement | null>(null)

    // ── Fetch ──────────────────────────────────────────────────────────────

    const fetchSchedule = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch("/api/schedule")
            const d = await r.json()
            if (d.schedule) {
                // Convert stored UTC to Local for display
                const localSchedule = d.schedule.map((e: ScheduleEntry) => {
                    const startLoc = fromUTC(e.date, e.time);
                    const endLoc = e.end_time ? fromUTC(e.date, e.end_time) : { date: e.date, time: "" };
                    return {
                        ...e,
                        date: startLoc.date,
                        time: startLoc.time,
                        end_time: endLoc.time
                    };
                });
                setSchedule(localSchedule);
            }
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

    useEffect(() => {
        fetchSchedule(); fetchMedia(); fetchIcecast()
        const iv = setInterval(fetchIcecast, 10_000)
        return () => clearInterval(iv)
    }, [fetchSchedule, fetchMedia, fetchIcecast])

    // ── Reactive "now playing" from local schedule ─────────────────────────

    useEffect(() => {
        const update = () => setNowEntry(findActiveEntry(schedule))
        update()
        const iv = setInterval(update, 15_000)
        return () => clearInterval(iv)
    }, [schedule])

    // ── Init form ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!loading && editIndex === null) {
            const today = toDateStr(new Date())
            const slot = nextFreeSlot(schedule, today)
            setForm({ date: today, time: slot, end_time: slot, file: "" })
        }
    }, [loading]) // eslint-disable-line

    // ── Audio duration ──────────────────────────────────────────────────────

    const suggestEndTime = (filename: string, startTime: string) => {
        const f = mediaFiles.find(x => x.name === filename)
        if (!f) return
        const a = new Audio(f.url)
        a.addEventListener("loadedmetadata", () => {
            setForm(prev => ({ ...prev, end_time: secsToHMS(hmsToSecs(startTime) + Math.ceil(a.duration)) }))
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
                body: JSON.stringify({ schedule: entries })
            })
            if (!r.ok) throw new Error()
            // The persist call updates the local state with LOCAL times after successful save
            // But we already have the local times in the caller (handleSubmit)
            // To be safe, we can trigger a re-fetch or just update state with local entries
            setSchedule(entries.map(e => {
                const startLoc = fromUTC(e.date, e.time);
                const endLoc = e.end_time ? fromUTC(e.date, e.end_time) : { date: e.date, time: "" };
                return {
                    ...e,
                    date: startLoc.date,
                    time: startLoc.time,
                    end_time: endLoc.time
                };
            }));
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
        const entry = { ...form, file: form.file || "SILENCE" }
        const updatedLocal = editIndex !== null
            ? schedule.map((e, i) => i === editIndex ? entry : e)
            : [...schedule, entry]
            
        // Convert whole schedule to UTC for persistence
        const updatedUTC = updatedLocal.map(e => {
            const startUTC = toUTC(e.date, e.time);
            const endUTC = e.end_time ? toUTC(e.date, e.end_time) : { date: e.date, time: "" };
            return {
                ...e,
                date: startUTC.date,
                time: startUTC.time,
                end_time: endUTC.time
            };
        });

        persist(updatedUTC)
        resetForm()
    }

    const resetForm = () => {
        const today = toDateStr(new Date())
        setForm({ date: today, time: nextFreeSlot(schedule, today), end_time: nextFreeSlot(schedule, today), file: "" })
        setEditIndex(null)
    }

    const startEdit = (i: number) => {
        setEditIndex(i); setForm(schedule[i])
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const handleDelete = (i: number) => {
        if (!confirm("Delete this broadcast?")) return
        persist(schedule.filter((_, idx) => idx !== i))
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

            {/* NOW PLAYING */}
            <NowPlayingBar
                icecast={icecast}
                nowEntry={nowEntry}
                syncing={syncing}
                onSync={reload}
            />

            {/* MAIN LAYOUT */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

                {/* TIMELINE (left) */}
                <ScheduleGrid
                    schedule={schedule}
                    nowEntry={nowEntry}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                />

                {/* FORM + LIBRARY (right) */}
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
    // Priority: Icecast title > local schedule entry
    const trackTitle = icecast?.title || (nowEntry ? basename(nowEntry.file) : null)
    const timeRange = nowEntry ? `${nowEntry.time.slice(0, 5)} → ${(nowEntry.end_time || "?").slice(0, 5)}` : null

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
                    className="flex items-center gap-1.5 text-[#3a4a4a] hover:text-[#99CCCC] transition-colors disabled:opacity-30">
                    <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
                    SYNC ENGINE
                </button>
            </div>
        </div>
    )
}

// ─── Schedule Grid (Timeline with Y=time, X=days) ─────────────────────────────

function ScheduleGrid({ schedule, nowEntry, onEdit, onDelete }: {
    schedule: ScheduleEntry[]
    nowEntry: ScheduleEntry | null
    onEdit: (i: number) => void
    onDelete: (i: number) => void
}) {
    const today = toDateStr(new Date())
    const [anchor, setAnchor] = useState(today)  // any date in the current view
    const [mode, setMode] = useState<"week" | "month">("week")
    const [search, setSearch] = useState("")
    const gridRef = useRef<HTMLDivElement>(null)

    // scroll to current hour on mount / mode change
    useEffect(() => {
        if (mode === "week") {
            const h = new Date().getHours()
            if (gridRef.current) {
                gridRef.current.scrollTop = Math.max(0, h * HOUR_PX - 120)
            }
        }
    }, [mode])

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

            {/* Grid content */}
            <AnimatePresence mode="wait">
                {mode === "week" && (
                    <motion.div key="week" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-hidden flex flex-col">
                        {/* Day header row */}
                        <div className="flex flex-shrink-0 border-b border-[#1a1a1a]">
                            <div className="w-14 flex-shrink-0" /> {/* spacer for time axis */}
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
                                days={weekDays} today={today} schedule={schedule} search={search}
                                nowEntry={nowEntry} onEdit={onEdit} onDelete={onDelete}
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

// ─── Time Grid (the actual calendar with Y=hours, X=days) ─────────────────────

function TimeGrid({ days, today, schedule, search, nowEntry, onEdit, onDelete }: {
    days: string[]
    today: string
    schedule: ScheduleEntry[]
    search: string
    nowEntry: ScheduleEntry | null
    onEdit: (i: number) => void
    onDelete: (i: number) => void
}) {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const nowH = new Date().getHours()
    const nowM = new Date().getMinutes()
    const nowTopPx = (nowH + nowM / 60) * HOUR_PX

    // Convert HH:MM:SS → pixel offset from top of grid
    const hmsToY = (hms: string) => hmsToSecs(hms) / 3600 * HOUR_PX

    return (
        <div className="flex" style={{ height: 24 * HOUR_PX }}>

            {/* Time axis */}
            <div className="w-14 flex-shrink-0 relative select-none">
                {hours.map(h => (
                    <div key={h} style={{ height: HOUR_PX, top: h * HOUR_PX }}
                        className="absolute w-full flex items-start justify-end pr-2 pt-1">
                        <span className={`text-[9px] font-mono font-black ${h === nowH ? "text-[#99CCCC]" : "text-[#222]"}`}>
                            {String(h).padStart(2, "0")}:00
                        </span>
                    </div>
                ))}
            </div>

            {/* Day columns */}
            <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>

                {/* Hour lines (behind everything) */}
                <div className="absolute inset-0 pointer-events-none" style={{ gridColumn: `1 / ${days.length + 1}` }}>
                    {hours.map(h => (
                        <div key={h} className={`absolute w-full border-t ${h === 0 ? "border-[#222]" : "border-[#0e0e0e]"}`}
                            style={{ top: h * HOUR_PX }} />
                    ))}
                    {/* 30-min sub-lines */}
                    {hours.map(h => (
                        <div key={`h-${h}`} className="absolute w-full border-t border-[#080808]"
                            style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                    ))}
                </div>

                {days.map((date, col) => {
                    const isToday = date === today
                    const entries = schedule.filter(e =>
                        e.date === date &&
                        basename(e.file).toLowerCase().includes(search.toLowerCase())
                    )

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

                            {/* Events */}
                            {entries.map(entry => {
                                const idx = schedule.indexOf(entry)
                                const top = hmsToY(entry.time)
                                const endSecs = entry.end_time ? hmsToSecs(entry.end_time) : hmsToSecs(entry.time) + 3600
                                const rawH = (endSecs - hmsToSecs(entry.time)) / 3600 * HOUR_PX
                                const height = Math.max(rawH, 24) // min 24px so short entries are visible
                                const isNow = nowEntry?.date === entry.date && nowEntry?.time === entry.time && nowEntry?.file === entry.file

                                return (
                                    <div
                                        key={`${entry.time}-${entry.file}`}
                                        style={{ top, height, position: "absolute", left: 3, right: 3, zIndex: 10 }}
                                        onClick={() => onEdit(idx)}
                                        className={`rounded-sm px-1.5 py-1 cursor-pointer overflow-hidden group transition-all border ${isNow
                                            ? "bg-[#99CCCC]/25 border-[#99CCCC]/50 shadow-[0_0_12px_rgba(153,204,204,0.2)]"
                                            : "bg-[#99CCCC]/10 border-[#99CCCC]/20 hover:bg-[#99CCCC] hover:border-[#99CCCC]"
                                        }`}
                                    >
                                        <div className={`text-[8px] font-mono font-bold leading-tight ${isNow ? "text-[#99CCCC]" : "text-[#99CCCC] group-hover:text-black"}`}>
                                            {entry.time.slice(0, 5)}
                                            {isNow && <span className="ml-1 animate-pulse">●</span>}
                                        </div>
                                        {height > 30 && (
                                            <div className={`text-[9px] font-bold truncate leading-tight mt-0.5 ${isNow ? "text-white" : "text-white group-hover:text-black"}`}>
                                                {basename(entry.file).replace(/\.[^.]+$/, "")}
                                            </div>
                                        )}
                                        {/* Delete on hover */}
                                        <button
                                            onClick={e => { e.stopPropagation(); onDelete(idx) }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-black/50 hover:text-black transition-all"
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
                    const entries = schedule.filter(e => e.date === date)
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

    const changeDate = (date: string) => {
        const slot = nextFreeSlot(schedule, date)
        setForm(prev => ({ ...prev, date, time: slot, end_time: slot }))
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
                {/* Date */}
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-[#444] tracking-[0.2em]">Date</label>
                    <input type="date" value={form.date} onChange={e => changeDate(e.target.value)}
                        className="w-full bg-black border border-[#1a1a1a] px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#99CCCC] transition-colors rounded-sm" />
                </div>

                {/* Start / End */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-[#99CCCC] tracking-[0.2em] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#99CCCC]" /> Start
                        </label>
                        <TimeInput value={form.time} onChange={changeTime} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-[#FF6347] tracking-[0.2em] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6347]" /> End <span className="text-[#333] font-normal normal-case">auto</span>
                        </label>
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
        <div className="flex items-center gap-1">
            <input type="number" min={0} max={23} value={h} onChange={e => upd(0, e.target.value)} className={cls} />
            <span className="text-[#222] font-black">:</span>
            <input type="number" min={0} max={59} value={m} onChange={e => upd(1, e.target.value)} className={cls} />
            <span className="text-[#222] font-black">:</span>
            <input type="number" min={0} max={59} value={s} onChange={e => upd(2, e.target.value)} className={cls} />
        </div>
    )
}
