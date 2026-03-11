"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import { Calendar as CalendarIcon, Clock, Radio, Plus, Settings, ChevronLeft, ChevronRight, LayoutGrid, List, Music, Signal, X, Save, Trash2, ArrowRight, Upload, Search, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

interface AzuraEvent {
    id: string
    title: string
    start: string
    end: string
    audio_file?: string
}

export function AzuracastManager() {
    const [view, setView] = useState<"timeGridDay" | "timeGridWeek" | "dayGridMonth">("timeGridWeek")
    const [events, setEvents] = useState<AzuraEvent[]>([])
    const [nowPlaying, setNowPlaying] = useState<any>(null)
    const [isMediaOpen, setIsMediaOpen] = useState(false)
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<AzuraEvent | null>(null)
    const calendarRef = useRef<any>(null)
    const [listenerStats, setListenerStats] = useState({ total: 0, unique: 0, current: 0 })

    const fetchNowPlaying = useCallback(async () => {
        try {
            const res = await fetch("/api/azuracast/nowplaying")
            const data = await res.json()
            if (data.listeners) setListenerStats(data.listeners)
            setNowPlaying(data)
        } catch (err) {
            console.error("Failed to fetch nowplaying", err)
        }
    }, [])

    const fetchSchedule = useCallback(async () => {
        try {
            const res = await fetch("/api/azuracast/schedule")
            const data = await res.json()
            // Transform AzuraCast playlists/schedule into FullCalendar events
            // This is a placeholder as AzuraCast structure varies
            const transformed = Array.isArray(data) ? data.map((p: any) => ({
                id: String(p.id),
                title: p.name,
                start: p.schedule?.[0]?.start_time || new Date().toISOString(),
                end: p.schedule?.[0]?.end_time || new Date().toISOString(),
            })) : []
            setEvents(transformed)
        } catch (err) {
            console.error("Failed to fetch schedule", err)
        }
    }, [])

    useEffect(() => {
        fetchNowPlaying()
        fetchSchedule()
        const timer = setInterval(fetchNowPlaying, 15000)
        return () => clearInterval(timer)
    }, [fetchNowPlaying, fetchSchedule])

    const handleDateSelect = (selectInfo: any) => {
        const newEvent: AzuraEvent = {
            id: `temp-${Date.now()}`,
            title: "Новый эфир",
            start: selectInfo.startStr,
            end: selectInfo.endStr
        }
        setSelectedEvent(newEvent)
        setIsEditorOpen(true)
    }

    const handleEventClick = (clickInfo: any) => {
        const ev = events.find(e => e.id === clickInfo.event.id)
        if (ev) {
            setSelectedEvent(ev)
            setIsEditorOpen(true)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] gap-6 animate-in fade-in duration-700">
            {/* Real-time Stats Overlay Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Current Listeners"
                    value={listenerStats.current}
                    icon={<Users size={20} className="text-[#99CCCC]" />}
                    subValue={`Total: ${listenerStats.total}`}
                />
                <StatCard
                    label="Unique Listeners"
                    value={listenerStats.unique}
                    icon={<Signal size={20} className="text-[#99CCCC]" />}
                    subValue="Last 24h"
                />
                <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#99CCCC]/5 to-transparent"></div>
                    <div className="relative z-10 flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#444] mb-1">Now Playing</span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-[200px]">
                            {nowPlaying?.now_playing || "Offline"}
                        </h3>
                    </div>
                    <div className="relative z-10 p-2 bg-[#99CCCC]/10 rounded-sm">
                        <Radio size={20} className={nowPlaying?.is_online ? "text-[#99CCCC] animate-pulse" : "text-[#444]"} />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 min-h-0">
                <div className="flex-1 bg-[#080808] border border-[#1a1a1a] rounded-sm p-4 shadow-xl relative flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex bg-black border border-[#1a1a1a] p-1 rounded-sm gap-1">
                            <ViewButton label="Day" active={view === "timeGridDay"} onClick={() => setView("timeGridDay")} />
                            <ViewButton label="Week" active={view === "timeGridWeek"} onClick={() => setView("timeGridWeek")} />
                            <ViewButton label="Month" active={view === "dayGridMonth"} onClick={() => setView("dayGridMonth")} />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => calendarRef.current?.getApi().prev()} className="p-1.5 hover:bg-[#1a1a1a] text-[#444] hover:text-white rounded-sm transition-all"><ChevronLeft size={16} /></button>
                            <button onClick={() => calendarRef.current?.getApi().today()} className="px-3 py-1 text-[9px] font-black uppercase text-[#444] hover:text-white transition-all">Today</button>
                            <button onClick={() => calendarRef.current?.getApi().next()} className="p-1.5 hover:bg-[#1a1a1a] text-[#444] hover:text-white rounded-sm transition-all"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 azuracast-calendar">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView={view}
                            headerToolbar={false}
                            events={events}
                            selectable={true}
                            editable={true}
                            nowIndicator={true}
                            height="100%"
                            select={handleDateSelect}
                            eventClick={handleEventClick}
                            eventContent={(info) => (
                                <div className="p-1 overflow-hidden">
                                    <div className="text-[10px] font-bold text-white uppercase truncate">{info.event.title}</div>
                                    <div className="text-[8px] font-mono text-[#99CCCC]/70">{info.timeText}</div>
                                </div>
                            )}
                        />
                    </div>
                </div>

                <div className="w-80 flex flex-col gap-6">
                    <AzuracastMediaLibrary />
                </div>
            </div>

            {/* Editor Modal Placeholder */}
            {isEditorOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-black uppercase text-[#99CCCC] tracking-widest">Schedule Broadcast</h3>
                            <button onClick={() => setIsEditorOpen(false)}><X size={20} className="text-[#444] hover:text-white" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] uppercase font-black text-[#444] block mb-1">Start Time</label>
                                    <input type="datetime-local" step="1" className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white" />
                                </div>
                                <div>
                                    <label className="text-[9px] uppercase font-black text-[#444] block mb-1">End Time</label>
                                    <input type="datetime-local" step="1" className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white" />
                                </div>
                            </div>
                            <button className="w-full py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest rounded-sm">Save to AzuraCast</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .azuracast-calendar .fc { --fc-border-color: #1a1a1a; --fc-today-bg-color: rgba(153, 204, 204, 0.05); }
                .azuracast-calendar .fc-event { background: rgba(153, 204, 204, 0.1); border: 1px solid rgba(153, 204, 204, 0.3) !important; color: white !important; border-radius: 0; box-shadow: 2px 0 0 0 #99CCCC inset; cursor: pointer; }
                .azuracast-calendar .fc-timegrid-slot { height: 4rem !important; border-bottom: 1px solid #0a0a0a !important; }
                .azuracast-calendar .fc-timegrid-slot-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #444; }
                .azuracast-calendar .fc-col-header-cell-cushion { font-family: 'Tektur', sans-serif; font-size: 10px; font-weight: 900; color: #737373; text-transform: uppercase; }
            `}</style>
        </div>
    )
}

function StatCard({ label, value, icon, subValue }: { label: string, value: any, icon: any, subValue?: string }) {
    return (
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-5 shadow-xl relative overflow-hidden group">
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#99CCCC]/20 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#444] mb-2">{label}</span>
                    <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
                    {subValue && <span className="text-[10px] font-mono text-[#737373] mt-1">{subValue}</span>}
                </div>
                <div className="p-2 bg-black border border-[#1a1a1a] rounded-sm group-hover:border-[#99CCCC]/30 transition-colors">
                    {icon}
                </div>
            </div>
        </div>
    )
}

function ViewButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${active ? "bg-[#1a1a1a] text-[#99CCCC] shadow-inner" : "text-[#444] hover:text-white"}`}
        >
            {label}
        </button>
    )
}

function AzuracastMediaLibrary() {
    const [files, setFiles] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)

    const fetchFiles = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/azuracast/media")
            const data = await res.json()
            if (Array.isArray(data)) setFiles(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchFiles()
    }, [fetchFiles])

    const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const formData = new FormData()
        formData.append("file", file)
        try {
            const res = await fetch("/api/azuracast/media", { method: "POST", body: formData })
            if (res.ok) {
                toast.success("File uploaded to AzuraCast")
                fetchFiles()
            }
        } catch (err) {
            toast.error("Upload failed")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex-1 bg-[#080808] border border-[#1a1a1a] rounded-sm flex flex-col min-h-0 shadow-2xl">
            <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-black">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#99CCCC]">Azura Media</span>
                <label className="cursor-pointer p-1.5 bg-[#1a1a1a] hover:bg-[#99CCCC] hover:text-black rounded-sm transition-all text-[#444]">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <input type="file" className="hidden" onChange={onFileUpload} disabled={uploading} />
                </label>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {files.map((f: any) => (
                    <div key={f.path} className="p-3 bg-black border border-[#1a1a1a] hover:border-[#99CCCC]/30 transition-all group flex items-center gap-3">
                        <Music size={14} className="text-[#444] group-hover:text-[#99CCCC]" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-white truncate font-mono">{f.name}</div>
                            <div className="text-[8px] text-[#444] uppercase">{Math.round(f.size / 1024 / 1024)} MB</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
