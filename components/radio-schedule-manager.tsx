"use client"

import { useState, useEffect, useRef } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import { Trash2, Plus, Music, ListMusic, Calendar as CalendarIcon, Upload, X, Check } from "lucide-react"

interface Track {
    id: number
    filename: string
    originalname: string
    size: number
    duration: number
    uploaded_at: string
}

interface Playlist {
    id: number
    name: string
    track_count: number
    total_duration: number
}

interface ScheduleItem {
    id: number
    title: string
    type: "track" | "playlist"
    item_id: number
    start_time: number
    end_time: number
}

interface ArtistSync {
    id: string | number
    name: string
    show: string
    image: string
}

export function RadioScheduleManager({ dbArtists, artists, setArtists }: {
    dbArtists: ArtistSync[],
    artists: any[],
    setArtists: (a: any) => void
}) {
    const [token, setToken] = useState<string | null>(null)
    const [view, setView] = useState<"tracks" | "playlists" | "schedule">("schedule")
    const [tracks, setTracks] = useState<Track[]>([])
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [schedule, setSchedule] = useState<ScheduleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    // Playlist Editor State
    const [editingPlaylist, setEditingPlaylist] = useState<{ id: number; name: string } | null>(null)
    const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])

    // Schedule Form State
    const [schType, setSchType] = useState<"track" | "playlist">("track")
    const [schItemId, setSchItemId] = useState("")
    const [schStart, setSchStart] = useState("")
    const [schEnd, setSchEnd] = useState("")
    const [schError, setSchError] = useState("")
    const [syncToTimeline, setSyncToTimeline] = useState(true)
    const [selectedArtistId, setSelectedArtistId] = useState<string | number | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const api = async (path: string, options: RequestInit = {}) => {
        const res = await fetch(`/api/radio${path}`, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Request failed" }))
            throw new Error(err.error || "Request failed")
        }
        return res.json()
    }

    // Auto-login to radio backend (internal admin)
    useEffect(() => {
        const login = async () => {
            try {
                const res = await fetch("/api/radio/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "admin", password: "admin" })
                })
                const data = await res.json()
                if (data.token) {
                    setToken(data.token)
                }
            } catch (e) {
                setError("Failed to connect to radio backend")
            }
        }
        login()
    }, [])

    const loadData = async () => {
        if (!token) return
        setLoading(true)
        try {
            const [t, p, s] = await Promise.all([
                api("/tracks"),
                api("/playlists"),
                api("/schedule")
            ])
            setTracks(t)
            setPlaylists(p)
            setSchedule(s)
            setError("")
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (token) loadData()
    }, [token])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        const fd = new FormData()
        for (let i = 0; i < files.length; i++) fd.append("files", files[i])

        setLoading(true)
        try {
            await fetch("/api/radio/tracks", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: fd
            })
            await loadData()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const deleteTrack = async (id: number) => {
        if (!confirm("Delete track permanently?")) return
        try {
            await api(`/tracks/${id}`, { method: "DELETE" })
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const createPlaylist = async (name: string) => {
        if (!name) return
        try {
            await api("/playlists", {
                method: "POST",
                body: JSON.stringify({ name, track_ids: [] })
            })
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const deletePlaylist = async (id: number) => {
        if (!confirm("Delete playlist?")) return
        try {
            await api(`/playlists/${id}`, { method: "DELETE" })
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const openPlaylist = async (p: Playlist) => {
        setEditingPlaylist(p)
        const t = await api(`/playlists/${p.id}/tracks`)
        setPlaylistTracks(t)
    }

    const addToPlaylist = async (trackId: number) => {
        if (!editingPlaylist) return
        try {
            await api(`/playlists/${editingPlaylist.id}/tracks`, {
                method: "POST",
                body: JSON.stringify({ track_id: trackId })
            })
            const t = await api(`/playlists/${editingPlaylist.id}/tracks`)
            setPlaylistTracks(t)
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const removeFromPlaylist = async (trackId: number) => {
        if (!editingPlaylist) return
        try {
            await api(`/playlists/${editingPlaylist.id}/tracks/${trackId}`, { method: "DELETE" })
            const t = await api(`/playlists/${editingPlaylist.id}/tracks`)
            setPlaylistTracks(t)
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const scheduleEvent = async () => {
        if (!schItemId || !schStart) return setSchError("Fill required fields")
        setSchError("")

        const startTime = new Date(schStart).getTime()
        const endTime = schEnd ? new Date(schEnd).getTime() : 0

        const item = schType === "track"
            ? tracks.find(t => t.id === parseInt(schItemId))
            : playlists.find(p => p.id === parseInt(schItemId))

        const title = `[${schType.toUpperCase()}] ${item ? (schType === "track" ? (item as Track).originalname : (item as Playlist).name) : "Unknown"}`

        try {
            const res = await api("/schedule", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    type: schType,
                    item_id: parseInt(schItemId),
                    start_time: startTime,
                    end_time: endTime || undefined // Backend will auto-calculate if missing
                })
            })

            // Sync to website timeline if needed
            if (syncToTimeline && res.end_time) {
                const startTimeISO = new Date(startTime).toISOString()
                const endTimeISO = new Date(res.end_time).toISOString()

                // CRITICAL: Check for existing overlap/duplicate in timeline to avoid multiple entries
                const isAlreadyScheduled = artists.some(a =>
                    a.startTime === startTimeISO &&
                    a.name === (dbArtists.find(da => String(da.id) === String(selectedArtistId))?.name || title.replace(/\[.*?\]\s*/, ''))
                )

                if (!isAlreadyScheduled) {
                    const dbArtist = dbArtists.find(a => String(a.id) === String(selectedArtistId))

                    const newArtistEntry = {
                        id: artists.length ? Math.max(...artists.map((a: any) => a.id)) + 1 : 0,
                        name: dbArtist ? dbArtist.name : title.replace(/\[.*?\]\s*/, ''),
                        location: "Earth",
                        show: dbArtist ? dbArtist.show : "DJ Set",
                        image: dbArtist ? dbArtist.image : "/artists/artist-1.jpg",
                        startTime: startTimeISO,
                        endTime: endTimeISO,
                        duration: ((res.end_time - startTime) / 1000 / 60).toFixed(0) + " min",
                        description: "Automatically synced from radio schedule",
                        dayIndex: 0,
                        orderInDay: 0,
                        type: "artist"
                    }

                    // Update parent state (which will trigger server persist via useArtists)
                    setArtists([...artists, newArtistEntry])
                }
            }

            await loadData()
            setSchStart("")
            setSchEnd("")
            setSchItemId("")
            setSelectedArtistId(null)
        } catch (e: any) {
            setSchError(e.message)
        }
    }

    const deleteSchedule = async (id: number) => {
        if (!confirm("Remove from schedule?")) return
        try {
            await api(`/schedule/${id}`, { method: "DELETE" })
            await loadData()
        } catch (e: any) {
            setError(e.message)
        }
    }

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    }

    if (!token) return <div className="p-10 text-center font-mono text-[11px] text-[#737373]">Connecting to radio engine...</div>

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-4">
                <div className="flex gap-4">
                    <button
                        onClick={() => setView("schedule")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono transition ${view === "schedule" ? "bg-white text-black" : "text-[#737373] hover:text-white"}`}
                    >
                        <CalendarIcon size={14} /> РАСПИСАНИЕ
                    </button>
                    <button
                        onClick={() => setView("tracks")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono transition ${view === "tracks" ? "bg-white text-black" : "text-[#737373] hover:text-white"}`}
                    >
                        <Music size={14} /> ТРЕКИ
                    </button>
                    <button
                        onClick={() => setView("playlists")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono transition ${view === "playlists" ? "bg-white text-black" : "text-[#737373] hover:text-white"}`}
                    >
                        <ListMusic size={14} /> ПЛЕЙЛИСТЫ (СЕТЫ)
                    </button>
                </div>
                {error && <span className="text-[10px] text-red-500 font-mono italic">{error}</span>}
                <div className="flex items-center gap-3">
                    {loading && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                    <button onClick={loadData} className="text-[#444] hover:text-white transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {view === "tracks" && (
                <div className="grid gap-6">
                    <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm">
                        <h3 className="text-[10px] font-bold text-[#737373] uppercase mb-3">Загрузка новых файлов</h3>
                        <div
                            className="border-2 border-dashed border-[#1a1a1a] rounded-sm p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#dc2626] transition group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="text-[#444] group-hover:text-[#dc2626] mb-2" size={24} />
                            <p className="text-[10px] font-mono text-[#737373] uppercase">Нажми или перетащи аудио файлы</p>
                            <input ref={fileInputRef} type="file" multiple accept="audio/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {tracks.map(t => (
                            <div key={t.id} className="p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm flex items-center justify-between group">
                                <div className="flex flex-col min-w-0 pr-4">
                                    <span className="text-[10px] font-bold text-white uppercase truncate" title={t.originalname}>{t.originalname}</span>
                                    <span className="text-[9px] font-mono text-[#444] uppercase tracking-tighter">
                                        {(t.size / 1024 / 1024).toFixed(1)}MB • {Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, '0')}
                                    </span>
                                </div>
                                <button onClick={() => deleteTrack(t.id)} className="text-[#444] hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100 p-2">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === "playlists" && (
                <div className="grid gap-6">
                    <div className="flex gap-2">
                        <input
                            placeholder="Название нового плейлиста..."
                            className="flex-1 bg-black border border-[#1a1a1a] rounded-sm px-3 py-2 text-xs outline-none focus:border-white"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    createPlaylist(e.currentTarget.value);
                                    e.currentTarget.value = "";
                                }
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-[#737373] uppercase">Все Плейлисты</h3>
                            {playlists.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => openPlaylist(p)}
                                    className={`p-3 border rounded-sm flex items-center justify-between cursor-pointer transition ${editingPlaylist?.id === p.id ? 'border-[#dc2626] bg-[#111]' : 'border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#333]'}`}
                                >
                                    <div>
                                        <p className="text-[10px] font-bold uppercase">{p.name}</p>
                                        <p className="text-[9px] font-mono text-[#444] uppercase">{p.track_count} треков • {(p.total_duration / 60).toFixed(0)} мин</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deletePlaylist(p.id); }} className="text-[#444] hover:text-red-500 p-2">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {editingPlaylist && (
                            <div className="bg-[#0a0a0a] border border-[#dc2626] rounded-sm flex flex-col h-[500px]">
                                <div className="p-3 border-b border-[#dc2626] flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold uppercase truncate">Редактор: {editingPlaylist.name}</h3>
                                    <button onClick={() => setEditingPlaylist(null)} className="text-[#737373] hover:text-white"><X size={16} /></button>
                                </div>
                                <div className="flex-1 flex overflow-hidden">
                                    <div className="flex-1 overflow-y-auto border-r border-[#1a1a1a] p-2 space-y-1">
                                        <p className="text-[9px] text-[#444] uppercase font-mono mb-2">Добавить трек</p>
                                        {tracks.map(t => (
                                            <div key={t.id} onClick={() => addToPlaylist(t.id)} className="p-2 bg-black border border-[#111] hover:border-[#dc2626] rounded-sm cursor-pointer flex justify-between items-center group">
                                                <span className="text-[9px] uppercase truncate flex-1">{t.originalname}</span>
                                                <Plus size={10} className="text-[#444] group-hover:text-white" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#050505]">
                                        <p className="text-[9px] text-[#444] uppercase font-mono mb-2">В плейлисте</p>
                                        {playlistTracks.map((t, idx) => (
                                            <div key={`${t.id}-${idx}`} className="p-2 bg-[#111] border border-[#1a1a1a] rounded-sm flex justify-between items-center group">
                                                <span className="text-[9px] uppercase truncate flex-1">{t.originalname}</span>
                                                <button onClick={() => removeFromPlaylist(t.id)} className="text-red-900 group-hover:text-red-500 transition-colors"><X size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === "schedule" && (
                <div className="grid lg:grid-cols-[1fr_350px] gap-6">
                    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm p-4 overflow-hidden calendar-dark">
                        <FullCalendar
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="timeGridWeek"
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: "dayGridMonth,timeGridWeek,timeGridDay"
                            }}
                            events={schedule.map(s => ({
                                id: String(s.id),
                                title: s.title,
                                start: new Date(s.start_time).toISOString(),
                                end: new Date(s.end_time).toISOString(),
                                backgroundColor: s.type === 'playlist' ? '#1e3a8a' : '#581c87',
                                borderColor: s.type === 'playlist' ? '#3b82f6' : '#a855f7',
                            }))}
                            eventClick={(info) => {
                                deleteSchedule(parseInt(info.event.id))
                            }}
                            slotMinTime="00:00:00"
                            slotMaxTime="24:00:00"
                            height={600}
                            nowIndicator={true}
                            allDaySlot={false}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm space-y-4">
                            <h3 className="text-[10px] font-bold text-[#737373] uppercase">Создать событие</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[9px] uppercase font-mono text-[#444] mb-1">Тип</label>
                                    <select
                                        className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1.5 text-xs text-white"
                                        value={schType}
                                        onChange={(e) => {
                                            setSchType(e.target.value as any)
                                            setSchItemId("")
                                        }}
                                    >
                                        <option value="track">Одиночный Трек</option>
                                        <option value="playlist">Плейлист (Сет)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] uppercase font-mono text-[#444] mb-1">Элемент</label>
                                    <select
                                        className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1.5 text-xs text-white"
                                        value={schItemId}
                                        onChange={(e) => setSchItemId(e.target.value)}
                                    >
                                        <option value="">-- Выбрать --</option>
                                        {schType === 'track' ? (
                                            tracks.map(t => <option key={t.id} value={t.id}>{t.originalname}</option>)
                                        ) : (
                                            playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] uppercase font-mono text-[#444] mb-1">Начало (Время VPS: {formatTime(Date.now())})</label>
                                    <input
                                        type="datetime-local"
                                        step="1"
                                        className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1.5 text-xs text-white"
                                        value={schStart}
                                        onChange={(e) => setSchStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] uppercase font-mono text-[#444] mb-1">Конец (Необязательно)</label>
                                    <input
                                        type="datetime-local"
                                        step="1"
                                        className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1.5 text-xs text-white"
                                        value={schEnd}
                                        onChange={(e) => setSchEnd(e.target.value)}
                                    />
                                    <p className="text-[8px] text-[#444] mt-1 italic uppercase">Если пусто — рассчитает автоматически</p>
                                </div>
                                <div className="space-y-2 border-t border-[#1a1a1a] pt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={syncToTimeline} onChange={e => setSyncToTimeline(e.target.checked)} className="accent-[#dc2626]" />
                                        <span className="text-[10px] font-mono text-[#737373] uppercase">Синхронизировать с таймлайном сайта</span>
                                    </label>
                                    {syncToTimeline && (
                                        <div>
                                            <label className="block text-[9px] uppercase font-mono text-[#444] mb-1">Карточка Артиста</label>
                                            <select
                                                className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1.5 text-[10px] text-[#99CCCC]"
                                                value={selectedArtistId || ""}
                                                onChange={(e) => setSelectedArtistId(e.target.value)}
                                            >
                                                <option value="">-- Использовать название файла --</option>
                                                {dbArtists.map(a => <option key={a.id} value={a.id}>{a.name} ({a.show})</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {schError && <p className="text-[9px] text-red-500 font-mono italic">{schError}</p>}
                                <button
                                    onClick={scheduleEvent}
                                    className="w-full py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-[#dc2626] hover:text-white transition"
                                >
                                    ДОБАВИТЬ В ЭФИР
                                </button>
                            </div>
                        </div>

                        <div className="p-4 border border-[#1a1a1a] rounded-sm">
                            <h3 className="text-[10px] font-bold text-[#444] uppercase mb-2">Подсказка</h3>
                            <p className="text-[9px] leading-relaxed text-[#555] font-mono">
                                • ТРЕКИ МОЖНО УДАЛЯТЬ ТОЛЬКО ЕСЛИ ОНИ НЕ В ПЛЕЙЛИСТЕ И НЕ В РАСПИСАНИИ.<br />
                                • НАЖМИТЕ НА СОБЫТИЕ В КАЛЕНДАРЕ, ЧТОБЫ УДАЛИТЬ ЕГО.<br />
                                • ВРЕМЯ УКАЗЫВАЕТСЯ ПО МЕСТНОМУ ВРЕМЕНИ БРАУЗЕРА, НО В БАЗУ ПИШЕТСЯ UTC.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .calendar-dark {
                    --fc-border-color: #1a1a1a;
                    --fc-daygrid-event-dot-width: 5px;
                    --fc-today-bg-color: rgba(255,255,255,0.05);
                }
                .fc {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    font-size: 9px;
                    text-transform: uppercase;
                }
                .fc .fc-toolbar-title { font-size: 11px; font-weight: bold; }
                .fc .fc-button { 
                    background: transparent; 
                    border: 1px solid #1a1a1a; 
                    color: #737373; 
                    text-transform: uppercase; 
                    font-size: 9px;
                    padding: 4px 8px;
                    border-radius: 2px;
                }
                .fc .fc-button:hover { background: #111; color: white; }
                .fc .fc-button-primary:not(:disabled).fc-button-active { background: white; color: black; border-color: white; }
                .fc .fc-col-header-cell-cushion { color: #737373; padding: 10px 0; }
                .fc-timegrid-slot-label-cushion { color: #444 !important; }
                .fc-v-event { border-radius: 1px; border: none; padding: 1px 2px; }
                .fc-event-title { font-weight: bold; overflow: hidden; text-overflow: ellipsis; }
            `}</style>
        </div>
    )
}
