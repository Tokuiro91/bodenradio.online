"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import { useArtists } from "@/lib/use-artists"
import { useSession } from "next-auth/react"
import { MediaLibrary } from "./media-library"
import { Calendar, Clock, Radio, Plus, Settings, ChevronLeft, ChevronRight, LayoutGrid, List, Music, Signal, X, Save, Trash2, ArrowRight } from "lucide-react"
import { socketService } from "@/lib/socket"
import { toast } from "sonner"

interface BroadcastEvent {
    id: string
    title: string
    start: string
    end: string
    type: "track" | "playlist"
    item_id: number
    db_id?: number
    track_name?: string
    audio_file?: string
    broadcast_image?: string
    external_stream_url?: string
}

export function BroadcastManager() {
    const { data: session } = useSession()
    const { artists, setArtists, ready: artistsReady } = useArtists()
    const [events, setEvents] = useState<BroadcastEvent[]>([])
    const [nowPlaying, setNowPlaying] = useState<any>(null)
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<BroadcastEvent | null>(null)
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const calendarRef = useRef<any>(null)
    const [view, setView] = useState<"timeGridDay" | "timeGridWeek" | "dayGridMonth">("timeGridWeek")

    const token = (session as any)?.accessToken

    const fetchSchedule = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch("/api/radio/schedule", {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Failed to fetch schedule")
            const data = await res.json()
            setEvents(data.map((s: any) => ({
                id: String(s.id),
                title: s.title,
                start: new Date(s.start_time).toISOString(),
                end: new Date(s.end_time).toISOString(),
                type: s.type,
                item_id: s.item_id,
                db_id: s.db_id,
                track_name: s.track_name,
                audio_file: s.audio_file,
                broadcast_image: s.broadcast_image,
                external_stream_url: s.external_stream_url
            })))
        } catch (err) {
            console.error(err)
        }
    }, [token])

    useEffect(() => {
        if (token) fetchSchedule()

        const socket = socketService.connect()
        socket.on("now-playing:update", (data: any) => {
            setNowPlaying(data)
        })

        return () => {
            socket.off("now-playing:update")
        }
    }, [token, fetchSchedule])

    const handleDateSelect = (selectInfo: any) => {
        const newEvent: BroadcastEvent = {
            id: `temp-${Date.now()}`,
            title: "Новый эфир",
            start: selectInfo.startStr,
            end: selectInfo.endStr,
            type: "track",
            item_id: 0
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

    const handleEventDrop = async (dropInfo: any) => {
        const { event: fcEvent } = dropInfo
        const updatedEvent: BroadcastEvent = {
            ...events.find(e => e.id === fcEvent.id)!,
            start: fcEvent.startStr,
            end: fcEvent.endStr
        }
        await updateEventOnServer(updatedEvent)
    }

    const updateEventOnServer = async (ev: BroadcastEvent) => {
        try {
            const payload = {
                title: ev.title,
                type: ev.type,
                item_id: ev.item_id,
                db_id: ev.db_id,
                start_time: new Date(ev.start).getTime(),
                end_time: new Date(ev.end).getTime(),
                track_name: ev.track_name,
                audio_file: ev.audio_file,
                broadcast_image: ev.broadcast_image,
                external_stream_url: ev.external_stream_url
            }

            const method = ev.id.startsWith("temp-") ? "POST" : "PUT"
            const url = ev.id.startsWith("temp-") ? "/api/radio/schedule" : `/api/radio/schedule/${ev.id}`

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to save")
            }

            toast.success("Эфир сохранен")
            await fetchSchedule()
            setIsEditorOpen(false)

            // Sync with dashboard artists if needed
            // (In a real app, you might want to trigger a global sync here)
        } catch (err: any) {
            toast.error(err.message)
            fetchSchedule() // Revert changes in UI
        }
    }

    const handleDeleteEvent = async (id: string) => {
        if (!confirm("Удалить этот эфир?")) return
        try {
            const res = await fetch(`/api/radio/schedule/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Delete failed")
            toast.success("Эфир удален")
            await fetchSchedule()
            setIsEditorOpen(false)
        } catch (err) {
            toast.error("Ошибка при удалении")
        }
    }

    const handleAddMediaToEditor = (filename: string) => {
        if (selectedEvent) {
            setSelectedEvent({
                ...selectedEvent,
                audio_file: filename,
                title: selectedEvent.title === "Новый эфир" ? filename.replace(".mp3", "") : selectedEvent.title
            })
            setIsMediaLibraryOpen(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] gap-6 animate-in fade-in duration-700">
            {/* Now Playing Integrated Banner */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-4 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#99CCCC]/5 to-transparent"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 bg-black border border-[#99CCCC]/20 rounded-sm flex items-center justify-center">
                        <Radio size={20} className={nowPlaying ? "text-[#99CCCC] animate-pulse" : "text-[#444]"} />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#99CCCC]">Now On Air</span>
                            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-[300px]">
                            {nowPlaying?.trackName || nowPlaying?.title || "Нет активного эфира"}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-6 relative z-10">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[9px] font-mono text-[#444] uppercase tracking-tighter">System Status</span>
                        <span className="text-[10px] font-bold text-[#99CCCC] uppercase">Sync Operational</span>
                    </div>
                    <button
                        onClick={() => setIsMediaLibraryOpen(true)}
                        className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-[#99CCCC] transition-all flex items-center gap-2 shadow-lg"
                    >
                        <Plus size={14} />
                        Медиатека
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex gap-6 min-h-0">
                {/* Calendar Container */}
                <div className="flex-1 bg-[#080808] border border-[#1a1a1a] rounded-sm p-4 shadow-xl relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-black border border-[#1a1a1a] p-1 rounded-sm">
                                <button
                                    onClick={() => setView("timeGridDay")}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded-sm transition-all ${view === 'timeGridDay' ? 'bg-[#1a1a1a] text-[#99CCCC]' : 'text-[#444] hover:text-white'}`}
                                >День</button>
                                <button
                                    onClick={() => setView("timeGridWeek")}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded-sm transition-all ${view === 'timeGridWeek' ? 'bg-[#1a1a1a] text-[#99CCCC]' : 'text-[#444] hover:text-white'}`}
                                >Неделя</button>
                                <button
                                    onClick={() => setView("dayGridMonth")}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded-sm transition-all ${view === 'dayGridMonth' ? 'bg-[#1a1a1a] text-[#99CCCC]' : 'text-[#444] hover:text-white'}`}
                                >Месяц</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => calendarRef.current?.getApi().prev()} className="p-1.5 hover:bg-[#1a1a1a] text-[#444] hover:text-white rounded-sm transition-all">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => calendarRef.current?.getApi().today()} className="px-3 py-1 text-[9px] font-black uppercase text-[#444] hover:text-white transition-all">Today</button>
                            <button onClick={() => calendarRef.current?.getApi().next()} className="p-1.5 hover:bg-[#1a1a1a] text-[#444] hover:text-white rounded-sm transition-all">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 broadcast-calendar">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView={view}
                            headerToolbar={false}
                            events={events}
                            selectable={true}
                            editable={true}
                            selectMirror={true}
                            dayMaxEvents={true}
                            weekends={true}
                            nowIndicator={true}
                            slotMinTime="00:00:00"
                            slotMaxTime="24:00:00"
                            allDaySlot={false}
                            select={handleDateSelect}
                            eventClick={handleEventClick}
                            eventDrop={handleEventDrop}
                            eventResize={handleEventDrop}
                            height="100%"
                            eventContent={(eventInfo) => (
                                <div className="flex flex-col px-1 h-full overflow-hidden">
                                    <div className="flex items-center gap-1">
                                        <Music size={10} className="shrink-0" />
                                        <span className="text-[10px] font-bold uppercase truncate">{eventInfo.event.title}</span>
                                    </div>
                                    <div className="text-[8px] font-mono opacity-60 truncate">
                                        {eventInfo.timeText}
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* Side Panels */}
                {isMediaLibraryOpen && (
                    <div className="w-96 animate-in slide-in-from-right duration-300">
                        <MediaLibrary
                            onClose={() => setIsMediaLibraryOpen(false)}
                            onSelectFile={handleAddMediaToEditor}
                            token={token}
                        />
                    </div>
                )}
            </div>

            {/* Event Editor Modal */}
            {isEditorOpen && selectedEvent && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-[#080808] border border-[#1a1a1a] rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-black">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#99CCCC]/10 rounded-sm">
                                    <Settings size={16} className="text-[#99CCCC]" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-[0.2em]">Редактор Эфира</h2>
                            </div>
                            <button onClick={() => setIsEditorOpen(false)} className="text-[#444] hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                            {/* Visual Header */}
                            <div className="flex items-center gap-6 p-4 bg-black border border-[#1a1a1a] rounded-sm">
                                <div className="w-24 h-24 bg-[#111] border border-[#1a1a1a] rounded-sm relative overflow-hidden flex items-center justify-center group">
                                    {selectedEvent.broadcast_image ? (
                                        <img src={`/broadcast-media/${selectedEvent.broadcast_image}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <Music size={32} className="text-[#1a1a1a] group-hover:text-[#99CCCC]/20 transition-all" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer">
                                        <span className="text-[8px] font-black uppercase tracking-tighter text-white">Change Art</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        value={selectedEvent.title}
                                        onChange={e => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                                        placeholder="Название трансляции"
                                        className="bg-transparent text-2xl font-black text-white outline-none w-full border-b border-[#1a1a1a] focus:border-[#99CCCC] transition-all"
                                    />
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2 text-[#444]">
                                            <Signal size={12} />
                                            <span className="text-[9px] uppercase font-bold tracking-widest">{selectedEvent.type}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[#444]">
                                            <Clock size={12} />
                                            <span className="text-[9px] font-mono">ID: {selectedEvent.id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Время Начала</label>
                                        <div className="flex items-center gap-2 bg-black border border-[#1a1a1a] rounded-sm p-3 group focus-within:border-[#99CCCC] transition-all">
                                            <Clock size={14} className="text-[#1a1a1a] group-focus-within:text-[#99CCCC]" />
                                            <input
                                                type="datetime-local"
                                                step="1"
                                                value={new Date(new Date(selectedEvent.start).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19)}
                                                onChange={e => setSelectedEvent({ ...selectedEvent, start: e.target.value })}
                                                className="bg-transparent text-xs text-white outline-none w-full font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Время Окончания</label>
                                        <div className="flex items-center gap-2 bg-black border border-[#1a1a1a] rounded-sm p-3 group focus-within:border-[#99CCCC] transition-all">
                                            <Clock size={14} className="text-[#1a1a1a] group-focus-within:text-[#99CCCC]" />
                                            <input
                                                type="datetime-local"
                                                step="1"
                                                value={new Date(new Date(selectedEvent.end).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19)}
                                                onChange={e => setSelectedEvent({ ...selectedEvent, end: e.target.value })}
                                                className="bg-transparent text-xs text-white outline-none w-full font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Привязка к Артисту</label>
                                        <select
                                            value={selectedEvent.db_id || ""}
                                            onChange={e => {
                                                const art = artists.find(a => String(a.id) === e.target.value)
                                                setSelectedEvent({
                                                    ...selectedEvent,
                                                    db_id: e.target.value ? parseInt(e.target.value) : undefined,
                                                    title: art ? art.name : selectedEvent.title
                                                })
                                            }}
                                            className="w-full bg-black border border-[#1a1a1a] rounded-sm p-3 text-xs text-[#99CCCC] outline-none focus:border-[#99CCCC] transition-all font-mono"
                                        >
                                            <option value="">-- НЕТ ПРИВЯЗКИ --</option>
                                            {artists.map((a: any) => (
                                                <option key={a.id} value={a.id}>{a.name} ({a.show})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Название Трека (Metadata)</label>
                                        <div className="flex items-center gap-2 bg-black border border-[#1a1a1a] rounded-sm p-3 group focus-within:border-[#99CCCC] transition-all">
                                            <Music size={14} className="text-[#1a1a1a] group-focus-within:text-[#99CCCC]" />
                                            <input
                                                value={selectedEvent.track_name || ""}
                                                onChange={e => setSelectedEvent({ ...selectedEvent, track_name: e.target.value })}
                                                placeholder="Artist - Track Name"
                                                className="bg-transparent text-xs text-white outline-none w-full font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-black border border-dashed border-[#1a1a1a] rounded-sm flex flex-col items-center justify-center space-y-4">
                                <div className="text-center">
                                    <p className="text-[10px] uppercase font-black text-[#444] tracking-widest mb-1">Аудио Источник</p>
                                    <p className="text-xs font-mono text-[#99CCCC]">
                                        {selectedEvent.audio_file || selectedEvent.external_stream_url || "ИСТОЧНИК НЕ ВЫБРАН"}
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setIsMediaLibraryOpen(true)}
                                        className="px-6 py-2 bg-[#1a1a1a] text-white text-[10px] font-black uppercase rounded-sm hover:bg-[#99CCCC] hover:text-black transition-all border border-[#222]"
                                    >
                                        Обзор файлов
                                    </button>
                                    <input
                                        placeholder="External Stream URL (optional)"
                                        value={selectedEvent.external_stream_url || ""}
                                        onChange={e => setSelectedEvent({ ...selectedEvent, external_stream_url: e.target.value })}
                                        className="w-64 bg-black border border-[#1a1a1a] rounded-sm p-2 text-[10px] text-white outline-none focus:border-[#99CCCC] font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-6 border-t border-[#1a1a1a] bg-black flex justify-between items-center">
                            <button
                                onClick={() => handleDeleteEvent(selectedEvent.id)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-red-900 hover:text-red-500 transition-all"
                            >
                                <Trash2 size={14} />
                                Удалить Эфир
                            </button>
                            <div className="flex gap-4">
                                <button onClick={() => setIsEditorOpen(false)} className="px-8 py-3 text-[10px] font-black uppercase text-[#444] hover:text-white transition-all">Отмена</button>
                                <button
                                    onClick={() => updateEventOnServer(selectedEvent)}
                                    className="px-10 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white transition-all shadow-xl flex items-center gap-2"
                                >
                                    Сохранить Изменения
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .broadcast-calendar .fc { --fc-border-color: #1a1a1a; --fc-daygrid-event-dot-width: 4px; }
                .broadcast-calendar .fc-theme-standard td, .broadcast-calendar .fc-theme-standard th { border-color: #1a1a1a; }
                .broadcast-calendar .fc-event { background: rgba(153, 204, 204, 0.1); border: 1px solid rgba(153, 204, 204, 0.3) !important; color: white !important; cursor: pointer; border-radius: 0; box-shadow: 2px 0 0 0 #99CCCC inset; }
                .broadcast-calendar .fc-event:hover { background: rgba(153, 204, 204, 0.2); border-color: #99CCCC !important; }
                .broadcast-calendar .fc-timegrid-slot { height: 3rem !important; border-bottom: 1px solid #0a0a0a !important; }
                .broadcast-calendar .fc-timegrid-slot-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #444; border: none !important; }
                .broadcast-calendar .fc-col-header-cell { padding: 12px 0; background: #080808; }
                .broadcast-calendar .fc-col-header-cell-cushion { font-family: 'Tektur', sans-serif; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #737373; }
                .broadcast-calendar .fc-day-today { background: rgba(153, 204, 204, 0.02) !important; }
                .broadcast-calendar .fc-now-indicator { border-color: #99CCCC; }
                .broadcast-calendar .fc-scrollgrid { border: none !important; }
            `}</style>
        </div>
    )
}
