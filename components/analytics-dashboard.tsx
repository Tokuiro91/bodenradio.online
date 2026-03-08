"use client"

import { useState, useEffect } from "react"
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"

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

export function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("all")

    useEffect(() => {
        setLoading(true)
        fetch(`/api/analytics/stats?period=${period}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load analytics")
                return res.json()
            })
            .then((d) => {
                setData(d)
                setLoading(false)
            })
            .catch((err) => {
                setError(err.message)
                setLoading(false)
            })
    }, [period])

    if (loading && !data) return <div className="p-4 text-xs text-[#9ca3af]">Загрузка аналитики...</div>
    if (error && !data) return <div className="p-4 text-xs text-red-500">Ошибка: {error}</div>

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m}m ${s}s`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                    <h2 className="text-sm font-semibold text-[#e5e5e5]">Статистика посещений</h2>
                    <div className="flex bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm p-0.5">
                        {(["day", "week", "month", "all"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-sm transition ${period === p
                                        ? "bg-[#2a2a2a] text-[#99CCCC]"
                                        : "text-[#737373] hover:text-[#e5e5e5]"
                                    }`}
                            >
                                {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Все"}
                            </button>
                        ))}
                    </div>
                </div>
                <a
                    href="/api/analytics/export"
                    target="_blank"
                    download
                    className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-[#4b5563] text-[#9ca3af] rounded-sm hover:border-[#9ca3af] transition"
                >
                    Скачать CSV
                </a>
            </div>

            {/* ── Key Metrics ── */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">Уникальные</p>
                    <p className="text-2xl font-mono text-white">{data?.totalVisitors || 0}</p>
                    <div className="mt-2 flex gap-3 text-[9px] uppercase tracking-tighter">
                        <span className="text-[#9ca3af]">Рег: <span className="text-[#99CCCC]">{data?.registeredCount || 0}</span></span>
                        <span className="text-[#9ca3af]">Гости: <span className="text-white">{data?.guestCount || 0}</span></span>
                    </div>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">Ср. время</p>
                    <p className="text-2xl font-mono text-white">{formatDuration(data?.avgDurationS || 0)}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">СЕССИЙ ТЕКУЩИХ</p>
                    <p className="text-2xl font-mono text-white">
                        {data?.timelineData && data.timelineData.length > 0 ? data.timelineData[data.timelineData.length - 1].visitors : 0}
                    </p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <p className="text-[10px] text-[#737373] uppercase tracking-widest mb-1">СТРАН</p>
                    <p className="text-2xl font-mono text-white">{data?.geoData.length || 0}</p>
                </div>
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${loading ? "opacity-50" : ""}`}>
                {/* ── Timeline Chart ── */}
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Посетители (динамика)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.timelineData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                                <XAxis dataKey="date" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#111827", borderColor: "#2a2a2a", fontSize: "12px", color: "#fff" }}
                                    itemStyle={{ color: "#99CCCC" }}
                                />
                                <Line type="monotone" dataKey="visitors" stroke="#99CCCC" strokeWidth={2} dot={{ r: 3, fill: "#99CCCC" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Peak Hours (Heatmap approximation with BarChart) ── */}
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Пиковые часы (UTC)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.heatmapData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                                <XAxis dataKey="hour" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#111827", borderColor: "#2a2a2a", fontSize: "12px", color: "#fff" }}
                                    cursor={{ fill: "#2a2a2a" }}
                                />
                                <Bar dataKey="count" fill="#99CCCC" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${loading ? "opacity-50" : ""}`}>
                {/* ── Sources ── */}
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">Источники</h3>
                    <div className="space-y-3">
                        {data?.sourcesData.map((s) => (
                            <div key={s.name} className="flex items-center justify-between text-xs">
                                <span className="text-[#a3a3a3] capitalize">{s.name}</span>
                                <span className="font-mono text-white">{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Geo Top 10 ── */}
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 rounded-sm lg:col-span-2">
                    <h3 className="text-xs text-[#737373] uppercase tracking-widest mb-4">География (Топ 10)</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {(!data || data.geoData.length === 0) && <p className="text-xs text-[#737373]">Нет данных</p>}
                        {data?.geoData.map((g) => (
                            <div key={g.name} className="flex items-center justify-between text-xs">
                                <span className="text-[#a3a3a3] truncate pr-4" title={g.name}>{g.name}</span>
                                <span className="font-mono text-white">{g.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
        </div >
    )
}
