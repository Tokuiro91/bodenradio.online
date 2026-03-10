"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useArtists } from "@/lib/use-artists"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Search, Radio, Users, Database, BarChart3, Bell, LogOut, ChevronRight, Plus, Calendar, X, Clock, Music, Edit2, Upload, Trash2, Link as LinkIcon } from "lucide-react"
import { DBArtist } from "@/lib/artist-db-store"
import { RadioScheduleManager } from "@/components/radio-schedule-manager"
import { socketService } from "@/lib/socket"
import { Signal } from "lucide-react"

export default function UnifiedDashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { artists, setArtists, ready } = useArtists()
    const [dbArtists, setDbArtists] = useState<DBArtist[]>([])
    const [dbSearchQuery, setDbSearchQuery] = useState("")
    const [activeView, setActiveView] = useState<"overview" | "schedule" | "database" | "analytics" | "broadcast-list">("overview")
    const [selectedArtistForSchedule, setSelectedArtistForSchedule] = useState<DBArtist | null>(null)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [selectedArtistForEdit, setSelectedArtistForEdit] = useState<DBArtist | null>(null)
    const [isArtistEditModalOpen, setIsArtistEditModalOpen] = useState(false)
    const [isArtistCreateModalOpen, setIsArtistCreateModalOpen] = useState(false)
    const [systemStats, setSystemStats] = useState({ storage: "...", memory: "...", cpu: "...", latency: "..." })
    const [onlineCount, setOnlineCount] = useState(0)
    const [nowPlaying, setNowPlaying] = useState<any>(null)
    const [isSyncing, setIsSyncing] = useState(false)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/system/health")
                const data = await res.json()
                setSystemStats(data)
            } catch (err) {
                console.error("Failed to fetch system stats", err)
            }
        }
        fetchStats()
        const timer = setInterval(fetchStats, 30000)

        const socket = socketService.connect()
        socket.on("stats:update", (data: any) => {
            if (data.onlineCount !== undefined) setOnlineCount(data.onlineCount)
        })
        socket.on("now-playing:update", (data: any) => {
            setNowPlaying(data)
        })

        return () => {
            clearInterval(timer)
            socket.off("stats:update")
        }
    }, [])

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/admin/login")
        }
    }, [status, router])

    useEffect(() => {
        fetch("/api/artist-db").then(r => r.json()).then(setDbArtists).catch(() => { })
    }, [])

    if (status === "loading" || !ready) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-[#9ca3af] font-mono text-[10px] uppercase tracking-widest">
                Initializing Command Center...
            </div>
        )
    }

    const filteredDbArtists = dbArtists.filter(a =>
        a.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
        a.show.toLowerCase().includes(dbSearchQuery.toLowerCase())
    ).slice(0, 8)

    const handleAddToSchedule = (a: DBArtist) => {
        setSelectedArtistForSchedule(a)
        setIsScheduleModalOpen(true)
    }

    const handleEditArtist = (a: DBArtist) => {
        setSelectedArtistForEdit(a)
        setIsArtistEditModalOpen(true)
    }

    const handleCreateMaster = () => {
        setIsArtistCreateModalOpen(true)
    }

    const handleSaveNewArtist = async (newArtist: Omit<DBArtist, "id">) => {
        try {
            const res = await fetch("/api/artist-db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newArtist)
            })
            if (!res.ok) throw new Error("Create failed")
            const created = await res.json()

            setDbArtists(prev => [...prev, created])
            setIsArtistCreateModalOpen(false)
        } catch (err) {
            alert("Failed to create artist")
        }
    }

    const handleSaveArtist = async (updated: DBArtist) => {
        try {
            const res = await fetch("/api/artist-db", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updated)
            })
            if (!res.ok) throw new Error("Save failed")

            setDbArtists(prev => prev.map(a => a.id === updated.id ? updated : a))
            setIsArtistEditModalOpen(false)
            setSelectedArtistForEdit(null)
        } catch (err) {
            alert("Failed to save artist changes")
        }
    }

    const handleManualSync = async () => {
        setIsSyncing(true)
        try {
            const res = await fetch("/api/radio/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artists }),
            })
            if (!res.ok) throw new Error("Sync failed")
            alert("Все изменения в Сетке Эфира успешно отправлены на вещатель!")
        } catch (err) {
            alert("Ошибка при отправке данных")
        } finally {
            setIsSyncing(false)
        }
    }

    const confirmAddToSchedule = (details: {
        name: string;
        show: string;
        startTime: string;
        endTime: string;
        trackName: string;
        description: string;
        instagram_url?: string;
        soundcloud_url?: string;
        mixcloud_url?: string;
        audio_file?: string;
        broadcast_image?: string;
        external_stream_url?: string;
    }) => {
        const newArtist = {
            id: artists.length ? Math.max(...artists.map((a: any) => a.id)) + 1 : 0,
            dbId: selectedArtistForSchedule?.id,
            name: details.name,
            location: selectedArtistForSchedule?.location || "Earth",
            show: details.show,
            image: details.broadcast_image ? `/broadcast-media/${details.broadcast_image}` : (selectedArtistForSchedule?.image || "/artists/artist-1.jpg"),
            startTime: details.startTime,
            endTime: details.endTime,
            duration: ((new Date(details.endTime).getTime() - new Date(details.startTime).getTime()) / 1000 / 60).toFixed(0) + " min",
            description: details.description,
            trackName: details.trackName,
            instagram_url: details.instagram_url,
            soundcloud_url: details.soundcloud_url,
            mixcloud_url: details.mixcloud_url,
            audio_file: details.audio_file,
            external_stream_url: details.external_stream_url,
            dayIndex: 0,
            orderInDay: 0,
            type: "artist" as const
        }

        const nextArtists = [...artists, newArtist]
        setArtists(nextArtists)

        fetch("/api/radio/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artists: nextArtists }),
        }).catch(() => { })

        setIsScheduleModalOpen(false)
        setSelectedArtistForSchedule(null)
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#e5e5e5] font-sans selection:bg-[#99CCCC]/30">
            <aside className="fixed left-0 top-0 h-full w-64 border-r border-[#1a1a1a] bg-[#080808] z-50 hidden lg:flex flex-col">
                <div className="p-6 border-b border-[#1a1a1a]">
                    <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2">
                        <span className="font-tektur text-white">BØDEN</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#99CCCC] text-black rounded-sm font-mono mt-1">HQ</span>
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <NavItem active={activeView === "overview"} onClick={() => setActiveView("overview")} icon={<Radio size={18} />} label="Панель Управления" />
                    <NavItem active={activeView === "schedule"} onClick={() => setActiveView("schedule")} icon={<Calendar size={18} />} label="Сетка Эфира" />
                    <NavItem active={activeView === "broadcast-list"} onClick={() => setActiveView("broadcast-list")} icon={<Plus size={18} />} label="Список Эфира" />
                    <NavItem active={activeView === "database"} onClick={() => setActiveView("database")} icon={<Database size={18} />} label="База Артистов" />
                    <NavItem active={activeView === "analytics"} onClick={() => setActiveView("analytics")} icon={<BarChart3 size={18} />} label="Аналитика" />
                </nav>

                <div className="p-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
                    <div className="flex items-center gap-3 mb-4 p-2">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] text-[#99CCCC] font-bold border border-[#2a2a2a]">
                            {session?.user?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] text-white truncate font-medium">{session?.user?.email}</span>
                            <span className="text-[9px] text-[#737373] uppercase tracking-tighter">{session?.user?.role}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/admin/login" })}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs text-[#737373] hover:text-white hover:bg-[#1a1a1a] rounded-sm transition-all border border-transparent hover:border-[#2a2a2a]"
                    >
                        <LogOut size={14} />
                        <span>Выход</span>
                    </button>
                </div>
            </aside>

            <main className="lg:ml-64 p-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-[#737373] text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span>Live System Dashboard</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">
                            {activeView === "overview" && "Панель Управления"}
                            {activeView === "schedule" && "Сетка Эфира"}
                            {activeView === "broadcast-list" && "Список Эфира"}
                            {activeView === "database" && "База Артистов"}
                            {activeView === "analytics" && "Аналитика"}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-sm hover:bg-[#99CCCC] transition-colors shadow-lg">
                            <Plus size={16} />
                            <span>Новый Эфир</span>
                        </button>
                    </div>
                </div>

                {activeView === "overview" && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        <div className="xl:col-span-8 space-y-8">
                            <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden shadow-2xl">
                                <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
                                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                        <Radio size={14} className="text-[#99CCCC]" />
                                        Управление Эфиром
                                    </h3>
                                    <button
                                        onClick={handleManualSync}
                                        disabled={isSyncing}
                                        className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-all ${isSyncing ? "animate-pulse border-[#444] text-[#444]" : "border-[#99CCCC]/30 text-[#99CCCC] hover:bg-[#99CCCC] hover:text-black"}`}
                                    >
                                        {isSyncing ? "PUSHING..." : "PUSH TO RADIO"}
                                    </button>
                                </div>

                                <div className="p-4 bg-black">
                                    <RadioScheduleManager
                                        artists={artists}
                                        setArtists={setArtists}
                                        dbArtists={dbArtists}
                                    />
                                </div>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 overflow-hidden relative col-span-2">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#99CCCC]/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737373] mb-6 flex items-center justify-between">
                                        Система
                                        <BarChart3 size={14} />
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard label="CPU Load" value={systemStats.cpu} sub="Средняя" />
                                        <MetricCard label="Latency" value={systemStats.latency} sub="Задержка" />
                                        <MetricCard label="Storage" value={systemStats.storage} sub="Диск" />
                                        <MetricCard label="Memory" value={systemStats.memory} sub="Память" />
                                    </div>
                                </section>

                                <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 overflow-hidden relative col-span-2">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737373] mb-6 flex items-center justify-between">
                                        Аналитика
                                        <Signal size={14} className={onlineCount > 0 ? "text-green-500 animate-pulse" : ""} />
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard label="Онлайн" value={onlineCount.toString()} sub="Слушателей" />
                                        <MetricCard label="Сессии" value="---" sub="Сегодня" />
                                        <MetricCard label="Реакции" value="---" sub="24ч" />
                                        <MetricCard label="Избранное" value="---" sub="Всего" />
                                    </div>
                                </section>


                            </div>
                        </div>

                        <div className="xl:col-span-4 space-y-8">
                            <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 shadow-xl flex flex-col h-full max-h-[600px]">
                                <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Database size={14} className="text-[#99CCCC]" />
                                    База Артистов
                                </h3>

                                <div className="relative mb-6">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" size={14} />
                                    <input
                                        value={dbSearchQuery}
                                        onChange={(e) => setDbSearchQuery(e.target.value)}
                                        placeholder="Поиск артистов..."
                                        className="w-full bg-black border border-[#1a1a1a] rounded-sm py-2.5 pl-9 pr-4 text-xs outline-none focus:border-[#99CCCC] transition-colors font-mono"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {filteredDbArtists.map(a => (
                                        <div key={a.id} className="p-3 bg-black border border-[#1a1a1a] rounded-sm hover:border-[#99CCCC]/50 transition-all group flex items-center gap-3">
                                            <div className="w-10 h-10 aspect-square relative rounded-sm overflow-hidden bg-[#111] border border-[#1a1a1a]">
                                                {a.image && <Image src={a.image} alt={a.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all" unoptimized />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate group-hover:text-[#99CCCC] transition-colors">{a.name}</p>
                                                <p className="text-[10px] text-[#444] truncate">{a.show}</p>
                                            </div>
                                            <button
                                                onClick={() => handleAddToSchedule(a)}
                                                className="p-1.5 opacity-0 group-hover:opacity-100 bg-[#1a1a1a] text-[#99CCCC] rounded-sm transition-all hover:bg-[#99CCCC] hover:text-black"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
                {(activeView === "overview" || activeView === "schedule" || activeView === "broadcast-list") && nowPlaying && (
                    <section className="mb-8 bg-[#99CCCC]/5 border border-[#99CCCC]/20 rounded-sm p-6 animate-in slide-in-from-bottom-2 duration-500 max-w-4xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[#99CCCC] flex items-center gap-2">
                                <Radio size={14} className="animate-pulse" />
                                NOW PLAYING (ADMIN ONLY)
                            </h3>
                            <span className="text-[10px] font-mono text-[#99CCCC]/50 uppercase tracking-tighter">Live from Server</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-black border border-[#99CCCC]/20 rounded-sm flex items-center justify-center relative overflow-hidden group">
                                <Music size={24} className="text-[#99CCCC]/20 group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#99CCCC]/10 to-transparent"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-lg font-black uppercase text-white tracking-tight truncate leading-tight mb-1">
                                    {nowPlaying.trackName || "Unknown Track"}
                                </h4>
                                <div className="flex items-center gap-3">
                                    <p className="text-xs font-bold text-[#99CCCC] uppercase tracking-widest truncate">
                                        {nowPlaying.title || "Unknown Artist"}
                                    </p>
                                    <span className="w-1 h-1 rounded-full bg-[#1a1a1a]"></span>
                                    <p className="text-[10px] font-mono text-[#444] uppercase">
                                        {nowPlaying.external_stream_url ? "External Stream" : (nowPlaying.audio_file ? "Uploaded File" : "Library Track")}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <div className="px-2 py-0.5 bg-[#99CCCC] text-black text-[9px] font-black uppercase rounded-sm tracking-tighter shadow-[0_0_10px_rgba(153,204,204,0.3)]">
                                    ON AIR
                                </div>
                                <p className="text-[9px] font-mono text-[#444] uppercase tracking-tighter">
                                    {new Date(nowPlaying.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {" — "}
                                    {new Date(nowPlaying.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {activeView === "analytics" && (
                    <AnalyticsDashboard onlineCount={onlineCount} />
                )}

                {activeView === "schedule" && (
                    <div className="p-6 bg-[#080808] border border-[#1a1a1a] rounded-sm animate-in fade-in duration-500">
                        <RadioScheduleManager artists={artists} setArtists={setArtists} dbArtists={dbArtists} />
                    </div>
                )}

                {activeView === "broadcast-list" && (
                    <BroadcastListView artists={artists} setArtists={setArtists} />
                )}

                {activeView === "database" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm">
                            <div className="flex items-center gap-4">
                                <Search className="text-[#444]" size={14} />
                                <input value={dbSearchQuery} onChange={(e) => setDbSearchQuery(e.target.value)} placeholder="Поиск в базе..." className="bg-black border border-[#1a1a1a] rounded-sm py-2 px-4 text-xs outline-none focus:border-[#99CCCC]" />
                            </div>
                            <button onClick={handleCreateMaster} className="px-4 py-2 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white transition-all">+ Новый Артист</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {dbArtists.filter(a => a.name.toLowerCase().includes(dbSearchQuery.toLowerCase())).map(a => (
                                <div key={a.id} className="group bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden flex flex-col h-full">
                                    <div className="h-40 relative">
                                        {a.image && <Image src={a.image} alt={a.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all" unoptimized />}
                                    </div>
                                    <div className="p-4 flex-1">
                                        <h4 className="text-[11px] font-black uppercase text-white mb-0.5">{a.name}</h4>
                                        <p className="text-[10px] text-[#737373]">{a.show}</p>
                                    </div>
                                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                                        <button onClick={() => handleEditArtist(a)} className="py-1 bg-[#111] text-[8px] font-black uppercase tracking-widest text-[#737373] hover:text-white transition-all">Edit</button>
                                        <button onClick={() => handleAddToSchedule(a)} className="py-1 bg-[#99CCCC]/10 text-[8px] font-black uppercase tracking-widest text-[#99CCCC] hover:bg-[#99CCCC] hover:text-black transition-all">Schedule</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {isScheduleModalOpen && selectedArtistForSchedule && (
                <ScheduleEditModal
                    artist={selectedArtistForSchedule}
                    onClose={() => { setIsScheduleModalOpen(false); setSelectedArtistForSchedule(null); }}
                    onConfirm={confirmAddToSchedule}
                    lastEndTime={artists.length > 0 ? [...artists].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0].endTime : new Date().toISOString()}
                />
            )}

            {isArtistEditModalOpen && selectedArtistForEdit && (
                <ArtistEditModal
                    artist={selectedArtistForEdit}
                    onClose={() => { setIsArtistEditModalOpen(false); setSelectedArtistForEdit(null); }}
                    onConfirm={handleSaveArtist}
                />
            )}

            {isArtistCreateModalOpen && (
                <ArtistEditModal
                    artist={{ id: "", name: "", show: "", image: "", location: "Earth", description: "" } as DBArtist}
                    onClose={() => setIsArtistCreateModalOpen(false)}
                    onConfirm={handleSaveNewArtist}
                />
            )}

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Tektur:wght@400;700;900&display=swap');
                .font-tektur { font-family: 'Tektur', sans-serif; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
            `}</style>
        </div>
    )
}

