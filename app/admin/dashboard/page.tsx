"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useArtists } from "@/lib/use-artists"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Search, Radio, Users, Database, BarChart3, Bell, LogOut, ChevronRight, Plus, Calendar } from "lucide-react"
import type { DBArtist } from "@/lib/artist-db-store"
import { RadioScheduleManager } from "@/components/radio-schedule-manager"

export default function UnifiedDashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { artists, setArtists, ready } = useArtists()
    const [dbArtists, setDbArtists] = useState<DBArtist[]>([])
    const [dbSearchQuery, setDbSearchQuery] = useState("")
    const [activeView, setActiveView] = useState<"overview" | "schedule" | "database" | "analytics">("overview")

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
        const lastArtist = [...artists].sort((x, y) => new Date(y.endTime).getTime() - new Date(x.endTime).getTime())[0]
        const startTime = lastArtist ? new Date(lastArtist.endTime) : new Date()
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // Default 1h

        const newArtist = {
            id: artists.length ? Math.max(...artists.map((a: any) => a.id)) + 1 : 0,
            dbId: a.id,
            name: a.name,
            location: a.location || "Earth",
            show: a.show || "DJ Set",
            image: a.image || "/artists/artist-1.jpg",
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: "01:00:00",
            description: a.description || "Added from library",
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

        alert(`Artist ${a.name} added to site schedule!`)
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
                                        <MetricCard label="Uptime" value="99.9%" sub="Safe mode active" />
                                        <MetricCard label="Latency" value="24ms" sub="Global node OK" />
                                        <MetricCard label="Storage" value="78%" sub="Unified Music Dir" />
                                        <MetricCard label="Memory" value="1.2GB" sub="Node/Liquidsoap" />
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
                            <button className="px-4 py-2 bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white transition-all shadow-lg">
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
                                        <button className="py-1.5 bg-[#111] border border-[#1a1a1a] text-[8px] font-black uppercase tracking-widest text-[#737373] hover:text-white hover:border-[#2a2a2a] transition-all">Edit</button>
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

function MetricCard({ label, value, sub }: { label: string, value: string, sub: string }) {
    return (
        <div className="border border-[#1a1a1a] bg-black/40 p-3 rounded-sm">
            <p className="text-[9px] uppercase font-bold text-[#444] mb-1 tracking-widest">{label}</p>
            <p className="text-xl font-mono text-white mb-0.5">{value}</p>
            <p className="text-[8px] text-[#737373] uppercase font-medium">{sub}</p>
        </div>
    )
}
