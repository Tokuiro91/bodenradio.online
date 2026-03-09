"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useArtists } from "@/lib/use-artists"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Search, Radio, Users, Database, BarChart3, Bell, LogOut, ChevronRight, Plus, Calendar, X, Clock } from "lucide-react"
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
    const [activeView, setActiveView] = useState<"overview" | "schedule" | "database" | "analytics">("overview")
    const [selectedArtistForSchedule, setSelectedArtistForSchedule] = useState<DBArtist | null>(null)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [selectedArtistForEdit, setSelectedArtistForEdit] = useState<DBArtist | null>(null)
    const [isArtistEditModalOpen, setIsArtistEditModalOpen] = useState(false)
    const [isArtistCreateModalOpen, setIsArtistCreateModalOpen] = useState(false)
    const [systemStats, setSystemStats] = useState({ storage: "...", memory: "...", cpu: "...", latency: "..." })
    const [onlineCount, setOnlineCount] = useState(0)

    // Polling System Stats & Socket Online Count
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

        // Socket for live listener count
        const socket = socketService.connect()
        socket.on("stats:update", (data: any) => {
            if (data.onlineCount !== undefined) setOnlineCount(data.onlineCount)
        })

        return () => {
            clearInterval(timer)
            socket.off("stats:update")
        }
    }, [])

    // Protect page
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

            // Update local state
            setDbArtists(prev => prev.map(a => a.id === updated.id ? updated : a))
            setIsArtistEditModalOpen(false)
            setSelectedArtistForEdit(null)
        } catch (err) {
            alert("Failed to save artist changes")
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

        // Also sync to radio engine
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
            {/* Sidebar Navigation */}
            <aside className="fixed left-0 top-0 h-full w-64 border-r border-[#1a1a1a] bg-[#080808] z-50 hidden lg:flex flex-col">
                <div className="p-6 border-b border-[#1a1a1a]">
                    <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2">
                        <span className="font-tektur text-white">BØDEN</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#99CCCC] text-black rounded-sm font-mono mt-1">HQ</span>
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <NavItem active={activeView === "overview"} onClick={() => setActiveView("overview")} icon={<Radio size={18} />} label="Overview" />
                    <NavItem active={activeView === "schedule"} onClick={() => setActiveView("schedule")} icon={<Calendar size={18} />} label="Broadcast Grid" />
                    <NavItem active={activeView === "database"} onClick={() => setActiveView("database")} icon={<Database size={18} />} label="Artist Library" />
                    <NavItem active={activeView === "analytics"} onClick={() => setActiveView("analytics")} icon={<BarChart3 size={18} />} label="Analytics" />
                    <div className="pt-4 mt-4 border-t border-[#1a1a1a]">
                        <p className="px-3 mb-2 text-[10px] uppercase text-[#444] font-bold tracking-widest">Legacy Views</p>
                        <NavItem onClick={() => router.push("/admin")} icon={<ChevronRight size={16} />} label="Old Admin Panel" />
                    </div>
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
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="lg:ml-64 p-8">
                {/* Header Summary */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-[#737373] text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span>Live System Dashboard</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">
                            {activeView === "overview" && "Command Center"}
                            {activeView === "schedule" && "Broadcast Scheduler"}
                            {activeView === "database" && "Artist Repository"}
                            {activeView === "analytics" && "Impact Metrics"}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-sm hover:bg-[#99CCCC] transition-colors shadow-lg">
                            <Plus size={16} />
                            <span>New Broadcast</span>
                        </button>
                    </div>
                </div>

                {activeView === "overview" && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        {/* Live Broadcast Section */}
                        <div className="xl:col-span-8 space-y-8">
                            <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden shadow-2xl">
                                <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
                                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                        <Radio size={14} className="text-[#99CCCC]" />
                                        Radio Engine Control
                                    </h3>
                                    <span className="text-[10px] font-mono text-[#444]">v2.2.x Sync Enabled</span>
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
                                {/* Quick System Metrics */}
                                <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 overflow-hidden relative col-span-2">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#99CCCC]/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737373] mb-6 flex items-center justify-between">
                                        System Health
                                        <BarChart3 size={14} />
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard label="CPU Load" value={systemStats.cpu} sub="Avg / 1 min" />
                                        <MetricCard label="Latency" value={systemStats.latency} sub="To 8.8.8.8" />
                                        <MetricCard label="Storage" value={systemStats.storage} sub="Root Partition" />
                                        <MetricCard label="Memory" value={systemStats.memory} sub="Used / Total" />
                                    </div>
                                </section>

                                {/* Impact Metrics */}
                                <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 overflow-hidden relative col-span-2">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737373] mb-6 flex items-center justify-between">
                                        Impact Metrics
                                        <Signal size={14} className={onlineCount > 0 ? "text-green-500 animate-pulse" : ""} />
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard
                                            label="Online Now"
                                            value={onlineCount.toString()}
                                            sub="Live Listeners"
                                            className={onlineCount > 0 ? "border-[#99CCCC]/30" : ""}
                                        />
                                        <MetricCard label="Sessions" value="---" sub="Today (Cumulative)" />
                                        <MetricCard label="Reactions" value="---" sub="Past 24h" />
                                        <MetricCard label="Favorites" value="---" sub="All Time" />
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Sidebar Tools */}
                        <div className="xl:col-span-4 space-y-8">
                            {/* Artist DB Quick Search/Select */}
                            <section className="bg-[#080808] border border-[#1a1a1a] rounded-sm p-6 shadow-xl flex flex-col h-full max-h-[600px]">
                                <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Database size={14} className="text-[#99CCCC]" />
                                    Artist Library
                                </h3>

                                <div className="relative mb-6">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" size={14} />
                                    <input
                                        value={dbSearchQuery}
                                        onChange={(e) => setDbSearchQuery(e.target.value)}
                                        placeholder="Search master records..."
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
                                    {filteredDbArtists.length === 0 && (
                                        <div className="py-20 text-center text-[#444] text-[10px] uppercase font-bold tracking-widest italic">
                                            No matching records
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setActiveView("database")}
                                    className="mt-6 w-full py-3 text-[10px] uppercase font-bold tracking-widest text-[#737373] hover:text-white border border-dashed border-[#1a1a1a] hover:border-[#2a2a2a] transition-all"
                                >
                                    View All Artists →
                                </button>
                            </section>

                            {/* Fast Push Notifications */}
                            <section className="bg-red-500/5 border border-red-500/10 rounded-sm p-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-red-500/60 mb-4 flex items-center gap-2">
                                    <Bell size={14} />
                                    Emergency Push
                                </h3>
                                <p className="text-[10px] text-[#737373] mb-4 uppercase leading-tight font-medium">Broadcast to all listeners immediately.</p>
                                <div className="space-y-3">
                                    <input placeholder="Push Title" className="w-full bg-black border border-[#2a2a2a] rounded-sm p-2 text-xs outline-none focus:border-red-500/50" />
                                    <textarea placeholder="Notification Body" className="w-full h-16 bg-black border border-[#2a2a2a] rounded-sm p-2 text-xs outline-none focus:border-red-500/50 resize-none" />
                                    <button className="w-full py-2 bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all">Send Global Alert</button>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {activeView === "analytics" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <AnalyticsDashboard />
                    </div>
                )}

                {activeView === "schedule" && (
                    <div className="p-6 bg-[#080808] border border-[#1a1a1a] rounded-sm animate-in fade-in duration-500">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-widest">Broadcast Timeline</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveView("overview")} className="text-[10px] text-[#737373] hover:text-white uppercase font-bold tracking-widest transition-colors flex items-center gap-1">
                                    <ChevronRight size={12} className="rotate-180" /> Back to Dashboard
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-black border border-[#1a1a1a] p-4 rounded-sm">
                                <RadioScheduleManager
                                    artists={artists}
                                    setArtists={setArtists}
                                    dbArtists={dbArtists}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeView === "database" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" size={14} />
                                    <input
                                        value={dbSearchQuery}
                                        onChange={(e) => setDbSearchQuery(e.target.value)}
                                        placeholder="Search Master Records..."
                                        className="bg-black border border-[#1a1a1a] rounded-sm py-2 pl-9 pr-4 text-xs outline-none focus:border-[#99CCCC] w-64 font-mono transition-all"
                                    />
                                </div>
                                <span className="text-[10px] font-mono text-[#444] uppercase tracking-widest">{dbArtists.length} Total Artists</span>
                            </div>
                            <button
                                onClick={handleCreateMaster}
                                className="px-4 py-2 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white transition-all shadow-lg"
                            >
                                + Create Master Record
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {dbArtists.filter(a => a.name.toLowerCase().includes(dbSearchQuery.toLowerCase())).map(a => (
                                <div key={a.id} className="group relative bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden hover:border-[#99CCCC]/50 transition-all flex flex-col h-full">
                                    <div className="w-full h-40 relative bg-[#111]">
                                        {a.image && <Image src={a.image} alt={a.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" unoptimized />}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <h4 className="text-[11px] font-black uppercase tracking-tighter mb-0.5 group-hover:text-[#99CCCC] transition-colors">{a.name}</h4>
                                        <p className="text-[10px] text-[#737373] line-clamp-1">{a.show}</p>
                                    </div>
                                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleEditArtist(a)}
                                            className="py-1.5 bg-[#111] border border-[#1a1a1a] text-[8px] font-black uppercase tracking-widest text-[#737373] hover:text-white hover:border-[#2a2a2a] transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleAddToSchedule(a)}
                                            className="py-1.5 bg-[#99CCCC]/10 border border-[#99CCCC]/20 text-[8px] font-black uppercase tracking-widest text-[#99CCCC] hover:bg-[#99CCCC] hover:text-black transition-all"
                                        >
                                            Schedule
                                        </button>
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
                    onClose={() => {
                        setIsScheduleModalOpen(false)
                        setSelectedArtistForSchedule(null)
                    }}
                    onConfirm={confirmAddToSchedule}
                    lastEndTime={artists.length > 0 ? [...artists].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0].endTime : new Date().toISOString()}
                />
            )}

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
                <ArtistEditModal
                    artist={{ id: "", name: "", show: "", image: "", location: "Earth", description: "" }}
                    onClose={() => setIsArtistCreateModalOpen(false)}
                    onConfirm={handleSaveNewArtist}
                />
            )}

            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Tektur:wght@400;700;900&display=swap');
        .font-tektur { font-family: 'Tektur', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
      `}</style>
        </div>
    )
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all group ${active
                ? "bg-[#99CCCC] text-black shadow-[0_0_15px_rgba(153,204,204,0.3)]"
                : "text-[#737373] hover:text-white hover:bg-[#111]"
                }`}
        >
            <span className={`${active ? "text-black" : "text-[#444] group-hover:text-[#99CCCC]"} transition-colors`}>{icon}</span>
            <span className={`text-xs font-bold uppercase tracking-tighter ${active ? "font-black" : ""}`}>{label}</span>
            {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
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

function ScheduleEditModal({ artist, onClose, onConfirm, lastEndTime }: {
    artist: DBArtist,
    onClose: () => void,
    onConfirm: (details: any) => void,
    lastEndTime: string
}) {
    const [name, setName] = useState(artist.name)
    const [show, setShow] = useState(artist.show || "")
    const [trackName, setTrackName] = useState("")
    const [startTime, setStartTime] = useState(new Date(lastEndTime).toISOString().slice(0, 19))
    const [endTime, setEndTime] = useState(new Date(new Date(lastEndTime).getTime() + 60 * 60 * 1000).toISOString().slice(0, 19))
    const [description, setDescription] = useState(artist.description || "")
    const [instagramUrl, setInstagramUrl] = useState("")
    const [soundcloudUrl, setSoundcloudUrl] = useState("")
    const [mixcloudUrl, setMixcloudUrl] = useState("")
    const [externalStreamUrl, setExternalStreamUrl] = useState("")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleUpload = async (file: File) => {
        const formData = new FormData()
        formData.append('broadcast_media', file)
        // Correct proxy endpoint
        const res = await fetch('/api/broadcast/upload', {
            method: 'POST',
            body: formData
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        return data.filename
    }

    const handleConfirm = async () => {
        setIsUploading(true)
        try {
            let broadcast_image = null
            let audio_file = null

            if (imageFile) broadcast_image = await handleUpload(imageFile)
            if (audioFile) audio_file = await handleUpload(audioFile)

            onConfirm({
                name,
                show,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                trackName,
                description,
                instagram_url: instagramUrl,
                soundcloud_url: soundcloudUrl,
                mixcloud_url: mixcloudUrl,
                external_stream_url: externalStreamUrl,
                broadcast_image,
                audio_file
            })
        } catch (err) {
            alert("Upload failed. Please check your connection.")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-[#080808] border border-[#1a1a1a] rounded-sm shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#99CCCC]" />
                        <h3 className="text-sm font-black uppercase tracking-widest">Schedule Broadcast</h3>
                    </div>
                    <button onClick={onClose} className="text-[#444] hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-black border border-[#1a1a1a] rounded-sm">
                        <div className="w-12 h-12 relative rounded-sm overflow-hidden bg-[#111]">
                            {artist.image && <Image src={artist.image} alt={artist.name} fill className="object-cover grayscale" unoptimized />}
                        </div>
                        <div>
                            <p className="text-[10px] text-[#444] uppercase font-black tracking-widest mb-0.5">Base Record</p>
                            <p className="text-xs font-bold text-white uppercase">{artist.name}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Name (Display)</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Show Title</label>
                            <input value={show} onChange={e => setShow(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Track/Set Name</label>
                        <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="e.g., Midnight Melodies Mix" className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444] flex items-center gap-1.5 line-clamp-1">
                                <Clock size={10} /> Start Time (YY-MM-DD HH:MM:SS)
                            </label>
                            <input type="datetime-local" step="1" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444] flex items-center gap-1.5 line-clamp-1">
                                <Clock size={10} /> End Time (YY-MM-DD HH:MM:SS)
                            </label>
                            <input type="datetime-local" step="1" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Custom Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Social Links (IG / SC)</label>
                            <div className="flex gap-2">
                                <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="Instagram" className="flex-1 bg-black border border-[#1a1a1a] p-2.5 text-[10px] text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                                <input value={soundcloudUrl} onChange={e => setSoundcloudUrl(e.target.value)} placeholder="SoundCloud" className="flex-1 bg-black border border-[#1a1a1a] p-2.5 text-[10px] text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Media Uploads (IMG / MP3)</label>
                            <div className="flex gap-2">
                                <label className="flex-1 flex items-center justify-center py-2 bg-[#111] border border-[#1a1a1a] text-[9px] text-[#737373] uppercase font-black tracking-widest cursor-pointer hover:text-white transition-all">
                                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                                    {imageFile ? "Image ✓" : "Photo"}
                                </label>
                                <label className="flex-1 flex items-center justify-center py-2 bg-[#111] border border-[#1a1a1a] text-[9px] text-[#737373] uppercase font-black tracking-widest cursor-pointer hover:text-white transition-all">
                                    <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} className="hidden" />
                                    {audioFile ? "Audio ✓" : "Track"}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">External Stream URL (Optional)</label>
                        <input value={externalStreamUrl} onChange={e => setExternalStreamUrl(e.target.value)} placeholder="https://stream.example.com/live" className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                    </div>
                </div>

                <div className="px-6 py-4 bg-[#0a0a0a] border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} disabled={isUploading} className="flex-1 py-3 text-[10px] uppercase font-black tracking-widest text-[#737373] hover:text-white transition-all disabled:opacity-50">Cancel</button>
                    <button
                        onClick={handleConfirm}
                        disabled={isUploading}
                        className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(153,204,204,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : "Confirm Broadcast"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ArtistEditModal({
    artist,
    onClose,
    onConfirm
}: {
    artist: DBArtist
    onClose: () => void
    onConfirm: (updated: DBArtist) => void
}) {
    const [name, setName] = useState(artist.name)
    const [show, setShow] = useState(artist.show || "")
    const [image, setImage] = useState(artist.image || "")
    const [location, setLocation] = useState(artist.location || "")
    const [instagramUrl, setInstagramUrl] = useState(artist.instagramUrl || "")
    const [soundcloudUrl, setSoundcloudUrl] = useState(artist.soundcloudUrl || "")
    const [bandcampUrl, setBandcampUrl] = useState(artist.bandcampUrl || "")
    const [audioUrl, setAudioUrl] = useState(artist.audioUrl || "")
    const [description, setDescription] = useState(artist.description || "")
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleUpload = async (file: File) => {
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('broadcast_media', file)
            const res = await fetch('/api/broadcast/upload', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setImage(`/broadcast-media/${data.filename}`)
        } catch (err) {
            alert("Upload failed")
        } finally {
            setIsUploading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        const updated: DBArtist = {
            ...artist,
            name,
            show,
            image,
            location,
            instagramUrl,
            soundcloudUrl,
            bandcampUrl,
            audioUrl,
            description
        }
        await onConfirm(updated)
        setIsSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-lg rounded-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#080808]">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-[#99CCCC]">Edit Master Artist Record</h3>
                    <button onClick={onClose} className="p-1 text-[#444] hover:text-white transition-colors"><X size={16} /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Artist Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Show Title</label>
                            <input value={show} onChange={e => setShow(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Audio URL</label>
                            <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="https://..." className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444] flex items-center justify-between">
                            Visual Resource
                            <span className="text-[8px] text-[#444]">Image URL or Upload</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={image}
                                onChange={e => setImage(e.target.value)}
                                placeholder="Paste URL manually..."
                                className="flex-1 bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono"
                            />
                            <label className="px-4 flex items-center justify-center bg-[#111] border border-[#1a1a1a] text-[8px] font-black uppercase tracking-widest text-[#737373] hover:text-white cursor-pointer transition-all">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                />
                                {isUploading ? "..." : "Upload File"}
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Instagram</label>
                            <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="Link" className="w-full bg-black border border-[#1a1a1a] p-2.5 text-[10px] text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">SoundCloud</label>
                            <input value={soundcloudUrl} onChange={e => setSoundcloudUrl(e.target.value)} placeholder="Link" className="w-full bg-black border border-[#1a1a1a] p-2.5 text-[10px] text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Bandcamp</label>
                            <input value={bandcampUrl} onChange={e => setBandcampUrl(e.target.value)} placeholder="Link" className="w-full bg-black border border-[#1a1a1a] p-2.5 text-[10px] text-white outline-none focus:border-[#99CCCC] transition-colors font-mono" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-[0.2em] text-[#444]">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-black border border-[#1a1a1a] p-2.5 text-xs text-white outline-none focus:border-[#99CCCC] transition-colors font-mono resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-[#0a0a0a] border-t border-[#1a1a1a] flex gap-3">
                    <button onClick={onClose} disabled={isSaving} className="flex-1 py-3 text-[10px] uppercase font-black tracking-widest text-[#737373] hover:text-white transition-all disabled:opacity-50">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(153,204,204,0.2)] disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Update Record"}
                    </button>
                </div>
            </div>
        </div>
    )
}
