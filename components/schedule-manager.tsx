"use client"

import { useState, useEffect, useRef } from "react"
import { Trash2, Plus, Save, Clock, Calendar, Music, Play, Pause, Upload, X, Edit2, Search, Volume2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

interface ScheduleEntry {
    date: string
    time: string
    end_time: string
    file: string
}

interface AudioFile {
    name: string
    url: string
    size: number
    mtime: string
}

export function ScheduleManager() {
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [mediaFiles, setMediaFiles] = useState<AudioFile[]>([])
    const [bitrate, setBitrate] = useState<number>(192)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<"visual" | "list" | "library">("visual")
    const [isEditing, setIsEditing] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Form state
    const [form, setForm] = useState<ScheduleEntry>({
        date: new Date().toISOString().split("T")[0],
        time: "00:00:00",
        end_time: "00:00:00",
        file: ""
    })

    // Audio player state
    const [playingFile, setPlayingFile] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        fetchSchedule()
        fetchBitrate()
        fetchMedia()
    }, [])

    const fetchBitrate = async () => {
        try {
            const res = await fetch("/api/radio/bitrate")
            const data = await res.json()
            if (data.bitrate) setBitrate(data.bitrate)
        } catch (err) { }
    }

    const fetchSchedule = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/schedule")
            const data = await res.json()
            if (data.schedule) setSchedule(data.schedule)
        } catch (err) {
            toast.error("Failed to fetch schedule")
        } finally {
            setLoading(false)
        }
    }

    const fetchMedia = async () => {
        try {
            const res = await fetch("/api/radio/media")
            const data = await res.json()
            if (data.files) setMediaFiles(data.files)
        } catch (err) {
            toast.error("Failed to fetch media library")
        }
    }

    const saveSchedule = async (updatedSchedule: ScheduleEntry[]) => {
        try {
            const res = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedule: updatedSchedule })
            })
            if (res.ok) {
                toast.success("Schedule updated")
                fetchSchedule()
            }
        } catch (err) {
            toast.error("Failed to save schedule")
        }
    }

    const handleAddOrUpdateEntry = () => {
        // We allow empty file now, which means "SILENCE" or "FALLBACK TO ARTIST DB"
        const entryToSave = { ...form, file: form.file || "SILENCE" }

        let updated: ScheduleEntry[]
        if (isEditing !== null) {
            updated = [...schedule]
            updated[isEditing] = entryToSave
            setIsEditing(null)
        } else {
            updated = [...schedule, entryToSave]
        }

        setSchedule(updated)
        saveSchedule(updated)
        resetForm()
    }

    const findNextFreeSlot = (entries: ScheduleEntry[], date: string) => {
        const dayEntries = entries
            .filter(e => e.date === date)
            .sort((a, b) => a.time.localeCompare(b.time))

        if (dayEntries.length === 0) return "00:00:00"
        return dayEntries[dayEntries.length - 1].end_time || dayEntries[dayEntries.length - 1].time
    }

    const resetForm = () => {
        const nextTime = findNextFreeSlot(schedule, new Date().toISOString().split("T")[0])
        setForm({
            date: new Date().toISOString().split("T")[0],
            time: nextTime,
            end_time: nextTime,
            file: ""
        })
        setIsEditing(null)
    }

    const suggestDuration = async (filename: string) => {
        const file = mediaFiles.find(f => f.name === filename)
        if (!file) return

        try {
            const audio = new Audio(file.url)
            audio.addEventListener('loadedmetadata', () => {
                const durationSec = Math.ceil(audio.duration)
                const [h, m, s] = form.time.split(":").map(Number)
                const startSec = h * 3600 + m * 60 + s
                const endSecTotal = startSec + durationSec

                const eh = String(Math.floor(endSecTotal / 3600)).padStart(2, "0")
                const em = String(Math.floor((endSecTotal % 3600) / 60)).padStart(2, "0")
                const es = String(endSecTotal % 60).padStart(2, "0")

                setForm(prev => ({ ...prev, end_time: `${eh}:${em}:${es}` }))
            })
        } catch (err) { }
    }

    const handleDeleteEntry = (index: number) => {
        if (!confirm("Delete this entry?")) return
        const updated = schedule.filter((_, i) => i !== index)
        setSchedule(updated)
        saveSchedule(updated)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/radio/media", {
                method: "POST",
                body: formData
            })
            if (res.ok) {
                toast.success("File uploaded")
                fetchMedia()
            }
        } catch (err) {
            toast.error("Upload failed")
        }
    }

    const togglePlay = (url: string) => {
        if (playingFile === url) {
            audioRef.current?.pause()
            setPlayingFile(null)
        } else {
            setPlayingFile(url)
            if (audioRef.current) {
                audioRef.current.src = url
                audioRef.current.play()
            }
        }
    }

    const handleBitrateChange = async (newBitrate: number) => {
        try {
            setBitrate(newBitrate)
            await fetch("/api/radio/bitrate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bitrate: newBitrate })
            })
            toast.success(`Bitrate set to ${newBitrate}kbps`)
        } catch (err) { }
    }

    if (loading) return <div className="text-white font-mono text-[10px] uppercase p-8 animate-pulse text-center">Synchronizing Radio Engine...</div>

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <audio ref={audioRef} onEnded={() => setPlayingFile(null)} hidden />

            {/* Header & Bitrate */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-[#080808] border border-[#1a1a1a] p-5 rounded-sm gap-4">
                <div className="flex flex-col">
                    <h2 className="text-white font-black text-lg uppercase tracking-tighter">Radio Scheduler <span className="text-[#99CCCC] text-xs ml-2 font-mono">v2.0 PRECISE</span></h2>
                    <p className="text-[10px] text-[#444] font-mono uppercase tracking-widest">CSV-based second-precision broadcasting engine</p>
                </div>
                <div className="flex items-center gap-4 bg-black p-1.5 rounded-sm border border-[#111]">
                    <div className="px-2 text-[9px] font-black uppercase text-[#444]">Stream Quality</div>
                    <div className="flex gap-1">
                        {[192, 128].map(b => (
                            <button
                                key={b}
                                onClick={() => handleBitrateChange(b)}
                                className={`px-4 py-1.5 text-[10px] font-black rounded-sm transition-all ${bitrate === b ? "bg-[#99CCCC] text-black" : "text-[#555] hover:text-white"}`}
                            >
                                {b}K
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1a1a1a] gap-1 px-1">
                <TabButton active={activeTab === "visual"} onClick={() => setActiveTab("visual")} label="Timeline" />
                <TabButton active={activeTab === "list"} onClick={() => setActiveTab("list")} label="Schedule List" />
                <TabButton active={activeTab === "library"} onClick={() => setActiveTab("library")} label="Audio Library" />
            </div>

            <AnimatePresence mode="wait">
                {activeTab === "visual" && (
                    <motion.div key="visual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                        <TimelineView schedule={schedule} onEdit={(index) => {
                            setForm(schedule[index])
                            setIsEditing(index)
                            setActiveTab("list")
                        }} />
                    </motion.div>
                )}

                {activeTab === "list" && (
                    <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                        {/* Entry Form */}
                        <div className="bg-[#080808] border border-[#1a1a1a] p-6 rounded-sm">
                            <h3 className="text-[#99CCCC] font-mono text-xs uppercase mb-6 tracking-[0.2em]">{isEditing !== null ? "Edit Entry" : "Add New Broadcast"}</h3>

                            <div className="flex flex-col lg:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                        <div className="space-y-2">
                                            <label className="text-[9px] uppercase font-black text-[#444] tracking-widest">Date</label>
                                            <input
                                                type="date"
                                                value={form.date}
                                                onChange={(e) => {
                                                    const nextTime = findNextFreeSlot(schedule, e.target.value)
                                                    setForm({ ...form, date: e.target.value, time: nextTime, end_time: nextTime })
                                                }}
                                                className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] uppercase font-black text-[#444] tracking-widest">Audio File</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={form.file}
                                                    onChange={(e) => {
                                                        setForm({ ...form, file: e.target.value })
                                                        suggestDuration(e.target.value)
                                                    }}
                                                    className="flex-1 bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors appearance-none font-mono"
                                                >
                                                    <option value="">Select from library...</option>
                                                    {mediaFiles.map(f => (
                                                        <option key={f.name} value={f.name}>{f.name}</option>
                                                    ))}
                                                </select>
                                                {form.file && form.file !== "SILENCE" && (
                                                    <button onClick={() => togglePlay(mediaFiles.find(f => f.name === form.file)?.url || "")} className="p-2.5 bg-[#1a1a1a] text-[#99CCCC] rounded-sm hover:bg-[#99CCCC] hover:text-black transition-all">
                                                        {playingFile === mediaFiles.find(f => f.name === form.file)?.url ? <Pause size={14} /> : <Play size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3 p-4 bg-black/40 border border-[#111] rounded-sm">
                                            <label className="text-[9px] uppercase font-black text-[#99CCCC] tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#99CCCC]" /> Start Time
                                            </label>
                                            <TimeInput value={form.time} onChange={(val) => setForm({ ...form, time: val })} />
                                        </div>
                                        <div className="space-y-3 p-4 bg-black/40 border border-[#111] rounded-sm">
                                            <label className="text-[9px] uppercase font-black text-[#FF6347] tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6347]" /> End Time
                                            </label>
                                            <TimeInput value={form.end_time} onChange={(val) => setForm({ ...form, end_time: val })} />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={handleAddOrUpdateEntry}
                                            className="flex-1 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-sm hover:bg-white transition-all flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(153,204,204,0.15)]"
                                        >
                                            {isEditing !== null ? <Save size={16} /> : <Plus size={16} />}
                                            {isEditing !== null ? "Update Broadcast" : "Deploy to Schedule"}
                                        </button>
                                        {isEditing !== null && (
                                            <button onClick={resetForm} className="bg-[#1a1a1a] text-white px-6 py-4 rounded-sm hover:bg-white hover:text-black transition-all">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar Audio Palette */}
                                <div className="w-full lg:w-80 border-l border-[#1a1a1a] pl-0 lg:pl-8 mt-8 lg:mt-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[9px] font-black uppercase text-[#444] tracking-widest">Audio Palette</span>
                                        <Music size={12} className="text-[#222]" />
                                    </div>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                        {mediaFiles.map(f => (
                                            <div
                                                key={f.name}
                                                onClick={() => {
                                                    setForm(prev => ({ ...prev, file: f.name }))
                                                    suggestDuration(f.name)
                                                    toast.success(`Selected: ${f.name}`, { duration: 1000 })
                                                }}
                                                className={`p-3 rounded-sm border cursor-pointer transition-all flex flex-col gap-1 ${form.file === f.name ? "bg-[#99CCCC]/10 border-[#99CCCC]/30" : "bg-black border-[#111] hover:border-[#333]"}`}
                                            >
                                                <span className={`text-[10px] font-bold truncate ${form.file === f.name ? "text-[#99CCCC]" : "text-[#777]"}`}>{f.name}</span>
                                                <span className="text-[8px] text-[#333] font-mono">{(f.size / 1024 / 1024).toFixed(1)}MB • {new Date(f.mtime).toLocaleDateString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List Table */}
                        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-[#1a1a1a] flex justify-between items-center">
                                <div className="text-[10px] font-black uppercase text-[#444] tracking-widest">Broadcast History</div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" size={12} />
                                    <input
                                        placeholder="SEARCH..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="bg-black border border-[#1a1a1a] py-1.5 pl-8 pr-3 text-[10px] font-mono uppercase text-white outline-none focus:border-[#99CCCC] w-48"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-[#0c0c0c] uppercase font-mono text-[9px] text-[#555] z-10">
                                        <tr>
                                            <th className="px-6 py-4 border-b border-[#1a1a1a]">Date</th>
                                            <th className="px-6 py-4 border-b border-[#1a1a1a]">Time</th>
                                            <th className="px-6 py-4 border-b border-[#1a1a1a]">Audio File</th>
                                            <th className="px-6 py-4 border-b border-[#1a1a1a] text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-white">
                                        {schedule.filter(s => s.file.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-[#333] italic font-mono text-[10px] uppercase tracking-widest">Void space. No scheduled sounds.</td>
                                            </tr>
                                        ) : (
                                            schedule
                                                .filter(s => s.file.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
                                                .map((entry, index) => (
                                                    <tr key={index} className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-6 py-4 text-[#777] font-mono group-hover:text-white transition-colors">{entry.date}</td>
                                                        <td className="px-6 py-4 font-mono font-bold text-[#99CCCC]">{entry.time}</td>
                                                        <td className="px-6 py-4 text-[#737373] group-hover:text-white transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <Music size={12} className="text-[#333]" />
                                                                {entry.file}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                                                                <button onClick={() => {
                                                                    setForm(entry)
                                                                    setIsEditing(schedule.indexOf(entry))
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                                                }} className="text-[#444] hover:text-[#99CCCC] transition-colors"><Edit2 size={14} /></button>
                                                                <button onClick={() => handleDeleteEntry(schedule.indexOf(entry))} className="text-[#444] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === "library" && (
                    <motion.div key="library" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                        <div className="bg-[#080808] border border-[#1a1a1a] p-6 rounded-sm">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex-1">
                                    <h3 className="text-[#99CCCC] font-mono text-xs uppercase mb-2 tracking-widest">Deploy Audio Assets</h3>
                                    <p className="text-[10px] text-[#444] uppercase font-mono tracking-tight leading-relaxed">Accepted formats: .mp3, .wav. Files are stored in /radio/mixes.<br />Max file size recommended: 500MB.</p>
                                </div>
                                <label className="bg-white text-black px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#99CCCC] transition-all cursor-pointer shadow-xl flex items-center gap-2">
                                    <Upload size={14} /> Upload Audio
                                    <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {mediaFiles.map(file => (
                                <div key={file.name} className="bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm hover:border-[#333] transition-all group relative overflow-hidden">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-sm flex items-center justify-center transition-all ${playingFile === file.url ? "bg-[#99CCCC] text-black" : "bg-black border border-[#1a1a1a] text-[#333]"}`}>
                                                {playingFile === file.url ? <Volume2 size={18} className="animate-pulse" /> : <Music size={18} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-white max-w-[150px] truncate">{file.name}</span>
                                                <span className="text-[9px] text-[#444] font-mono uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => togglePlay(file.url)}
                                            className={`p-2 rounded-full transition-all ${playingFile === file.url ? "bg-red-500/10 text-red-500" : "bg-[#99CCCC]/10 text-[#99CCCC] hover:bg-[#99CCCC] hover:text-black"}`}
                                        >
                                            {playingFile === file.url ? <Pause size={14} /> : <Play size={14} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] font-mono text-[#333] uppercase">
                                        <span>Uploaded: {new Date(file.mtime).toLocaleDateString()}</span>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete ${file.name}?`)) {
                                                    const res = await fetch("/api/radio/media", {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ filename: file.name })
                                                    })
                                                    if (res.ok) fetchMedia()
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all font-bold"
                                        >
                                            [ DELETE ]
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; }
      `}</style>
        </div>
    )
}

function TimeInput({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [h, m, s] = value.split(":")

    const update = (index: number, val: string) => {
        const parts = value.split(":")
        parts[index] = val.padStart(2, "0")
        onChange(parts.join(":"))
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type="number" min="0" max="23" placeholder="HH"
                value={h || "00"}
                onChange={(e) => update(0, e.target.value)}
                className="w-14 bg-black border border-[#1a1a1a] p-2 text-center text-xs text-white outline-none focus:border-[#99CCCC] font-mono rounded-sm"
            />
            <span className="text-[#333] font-mono">:</span>
            <input
                type="number" min="0" max="59" placeholder="MM"
                value={m || "00"}
                onChange={(e) => update(1, e.target.value)}
                className="w-14 bg-black border border-[#1a1a1a] p-2 text-center text-xs text-white outline-none focus:border-[#99CCCC] font-mono rounded-sm"
            />
            <span className="text-[#333] font-mono">:</span>
            <input
                type="number" min="0" max="59" placeholder="SS"
                value={s || "00"}
                onChange={(e) => update(2, e.target.value)}
                className="w-14 bg-black border border-[#1a1a1a] p-2 text-center text-xs text-white outline-none focus:border-[#99CCCC] font-mono rounded-sm"
            />
        </div>
    )
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-t-2 ${active ? "text-white border-[#99CCCC] bg-white/[0.02]" : "text-[#444] border-transparent hover:text-white hover:bg-white/[0.01]"}`}
        >
            {label}
        </button>
    )
}

function TimelineView({ schedule, onEdit }: { schedule: ScheduleEntry[], onEdit: (index: number) => void }) {
    const [viewDate, setViewDate] = useState(new Date().toISOString().split("T")[0])
    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day")

    const hours = Array.from({ length: 24 }, (_, i) => i)

    const getEntriesForDate = (date: string) => {
        return schedule.filter(s => s.date === date)
    }

    const navigate = (amount: number, unit: "day" | "week" | "month") => {
        const d = new Date(viewDate)
        if (unit === "day") d.setDate(d.getDate() + amount)
        if (unit === "week") d.setDate(d.getDate() + amount * 7)
        if (unit === "month") d.setMonth(d.getMonth() + amount)
        setViewDate(d.toISOString().split("T")[0])
    }

    return (
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div className="space-y-1">
                    <h3 className="text-[#99CCCC] font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} />
                        Visual Flow — {viewMode.toUpperCase()} VIEW
                    </h3>
                    <div className="flex items-center gap-4">
                        <span className="text-white font-black text-xl uppercase tracking-tighter">{viewDate}</span>
                        <div className="flex gap-1 overflow-hidden rounded-sm border border-[#111]">
                            <button onClick={() => navigate(-1, "day")} className="px-3 py-1 bg-black text-[#444] hover:text-white transition-all text-[10px] font-mono">{"<"}</button>
                            <button onClick={() => setViewDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 bg-black text-[#444] hover:text-white transition-all text-[10px] font-mono uppercase">Today</button>
                            <button onClick={() => navigate(1, "day")} className="px-3 py-1 bg-black text-[#444] hover:text-white transition-all text-[10px] font-mono">{">"}</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className="flex gap-1 bg-black p-1 rounded-sm border border-[#111]">
                        {(["day", "week", "month"] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setViewMode(m)}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-sm transition-all ${viewMode === m ? "bg-[#99CCCC] text-black" : "text-[#444] hover:text-white"}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#99CCCC]"></div>
                            <span className="text-[9px] text-[#444] uppercase font-mono">BROADCAST</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#111] border border-[#222]"></div>
                            <span className="text-[9px] text-[#444] uppercase font-mono">SILENCE</span>
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === "day" && (
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                    {hours.map(hour => {
                        const dateEntries = getEntriesForDate(viewDate)
                        const entries = dateEntries.filter(s => parseInt(s.time.split(":")[0]) === hour)
                        return (
                            <div key={hour} className="flex gap-6 group">
                                <div className="w-12 text-right py-2">
                                    <span className="text-[11px] font-mono font-black text-[#222] group-hover:text-[#99CCCC] transition-colors">{String(hour).padStart(2, "0")}:00</span>
                                </div>
                                <div className="flex-1 min-h-[40px] relative border-l border-[#1a1a1a] pl-4 py-1 flex flex-col gap-2">
                                    {entries.length === 0 ? (
                                        <div className="h-full border border-dashed border-[#111] rounded-sm flex items-center px-4 opacity-10">
                                            <span className="text-[8px] font-mono uppercase text-[#222]">Void.</span>
                                        </div>
                                    ) : (
                                        entries.sort((a, b) => a.time.localeCompare(b.time)).map((entry) => (
                                            <div
                                                key={`${entry.time}-${entry.file}`}
                                                onClick={() => onEdit(schedule.indexOf(entry))}
                                                className="bg-[#99CCCC]/10 border border-[#99CCCC]/20 rounded-sm p-3 cursor-pointer hover:bg-[#99CCCC] hover:text-black transition-all group/item shadow-sm hover:translate-x-1 duration-300"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[10px] font-bold text-[#99CCCC] group-hover/item:text-black">{entry.time} — {entry.end_time || "??:??:??"}</span>
                                                            <span className="text-[10px] uppercase font-black tracking-tight group-hover/item:text-black mt-0.5">{entry.file}</span>
                                                        </div>
                                                    </div>
                                                    <Edit2 size={10} className="opacity-0 group-hover/item:opacity-100" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {(viewMode === "week" || viewMode === "month") && (
                <div className="min-h-[400px] flex items-center justify-center border border-dashed border-[#111] rounded-sm bg-black/40">
                    <div className="text-center space-y-3">
                        <Calendar className="mx-auto text-[#1a1a1a]" size={40} />
                        <p className="text-[10px] font-mono uppercase text-[#333] tracking-widest">
                            {viewMode.toUpperCase()} VIEW UNDER DEVELOPMENT<br />
                            <span className="text-[8px] opacity-50">USE NAVIGATION BUTTONS IN DAY VIEW FOR PRECISE CONTROL</span>
                        </p>
                        <button
                            onClick={() => setViewMode("day")}
                            className="text-[#99CCCC] text-[9px] font-black uppercase tracking-widest hover:underline"
                        >
                            Return to Day View
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
