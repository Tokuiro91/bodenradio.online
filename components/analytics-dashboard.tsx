"use client"

import { useState, useEffect } from "react"
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Cpu, HardDrive, MemoryStick, Radio, UserCheck, Globe } from "lucide-react"

interface AnalyticsData {
    totalVisitors: number
    registeredCount: number
    guestCount: number
    avgDurationS: number
    sourcesData: { name: string; value: number }[]
    geoData: { name: string; value: number }[]
    timelineData: { date: string; visitors: number }[]
    heatmapData: { hour: number; count: number }[]
    rawSessions: any[]
}

interface OnlineData {
    totalOnline: number
    registered: { name: string; country: string | null; city: string | null; lastActive: number }[]
    anonymous: { country: string; count: number }[]
}

interface SystemStats {
    cpu: string
    memory: string
    storage: string
    latency: string
    uptime?: string
    cpuPercent?: number
    ramPercent?: number
    ramFree?: string
    ramTotal?: string
    diskFree?: string
    diskTotal?: string
    diskUsedPercent?: number
    broadcastListeners?: number
    broadcastMax?: number
    broadcastPercent?: number
    bandwidthStr?: string
}

export function AnalyticsDashboard({
    systemStats: externalStats = {}
}: {
    onlineCount?: number
    systemStats?: any
}) {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("all")
    const [icecastListeners, setIcecastListeners] = useState<number | null>(null)
    const [systemStats, setSystemStats] = useState<SystemStats>(externalStats)
    const [onlineData, setOnlineData] = useState<OnlineData | null>(null)

    // Poll Icecast listener count every 1s (via health endpoint)
    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const r = await fetch("/api/system/health")
                const d = await r.json()
                setSystemStats(d)
                if (typeof d.broadcastListeners === "number") setIcecastListeners(d.broadcastListeners)
            } catch { }
        }
        fetchHealth()
        const iv = setInterval(fetchHealth, 5_000)
        return () => clearInterval(iv)
    }, [])

    // Poll who's online every 30s
    useEffect(() => {
        const load = () => {
            fetch("/api/analytics/online")
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d) setOnlineData(d) })
                .catch(() => {})
        }
        load()
        const iv = setInterval(load, 5_000)
        return () => clearInterval(iv)
    }, [])

    // Auto-refresh analytics data every 10s
    useEffect(() => {
        const load = () => {
            setLoading(true)
            fetch(`/api/analytics/stats?period=${period}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load analytics")
                    return res.json()
                })
                .then(d => { setData(d); setLoading(false) })
                .catch(err => { setError(err.message); setLoading(false) })
        }
        load()
        const iv = setInterval(load, 10_000)
        return () => clearInterval(iv)
    }, [period])

    if (loading && !data) return <div className="p-4 text-xs text-[#9ca3af] font-mono">Загрузка аналитики...</div>
    if (error && !data) return <div className="p-4 text-xs text-red-500">Ошибка: {error}</div>

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m}m ${s}s`
    }

    const liveCount = icecastListeners ?? 0

    return (
        <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                    <h2 className="text-sm font-semibold text-[#e5e5e5]">Статистика посещений</h2>
                    <div className="flex bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm p-0.5">
                        {(["day", "week", "month", "all"] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-sm transition ${period === p ? "bg-[#2a2a2a] text-[#99CCCC]" : "text-[#737373] hover:text-[#e5e5e5]"}`}>
                                {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Все"}
                            </button>
                        ))}
                    </div>
                </div>
                <a href="/api/analytics/export" target="_blank" download
                    className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-[#4b5563] text-[#9ca3af] rounded-sm hover:border-[#9ca3af] transition">
                    Скачать CSV
                </a>
            </div>

            {/* ── Key Metrics ── */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                {/* Listeners now — live from Icecast */}
                <div className="bg-[#0a0a0a] border border-[#99CCCC]/30 p-4 rounded-sm shadow-[0_0_20px_rgba(153,204,204,0.05)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#99CCCC]/5 blur-2xl rounded-full -mr-8 -mt-8" />
                    <p className="text-[10px] text-[#99CCCC] uppercase tracking-widest mb-1 flex items-center gap-2">
                        Слушают сейчас
                        <span className={`w-1.5 h-1.5 rounded-full ${liveCount > 0 ? "bg-green-400 animate-pulse" : "bg-[#99CCCC] animate-pulse"}`} />
                    </p>
                    <p className="text-3xl font-mono text-white tracking-tighter">{liveCount}</p>
                    <p className="mt-2 text-[9px] text-[#444] uppercase font-mono">Icecast Live</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">Уникальные</p>
                    <p className="text-3xl font-mono text-white">{data?.totalVisitors || 0}</p>
                    <div className="mt-2 flex gap-3 text-[9px] uppercase tracking-tighter">
                        <span className="text-[#9ca3af]">Рег: <span className="text-[#99CCCC]">{data?.registeredCount || 0}</span></span>
                        <span className="text-[#9ca3af]">Гости: <span className="text-white">{data?.guestCount || 0}</span></span>
                    </div>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">Ср. время</p>
                    <p className="text-3xl font-mono text-white">{formatDuration(data?.avgDurationS || 0)}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">Стран</p>
                    <p className="text-3xl font-mono text-white">{data?.geoData.length || 0}</p>
                </div>
            </div>

            {/* ── System Health ── */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444] mb-3">Нагрузка на сервер</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <ServerCard
                        icon={<Cpu size={14} />}
                        label="ЦПУ"
                        value={systemStats.cpu || "—"}
                        sub={`Load avg`}
                        percent={systemStats.cpuPercent ?? parseInt(systemStats.cpu)}
                        color="#99CCCC"
                    />
                    <ServerCard
                        icon={<MemoryStick size={14} />}
                        label="ОЗУ"
                        value={systemStats.memory || "—"}
                        sub={systemStats.ramFree && systemStats.ramTotal
                            ? `${systemStats.ramFree} свободно / ${systemStats.ramTotal}`
                            : ""}
                        percent={systemStats.ramPercent ?? parseInt(systemStats.memory)}
                        color="#99CCCC"
                    />
                    <ServerCard
                        icon={<HardDrive size={14} />}
                        label="Диск"
                        value={systemStats.storage || "—"}
                        sub={systemStats.diskFree
                            ? `${systemStats.diskFree} свободно`
                            : ""}
                        percent={systemStats.diskUsedPercent ?? parseInt(systemStats.storage)}
                        color="#99CCCC"
                    />
                    <ServerCard
                        icon={<Radio size={14} />}
                        label="Трансляция"
                        value={`${systemStats.broadcastListeners ?? 0} / 100`}
                        sub={systemStats.bandwidthStr
                            ? `${systemStats.bandwidthStr} bandwidth`
                            : "max capacity = 100 listeners"}
                        percent={systemStats.broadcastPercent ?? 0}
                        color={
                            (systemStats.broadcastPercent ?? 0) > 80 ? "#f97373"
                            : (systemStats.broadcastPercent ?? 0) > 50 ? "#f97316"
                            : "#4ade80"
                        }
                    />
                </div>
            </div>

            {/* ── Charts ── */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${loading ? "opacity-50" : ""}`}>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Посетители (динамика)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.timelineData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                                <XAxis dataKey="date" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#2a2a2a", fontSize: "12px", color: "#fff" }} itemStyle={{ color: "#99CCCC" }} />
                                <Line type="monotone" dataKey="visitors" stroke="#99CCCC" strokeWidth={2} dot={{ r: 3, fill: "#99CCCC" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Пиковые часы (UTC)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.heatmapData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                                <XAxis dataKey="hour" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#2a2a2a", fontSize: "12px", color: "#fff" }} cursor={{ fill: "#2a2a2a" }} />
                                <Bar dataKey="count" fill="#99CCCC" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Sources + Geography ── */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${loading ? "opacity-50" : ""}`}>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Источники</h3>
                    <div className="space-y-3">
                        {data?.sourcesData.map(s => (
                            <div key={s.name} className="flex items-center justify-between text-xs">
                                <span className="text-[#a3a3a3] capitalize">{s.name}</span>
                                <span className="font-mono text-white">{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Geography Top 100 — scrollable */}
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs text-[#737373] uppercase tracking-widest">
                            География (Топ {data?.geoData.length || 0})
                        </h3>
                        <span className="text-[9px] font-mono text-[#333]">scrollable</span>
                    </div>
                    <div className="h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a transparent" }}>
                        {(!data || data.geoData.length === 0) && (
                            <p className="text-xs text-[#737373]">Нет данных</p>
                        )}
                        <div className="space-y-2">
                            {data?.geoData.map((g, i) => {
                                const maxVal = data.geoData[0]?.value || 1
                                const pct = Math.round((g.value / maxVal) * 100)
                                return (
                                    <div key={g.name} className="flex items-center gap-3 text-xs group">
                                        <span className="text-[9px] font-mono text-[#333] w-6 flex-shrink-0 text-right">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[#a3a3a3] truncate" title={g.name}>{g.name}</span>
                                                <span className="font-mono text-white flex-shrink-0 ml-2">{g.value}</span>
                                            </div>
                                            <div className="h-px bg-[#1a1a1a] rounded-full overflow-hidden">
                                                <div className="h-full bg-[#99CCCC]/40 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {/* ── Who's Online Now ── */}
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#444]">Сейчас на сайте</p>
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#99CCCC]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        {onlineData?.totalOnline ?? 0}
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Registered users */}
                    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a]">
                            <UserCheck size={11} className="text-[#99CCCC]" />
                            <span className="text-[10px] uppercase tracking-widest text-[#737373]">Зарегистрированные</span>
                            <span className="ml-auto font-mono text-[10px] text-[#99CCCC]">{onlineData?.registered.length ?? 0}</span>
                        </div>
                        {!onlineData || onlineData.registered.length === 0 ? (
                            <p className="px-4 py-3 text-[11px] text-[#3a3a3a] font-mono">Никого нет онлайн</p>
                        ) : (
                            <div className="divide-y divide-[#111]">
                                {onlineData.registered.map((u, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                        <span className="text-[12px] text-[#e5e5e5] font-mono flex-1 truncate">{u.name}</span>
                                        <span className="text-[10px] text-[#555] font-mono">
                                            {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Anonymous by country */}
                    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a]">
                            <Globe size={11} className="text-[#737373]" />
                            <span className="text-[10px] uppercase tracking-widest text-[#737373]">Анонимные по странам</span>
                            <span className="ml-auto font-mono text-[10px] text-[#737373]">
                                {onlineData?.anonymous.reduce((s, x) => s + x.count, 0) ?? 0}
                            </span>
                        </div>
                        {!onlineData || onlineData.anonymous.length === 0 ? (
                            <p className="px-4 py-3 text-[11px] text-[#3a3a3a] font-mono">Нет данных</p>
                        ) : (
                            <div className="divide-y divide-[#111]">
                                {onlineData.anonymous.map((a, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-[10px] font-mono text-[#555] w-5 text-right flex-shrink-0">{i + 1}</span>
                                        <span className="text-[12px] text-[#a3a3a3] font-mono flex-1">{a.country}</span>
                                        <span className="text-[12px] font-mono text-white">{a.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ServerCard({ icon, label, value, sub, percent, color }: {
    icon: React.ReactNode
    label: string
    value: string
    sub?: string
    percent: number
    color: string
}) {
    const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent))
    return (
        <div className="bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm">
            <div className="flex items-center gap-2 mb-2">
                <span style={{ color }} className="opacity-70">{icon}</span>
                <p className="text-[9px] text-[#444] uppercase font-black tracking-widest">{label}</p>
            </div>
            <div className="flex items-end justify-between mb-2">
                <span className="text-xl font-mono text-white">{value}</span>
                <span className="text-[10px] font-mono text-[#333] mb-0.5">{safePercent}%</span>
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden mb-1.5">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${safePercent}%`, backgroundColor: color }} />
            </div>
            {sub && <p className="text-[9px] font-mono text-[#333] truncate" title={sub}>{sub}</p>}
        </div>
    )
}
