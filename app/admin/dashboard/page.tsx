"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useArtists } from "@/lib/use-artists"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Search, Radio, Users, Database, BarChart3, Bell, LogOut, ChevronRight, Plus, Calendar, X, Clock, Music, Edit2, Upload, Trash2, Link as LinkIcon } from "lucide-react"
import { DBArtist } from "@/lib/artist-db-store"
import { Signal } from "lucide-react"
import { BroadcastManager } from "@/components/broadcast-manager"
import { socketService } from "@/lib/socket"
import { List, LayoutDashboard } from "lucide-react"
import { AzuracastManager } from "@/components/azuracast-manager"
import { toast } from "sonner"

export default function UnifiedDashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { artists, setArtists, ready } = useArtists()
    const [dbArtists, setDbArtists] = useState<DBArtist[]>([])
    const [dbSearchQuery, setDbSearchQuery] = useState("")
    const [activeView, setActiveView] = useState<"player" | "database" | "analytics" | "broadcast-list" | "azuracast">("player")
    const [selectedArtistForSchedule, setSelectedArtistForSchedule] = useState<DBArtist | null>(null)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [selectedArtistForEdit, setSelectedArtistForEdit] = useState<DBArtist | null>(null)
    const [isArtistEditModalOpen, setIsArtistEditModalOpen] = useState(false)
    const [isArtistCreateModalOpen, setIsArtistCreateModalOpen] = useState(false)
    const [systemStats, setSystemStats] = useState({ storage: "...", memory: "...", cpu: "...", latency: "..." })
    const [onlineCount, setOnlineCount] = useState(0)
    const [nowPlaying, setNowPlaying] = useState<any>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [azuraStats, setAzuraStats] = useState({ listeners: { current: 0 } })

    useEffect(() => {
        const fetchAzura = async () => {
            try {
                const res = await fetch("/api/azuracast/nowplaying")
                const data = await res.json()
                setAzuraStats(data)
            } catch (err) { }
        }
        fetchAzura()
        const azuraTimer = setInterval(fetchAzura, 15000)
        return () => clearInterval(azuraTimer)
    }, [])

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
                Initializing HQ...
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
                    <NavItem active={activeView === "player"} onClick={() => setActiveView("player")} icon={<Radio size={18} />} label="Player" />
                    <NavItem active={activeView === "azuracast"} onClick={() => setActiveView("azuracast")} icon={<LayoutDashboard size={18} />} label="Azuracast" />
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
                            {activeView === "player" && "Player"}
                            {activeView === "azuracast" && "Azuracast Station Manager"}
                            {activeView === "database" && "База Артистов"}
                            {activeView === "analytics" && "Аналитика"}
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 px-4 py-2 bg-black border border-[#1a1a1a] rounded-sm shadow-inner">
                            <div className="flex items-center gap-2">
                                <Users size={12} className="text-[#99CCCC]" />
                                <span className="text-[10px] font-black text-white">{azuraStats.listeners?.current || 0}</span>
                            </div>
                            <div className="w-[1px] h-3 bg-[#1a1a1a]"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#444]">Listeners Online</span>
                        </div>
                        <button
                            onClick={() => setActiveView("database")}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-sm hover:bg-[#99CCCC] transition-colors shadow-lg"
                        >
                            <Plus size={16} />
                            <span>Новый Эфир</span>
                        </button>
                    </div>
                </div>

                {activeView === "player" && (
                    <BroadcastManager />
                )}

                {activeView === "azuracast" && (
                    <AzuracastManager />
                )}

                {activeView === "analytics" && (
                    <AnalyticsDashboard onlineCount={onlineCount} systemStats={systemStats} />
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

            {isArtistEditModalOpen && selectedArtistForEdit && (
                <ArtistEditModal
                    artist={selectedArtistForEdit}
                    onClose={() => {
                        setIsArtistEditModalOpen(false)
                        setSelectedArtistForEdit(null)
                    }}
                    onConfirm={handleSaveArtist}
                />
            )}

            {isArtistCreateModalOpen && (
                <ArtistCreateModal
                    onClose={() => setIsArtistCreateModalOpen(false)}
                    onConfirm={handleSaveNewArtist}
                />
            )}

            {isScheduleModalOpen && selectedArtistForSchedule && (
                <ScheduleEditModal
                    artist={selectedArtistForSchedule}
                    onClose={() => {
                        setIsScheduleModalOpen(false)
                        setSelectedArtistForSchedule(null)
                    }}
                    onConfirm={confirmAddToSchedule}
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

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all ${active ? "bg-[#99CCCC] text-black shadow-lg" : "text-[#737373] hover:text-white hover:bg-[#111]"}`}>
            {icon}
            <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
        </button>
    )
}

function ArtistEditModal({ artist, onClose, onConfirm }: { artist: DBArtist, onClose: () => void, onConfirm: (updated: any) => void }) {
    const [name, setName] = useState(artist.name)
    const [show, setShow] = useState(artist.show || "")
    const [image, setImage] = useState(artist.image || "")
    const [location, setLocation] = useState(artist.location || "")
    const [description, setDescription] = useState(artist.description || "")
    const [instagramUrl, setInstagramUrl] = useState(artist.instagramUrl || "")
    const [soundcloudUrl, setSoundcloudUrl] = useState(artist.soundcloudUrl || "")
    const [bandcampUrl, setBandcampUrl] = useState(artist.bandcampUrl || "")
    const [audioUrl, setAudioUrl] = useState(artist.audioUrl || "")
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/azuracast/media", {
                method: "POST",
                body: formData
            })
            if (!res.ok) throw new Error("Upload failed")
            const data = await res.json()

            // AzuraCast returns the path/filename. We store it as the audioUrl.
            // If the backend returns a specific path, we use it, otherwise we assume the filename.
            const uploadedPath = data.path || file.name
            setAudioUrl(uploadedPath)
            toast.success(`Audio uploaded to AzuraCast: ${uploadedPath}`)
        } catch (err) {
            console.error(err)
            toast.error("Failed to upload audio to AzuraCast")
        } finally {
            setIsUploading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        await onConfirm({
            ...artist,
            name,
            show,
            image,
            location,
            description,
            instagramUrl,
            soundcloudUrl,
            bandcampUrl,
            audioUrl
        })
        setIsSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#080808]">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-[#99CCCC]">Редактировать Артиста</h3>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-white">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Имя</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Шоу</label>
                            <input value={show} onChange={e => setShow(e.target.value)} placeholder="Шоу..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Локация</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Локация..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Изображение (URL)</label>
                            <input value={image} onChange={e => setImage(e.target.value)} placeholder="URL..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Instagram</label>
                            <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Soundcloud</label>
                            <input value={soundcloudUrl} onChange={e => setSoundcloudUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Bandcamp</label>
                            <input value={bandcampUrl} onChange={e => setBandcampUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Audio (URL)</label>
                        <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="URL..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Описание</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание..." className="w-full h-32 bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC] resize-none" />
                    </div>
                </div>
                <div className="p-6 border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-[10px] uppercase font-black text-[#444] hover:text-white transition-all">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg">{isSaving ? "..." : "Save"}</button>
                </div>
            </div>
        </div>
    )
}

function ArtistCreateModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: (newArtist: any) => void }) {
    const [name, setName] = useState("")
    const [show, setShow] = useState("")
    const [image, setImage] = useState("")
    const [location, setLocation] = useState("Earth")
    const [description, setDescription] = useState("")
    const [instagramUrl, setInstagramUrl] = useState("")
    const [soundcloudUrl, setSoundcloudUrl] = useState("")
    const [bandcampUrl, setBandcampUrl] = useState("")
    const [audioUrl, setAudioUrl] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/azuracast/media", {
                method: "POST",
                body: formData
            })
            if (!res.ok) throw new Error("Upload failed")
            const data = await res.json()

            const uploadedPath = data.path || file.name
            setAudioUrl(uploadedPath)
            toast.success(`Audio uploaded to AzuraCast: ${uploadedPath}`)
        } catch (err) {
            console.error(err)
            toast.error("Failed to upload audio to AzuraCast")
        } finally {
            setIsUploading(false)
        }
    }

    const handleSave = async () => {
        if (!name) return alert("Имя обязательно")
        setIsSaving(true)
        await onConfirm({
            name, show, image, location, description,
            instagramUrl, soundcloudUrl, bandcampUrl, audioUrl
        })
        setIsSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#080808]">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-[#99CCCC]">Новый Артист</h3>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-white">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Имя *</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Шоу</label>
                            <input value={show} onChange={e => setShow(e.target.value)} placeholder="Шоу..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Локация</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Локация..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Изображение (URL)</label>
                            <input value={image} onChange={e => setImage(e.target.value)} placeholder="URL..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Instagram</label>
                            <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Soundcloud</label>
                            <input value={soundcloudUrl} onChange={e => setSoundcloudUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Bandcamp</label>
                            <input value={bandcampUrl} onChange={e => setBandcampUrl(e.target.value)} placeholder="URL" className="w-full bg-black border border-[#1a1a1a] p-2 text-[10px] outline-none focus:border-[#99CCCC]" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Audio (URL)</label>
                        <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="URL..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Описание</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание..." className="w-full h-32 bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC] resize-none" />
                    </div>
                </div>
                <div className="p-6 border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-[10px] uppercase font-black text-[#444] hover:text-white transition-all">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg">{isSaving ? "..." : "Create"}</button>
                </div>
            </div>
        </div>
    )
}

function ScheduleEditModal({ artist, onClose, onConfirm }: { artist: DBArtist, onClose: () => void, onConfirm: (details: any) => void }) {
    const [title, setTitle] = useState(artist.name)
    const [show, setShow] = useState(artist.show || "")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [trackName, setTrackName] = useState(artist.show || "")
    const [description, setDescription] = useState(artist.description || "")
    const [externalStreamUrl, setExternalStreamUrl] = useState(artist.audioUrl || "")
    const [audioFile, setAudioFile] = useState<string>("")
    const [broadcastImage, setBroadcastImage] = useState<string>("")

    const handleConfirm = () => {
        if (!startTime || !endTime) return alert("Выберите время")
        onConfirm({
            name: title,
            show,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            trackName,
            description,
            instagram_url: artist.instagramUrl,
            soundcloud_url: artist.soundcloudUrl,
            mixcloud_url: artist.bandcampUrl,
            audio_file: audioFile,
            broadcast_image: broadcastImage,
            external_stream_url: externalStreamUrl
        })
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#080808]">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-[#99CCCC]">Отправить в Эфир: {artist.name}</h3>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 text-white">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Начало</label>
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC] font-mono" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Конец</label>
                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC] font-mono" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[#444]">Track Name (Metadata)</label>
                        <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Artist - Track..." className="w-full bg-black border border-[#1a1a1a] p-2 text-xs outline-none focus:border-[#99CCCC]" />
                    </div>
                </div>
                <div className="p-6 border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-[10px] uppercase font-black text-[#444] hover:text-white transition-all">Cancel</button>
                    <button onClick={handleConfirm} className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg">Confirm</button>
                </div>
            </div>
        </div>
    )
}