function BroadcastListView({ artists, setArtists }: { artists: any[], setArtists: (a: any) => void }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedForEdit, setSelectedForEdit] = useState<any | null>(null)
    const now = Date.now()

    const filteredArtists = [...artists]
        .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.show.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

    const handleUpdateBroadcast = (updated: any) => {
        const next = artists.map(a => a.id === updated.id ? updated : a)
        setArtists(next)
        fetch("/api/radio/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artists: next }) }).catch(() => { })
        setSelectedForEdit(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm justify-between items-center">
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="bg-black border border-[#1a1a1a] rounded-sm py-2 px-4 text-xs outline-none focus:border-[#99CCCC] w-64" />
                <div className="text-[10px] text-[#444] uppercase">{filteredArtists.length} Записей</div>
            </div>
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-[#0a0a0a] border-b border-[#1a1a1a] text-[9px] uppercase text-[#444] font-black tracking-widest">
                            <th className="p-4">Время</th>
                            <th className="p-4">Артист</th>
                            <th className="p-4">Аудио</th>
                            <th className="p-4 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredArtists.map(a => {
                            const isPast = new Date(a.endTime).getTime() < now
                            const isLive = new Date(a.startTime).getTime() <= now && new Date(a.endTime).getTime() >= now
                            return (
                                <tr key={a.id} className={`border-b border-[#1a1a1a] transition-colors ${isPast ? 'opacity-50 grayscale' : ''}`}>
                                    <td className="p-4">
                                        <p className="text-[11px] text-white font-mono">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        {isLive && <span className="text-[8px] text-[#99CCCC] animate-pulse">LIVE</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 relative bg-[#111] border border-[#1a1a1a]">
                                                {(a.broadcast_image || a.image) && <Image src={a.broadcast_image || a.image} alt={a.name} fill className="object-cover" unoptimized />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase">{a.name}</p>
                                                <p className="text-[10px] text-[#737373]">{a.show}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-white font-mono">{a.trackName || a.audio_file || "Нет"}</span>
                                            {(a.audio_file || a.audioUrl) && (
                                                <button onClick={() => new Audio(a.audioUrl || `/broadcast-media/${a.audio_file}`).play()} className="text-[8px] text-[#99CCCC] mt-1 hover:text-white uppercase transition-all flex items-center gap-1">
                                                    <Music size={8} /> Прослушать
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right space-y-1">
                                        <button onClick={() => setSelectedForEdit(a)} className="text-[9px] text-[#99CCCC] font-black uppercase tracking-widest hover:text-white px-3 py-1 bg-[#111] border border-[#1a1a1a] w-full block">Редактировать</button>
                                        <button onClick={() => setSelectedForEdit({ ...a, _tab: 'media' })} className="text-[8px] text-[#737373] uppercase hover:text-white w-full block">New Audio</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {selectedForEdit && <ScheduleEditModal artist={selectedForEdit} editItem={selectedForEdit} onClose={() => setSelectedForEdit(null)} onConfirm={handleUpdateBroadcast} lastEndTime={selectedForEdit.startTime} />}
        </div>
    )
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all ${active ? "bg-[#99CCCC] text-black shadow-lg" : "text-[#737373] hover:text-white hover:bg-[#111]"}`}>
            {icon}
            <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
        </button>
    )
}

function MetricCard({ label, value, sub, className = "" }: { label: string, value: string, sub: string, className?: string }) {
    return (
        <div className={`p-4 bg-black border border-[#1a1a1a] rounded-sm group hover:border-[#99CCCC]/30 transition-all ${className}`}>
            <p className="text-[9px] uppercase font-bold text-[#444] mb-1 tracking-widest">{label}</p>
            <p className="text-xl font-mono text-white mb-0.5">{value}</p>
            <p className="text-[8px] text-[#737373] uppercase font-medium">{sub}</p>
        </div>
    )
}

function ScheduleEditModal({ artist, onClose, onConfirm, lastEndTime, editItem }: { artist: any, onClose: () => void, onConfirm: (details: any) => void, lastEndTime: string, editItem?: any }) {
    const [name, setName] = useState(editItem?.name || artist.name)
    const [show, setShow] = useState(editItem?.show || artist.show || "")
    const [trackName, setTrackName] = useState(editItem?.trackName || "")
    const [startTime, setStartTime] = useState(editItem ? new Date(editItem.startTime).toISOString().slice(0, 19) : new Date(lastEndTime).toISOString().slice(0, 19))
    const [endTime, setEndTime] = useState(editItem ? new Date(editItem.endTime).toISOString().slice(0, 19) : new Date(new Date(lastEndTime).getTime() + 3600000).toISOString().slice(0, 19))
    const [description, setDescription] = useState(editItem?.description || "")
    const [externalStreamUrl, setExternalStreamUrl] = useState(editItem?.external_stream_url || editItem?.audioUrl || artist?.audioUrl || "")
    const [existingImage, setExistingImage] = useState(editItem?.broadcast_image || editItem?.image || null)
    const [existingAudio, setExistingAudio] = useState(editItem?.audio_file || null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [activeTab, setActiveTab] = useState<"details" | "media">(editItem?._tab === 'media' ? "media" : "details")

    const handleUpload = async (file: File) => {
        const formData = new FormData(); formData.append('broadcast_media', file)
        const res = await fetch('/api/broadcast/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        return data.filename
    }

    const handleConfirm = async () => {
        setIsUploading(true)
        try {
            let broadcast_image = existingImage
            let audio_file = existingAudio
            if (imageFile) broadcast_image = await handleUpload(imageFile)
            if (audioFile) audio_file = await handleUpload(audioFile)
            onConfirm({ ...(editItem || {}), name, show, startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), trackName, description, external_stream_url: externalStreamUrl, broadcast_image, audio_file })
        } catch (err) { alert("Upload failed") } finally { setIsUploading(false) }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex px-6 py-4 border-b border-[#1a1a1a] justify-between items-center">
                    <div className="flex gap-4">
                        <button onClick={() => setActiveTab("details")} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'details' ? 'text-[#99CCCC]' : 'text-[#444]'}`}>Детали</button>
                        <button onClick={() => setActiveTab("media")} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'media' ? 'text-[#99CCCC]' : 'text-[#444]'}`}>Медиа</button>
                    </div>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                    {activeTab === "details" ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Имя</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Шоу</label>
                                    <input value={show} onChange={e => setShow(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Композиция (Название трека)</label>
                                <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Введите название..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]" />
                            </div>
                            <div className="p-3 bg-black/40 border border-[#1a1a1a] rounded-sm space-y-2">
                                <label className="text-[8px] uppercase font-black tracking-widest text-[#555] block">Текущий аудио-источник</label>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-mono text-[#99CCCC] truncate">
                                            {audioFile ? `Загружается: ${audioFile.name}` : (externalStreamUrl || existingAudio || "Не назначен")}
                                        </p>
                                    </div>
                                    {(externalStreamUrl || existingAudio) && (
                                        <button
                                            onClick={() => new Audio(externalStreamUrl || `/broadcast-media/${existingAudio}`).play()}
                                            className="px-2 py-1 bg-[#1a1a1a] text-[#99CCCC] text-[8px] font-bold uppercase rounded-sm hover:bg-[#99CCCC] hover:text-black transition-all"
                                        >
                                            Preview
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => setActiveTab("media")}
                                    className="w-full py-1.5 mt-2 bg-white/5 hover:bg-white/10 text-[9px] uppercase font-black text-[#737373] hover:text-white transition-all border border-dashed border-[#222]"
                                >
                                    Заменить или загрузить файл
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Начало</label>
                                    <input type="datetime-local" step="1" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Конец</label>
                                    <input type="datetime-local" step="1" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-black border border-[#1a1a1a] space-y-2">
                                <label className="text-[9px] uppercase font-black text-[#444] tracking-widest block">Изображение</label>
                                <div className="flex gap-2">
                                    <input value={existingImage || ""} onChange={e => setExistingImage(e.target.value)} placeholder="URL..." className="flex-1 bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                                    <label className="px-4 flex items-center bg-[#111] border border-[#1a1a1a] text-[9px] text-[#737373] hover:text-white cursor-pointer transition-all">
                                        <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                                        {imageFile ? "✓" : "Load"}
                                    </label>
                                </div>
                            </div>
                            <div className="p-4 bg-black border border-[#1a1a1a] space-y-2">
                                <label className="text-[9px] uppercase font-black text-[#444] tracking-widest block">Аудио</label>
                                <div className="flex gap-2">
                                    <input value={externalStreamUrl || ""} onChange={e => setExternalStreamUrl(e.target.value)} placeholder="URL..." className="flex-1 bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                                    <label className="px-4 flex items-center bg-[#111] border border-[#1a1a1a] text-[9px] text-[#737373] hover:text-white cursor-pointer transition-all">
                                        <input type="file" accept="audio/*" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                                        {audioFile ? "✓" : "Load"}
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-[10px] uppercase font-black text-[#444] hover:text-white transition-all">Cancel</button>
                    <button onClick={handleConfirm} disabled={isUploading} className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg disabled:opacity-50">
                        {isUploading ? "..." : "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ArtistEditModal({ artist, onClose, onConfirm }: { artist: DBArtist, onClose: () => void, onConfirm: (updated: any) => void }) {
    const [name, setName] = useState(artist.name)
    const [show, setShow] = useState(artist.show || "")
    const [image, setImage] = useState(artist.image || "")
    const [location, setLocation] = useState(artist.location || "")
    const [description, setDescription] = useState(artist.description || "")
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        await onConfirm({ ...artist, name, show, image, location, description })
        setIsSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#080808]">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-[#99CCCC]">Редактировать Артиста</h3>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                    <input value={show} onChange={e => setShow(e.target.value)} placeholder="Шоу..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание..." className="w-full h-32 bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC] resize-none" />
                </div>
                <div className="p-6 border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-[10px] uppercase font-black text-[#444] hover:text-white transition-all">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg">{isSaving ? "..." : "Save"}</button>
                </div>
            </div>
        </div>
    )
}
