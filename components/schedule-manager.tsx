"use client"

import { useState, useEffect } from "react"
import { Trash2, Plus, Save, Clock, Calendar, Music } from "lucide-react"

interface ScheduleEntry {
    date: string
    time: string
    file: string
}

export function ScheduleManager() {
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [bitrate, setBitrate] = useState<number>(192)
    const [loading, setLoading] = useState(true)
    const [newEntry, setNewEntry] = useState<ScheduleEntry>({
        date: new Date().toISOString().split("T")[0],
        time: "00:00:00",
        file: ""
    })

    useEffect(() => {
        fetchSchedule()
        fetchBitrate()
    }, [])

    const fetchBitrate = async () => {
        try {
            const res = await fetch("/api/radio/bitrate")
            const data = await res.json()
            if (data.bitrate) setBitrate(data.bitrate)
        } catch (err) {
            console.error("Failed to fetch bitrate", err)
        }
    }

    const fetchSchedule = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/schedule")
            const data = await res.json()
            if (data.schedule) setSchedule(data.schedule)
        } catch (err) {
            console.error("Failed to fetch schedule", err)
        } finally {
            setLoading(false)
        }
    }

    const saveSchedule = async (updatedSchedule: ScheduleEntry[]) => {
        try {
            const res = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedule: updatedSchedule })
            })
            if (res.ok) fetchSchedule()
        } catch (err) {
            console.error("Failed to save schedule", err)
        }
    }

    const handleAddEntry = () => {
        const updated = [...schedule, newEntry]
        setSchedule(updated)
        saveSchedule(updated)
        setNewEntry({
            date: new Date().toISOString().split("T")[0],
            time: "00:00:00",
            file: ""
        })
    }

    const handleDeleteEntry = (index: number) => {
        const updated = schedule.filter((_, i) => i !== index)
        setSchedule(updated)
        saveSchedule(updated)
    }

    const handleEditEntry = (index: number, field: keyof ScheduleEntry, value: string) => {
        const updated = [...schedule]
        updated[index] = { ...updated[index], [field]: value }
        setSchedule(updated)
    }

    const handleSaveAll = () => {
        saveSchedule(schedule)
    }

    const handleBitrateChange = async (newBitrate: number) => {
        try {
            setBitrate(newBitrate)
            await fetch("/api/radio/bitrate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bitrate: newBitrate })
            })
        } catch (err) {
            console.error("Failed to update bitrate", err)
        }
    }

    if (loading) return <div className="text-white font-mono text-xs">Loading Schedule...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-[#080808] border border-[#1a1a1a] p-4 rounded-sm">
                <div className="flex items-center gap-4">
                    <h3 className="text-[#99CCCC] font-mono text-xs uppercase tracking-widest">Global Stream Bitrate</h3>
                    <div className="flex gap-2">
                        {[192, 128].map(b => (
                            <button
                                key={b}
                                onClick={() => handleBitrateChange(b)}
                                className={`px-3 py-1 text-[10px] font-black rounded-sm border transition-all ${bitrate === b ? "bg-[#99CCCC] text-black border-[#99CCCC]" : "bg-black text-[#737373] border-[#1a1a1a] hover:border-[#99CCCC]"}`}
                            >
                                {b} kbps
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-[10px] text-[#444] font-mono uppercase">Requires Liquidsoap reload if changed</div>
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] p-6 rounded-sm">
                <h3 className="text-[#99CCCC] font-mono text-sm uppercase mb-4 tracking-widest">Add Schedule Entry</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-[#444] flex items-center gap-1">
                            <Calendar size={10} /> Date
                        </label>
                        <input
                            type="date"
                            value={newEntry.date}
                            onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                            className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-[#444] flex items-center gap-1">
                            <Clock size={10} /> Time (HH:MM:SS)
                        </label>
                        <input
                            type="text"
                            placeholder="18:00:00"
                            value={newEntry.time}
                            onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                            className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC] font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-[#444] flex items-center gap-1">
                            <Music size={10} /> Audio File Path
                        </label>
                        <input
                            type="text"
                            placeholder="/radio/mixes/file.mp3"
                            value={newEntry.file}
                            onChange={(e) => setNewEntry({ ...newEntry, file: e.target.value })}
                            className="w-full bg-black border border-[#1a1a1a] p-2 text-xs text-white outline-none focus:border-[#99CCCC]"
                        />
                    </div>
                    <button
                        onClick={handleAddEntry}
                        className="bg-[#99CCCC] text-black text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-sm hover:bg-white transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={14} /> Add to Schedule
                    </button>
                </div>
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#111] uppercase font-mono text-[10px] text-[#737373]">
                            <tr>
                                <th className="px-6 py-4 border-b border-[#1a1a1a]">Date</th>
                                <th className="px-6 py-4 border-b border-[#1a1a1a]">Time</th>
                                <th className="px-6 py-4 border-b border-[#1a1a1a]">Audio File</th>
                                <th className="px-6 py-4 border-b border-[#1a1a1a] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-white">
                            {schedule.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-[#444] italic">No entries found in schedule</td>
                                </tr>
                            ) : (
                                schedule.map((entry, index) => (
                                    <tr key={index} className="border-b border-[#1a1a1a] hover:bg-[#111] transition-colors">
                                        <td className="px-6 py-3">
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => handleEditEntry(index, "date", e.target.value)}
                                                className="bg-transparent border-none outline-none focus:text-[#99CCCC]"
                                            />
                                        </td>
                                        <td className="px-6 py-3 font-mono">
                                            <input
                                                type="text"
                                                value={entry.time}
                                                onChange={(e) => handleEditEntry(index, "time", e.target.value)}
                                                className="bg-transparent border-none outline-none focus:text-[#99CCCC] w-24"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={entry.file}
                                                onChange={(e) => handleEditEntry(index, "file", e.target.value)}
                                                className="bg-transparent border-none outline-none focus:text-[#99CCCC] w-full"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteEntry(index)}
                                                className="text-[#444] hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {schedule.length > 0 && (
                    <div className="p-4 border-t border-[#1a1a1a] flex justify-end">
                        <button
                            onClick={handleSaveAll}
                            className="bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-sm hover:bg-white hover:text-black transition-all flex items-center gap-2"
                        >
                            <Save size={14} /> Save Transitions
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
