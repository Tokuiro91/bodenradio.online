"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import type { Artist } from "@/lib/artists-data"
import { useArtists } from "@/lib/use-artists"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Search } from "lucide-react"
import { StickerPackManager } from "@/components/sticker-pack-manager"
import type { DBArtist } from "@/lib/artist-db-store"
import type { Listener } from "@/lib/listeners-store"
import { RadioScheduleManager } from "@/components/radio-schedule-manager"

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const s = String(totalSec % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

const defaultForm = {
  type: "artist" as "artist" | "ad",
  name: "",
  location: "",
  show: "",
  image: "",
  audioUrl: "",
  start: "",
  end: "",
  description: "",
  instagramUrl: "",
  soundcloudUrl: "",
  bandcampUrl: "",
  redirectUrl: "",
  campaignStart: "",
  campaignEnd: "",
  isLottie: false,
  dbId: "",
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const MAX_ARTISTS = 500
  const { artists, setArtists, ready } = useArtists()

  // @ts-ignore
  const isSuperAdmin = session?.user?.isSuperAdmin

  // Protect page
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login")
    }
  }, [status, router])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [dbEditingId, setDbEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"artists" | "admins" | "analytics" | "stickers" | "artist-db" | "listeners" | "radio-schedule">("analytics")
  const [dbSearchQuery, setDbSearchQuery] = useState("")
  const [artistsSearchQuery, setArtistsSearchQuery] = useState("")

  // Form state
  const [form, setForm] = useState({ ...defaultForm })

  // Upload states
  const [imageUploading, setImageUploading] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // Admins tab state
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [adminError, setAdminError] = useState("")
  const [formError, setFormError] = useState("")

  const [dbArtists, setDbArtists] = useState<DBArtist[]>([])
  const [listeners, setListeners] = useState<Listener[]>([])

  useEffect(() => {
    fetch("/api/admins").then(r => r.json()).then(d => d.admins && setAdminEmails(d.admins)).catch(() => { })
    fetch("/api/artist-db").then(r => r.json()).then(setDbArtists).catch(() => { })
  }, [])

  useEffect(() => {
    if (activeTab === "listeners" && listeners.length === 0) {
      fetch("/api/listeners").then(r => r.json()).then(setListeners).catch(() => { })
    }
  }, [activeTab, listeners.length])

  // Handle cross-iframe sync from Radio Dashboard
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_SCHEDULE') {
        const { event: syncEvent } = event.data
        if (syncEvent && syncEvent.artist_id) {
          const artistId = parseInt(syncEvent.artist_id)
          setArtists(prev => {
            const next = prev.map(a => {
              if (a.id === artistId) {
                return {
                  ...a,
                  startTime: new Date(syncEvent.start_time).toISOString(),
                  endTime: new Date(syncEvent.end_time).toISOString(),
                }
              }
              return a
            })

            // Persist the sync automatically
            fetch("/api/artists", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                artists: next,
                newId: artistId
              }),
            }).catch(err => console.error("Sync persist error:", err))

            return next
          })
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setArtists])

  const addAdmin = async () => {
    if (!newAdminEmail.includes("@")) {
      setAdminError("Введи корректный email")
      return
    }
    const res = await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newAdminEmail }),
    })
    const d = await res.json()
    if (d.admins) { setAdminEmails(d.admins); setNewAdminEmail(""); setAdminError("") }
  }

  const removeAdmin = async (email: string) => {
    const res = await fetch("/api/admins", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const d = await res.json()
    if (d.admins) setAdminEmails(d.admins)
  }

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/image", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) setForm((f) => ({ ...f, image: data.url }))
    } catch {
      // ignore
    } finally {
      setImageUploading(false)
    }
  }

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/audio", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) setForm((f) => ({ ...f, audioUrl: data.url }))
    } catch {
      // ignore
    } finally {
      setAudioUploading(false)
    }
  }

  const handleEdit = (artist: Artist) => {
    setEditingId(artist.id)
    setForm({
      name: artist.name,
      location: artist.location,
      show: artist.show,
      image: artist.image,
      audioUrl: artist.audioUrl ?? "",
      start: artist.startTime?.slice(0, 19) ?? "",
      end: artist.endTime?.slice(0, 19) ?? "",
      description: artist.description,
      instagramUrl: artist.instagramUrl ?? "",
      soundcloudUrl: artist.soundcloudUrl ?? "",
      bandcampUrl: artist.bandcampUrl ?? "",
      type: artist.type ?? "artist",
      redirectUrl: artist.redirectUrl ?? "",
      campaignStart: artist.campaignStart?.slice(0, 19) ?? "",
      campaignEnd: artist.campaignEnd?.slice(0, 19) ?? "",
      isLottie: !!artist.isLottie,
      dbId: artist.dbId ?? "",
    })
  }

  const handleDbEdit = (a: DBArtist) => {
    setDbEditingId(a.id)
    setEditingId(null)
    setForm({
      ...defaultForm,
      name: a.name,
      location: a.location,
      show: a.show,
      image: a.image,
      audioUrl: a.audioUrl ?? "",
      description: a.description,
      instagramUrl: a.instagramUrl ?? "",
      soundcloudUrl: a.soundcloudUrl ?? "",
      bandcampUrl: a.bandcampUrl ?? "",
      dbId: a.id,
    })
    setActiveTab("artists")
  }

  const handleDbScheduleNew = (a: DBArtist) => {
    setEditingId(null)
    setDbEditingId(null)
    setForm({
      ...defaultForm,
      name: a.name,
      location: a.location,
      show: a.show,
      image: a.image,
      audioUrl: a.audioUrl ?? "",
      description: a.description,
      instagramUrl: a.instagramUrl ?? "",
      soundcloudUrl: a.soundcloudUrl ?? "",
      bandcampUrl: a.bandcampUrl ?? "",
      dbId: a.id,
    })
    setActiveTab("artists")
  }

  const resetForm = () => {
    setEditingId(null)
    setDbEditingId(null)
    setForm({ ...defaultForm })
    if (imageInputRef.current) imageInputRef.current.value = ""
    if (audioInputRef.current) audioInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isEditing = editingId !== null
    if (!isEditing && artists.length >= MAX_ARTISTS) {
      setFormError(`Максимум (${MAX_ARTISTS}) артистов достигнуто.`)
      return
    }
    setFormError("")

    // For Ads, we might not have start/end broadcast times in the same way, but let's keep them valid
    const startDate = form.start ? new Date(form.start) : new Date()
    const endDate = form.end
      ? new Date(form.end)
      : new Date(startDate.getTime() + 60 * 60 * 1000)
    const durationMs = endDate.getTime() - startDate.getTime()

    const newArtist: Artist = {
      id: editingId ?? (artists.length ? Math.max(...artists.map((a) => a.id)) + 1 : 0),
      dbId: form.dbId || undefined,
      name: form.name || (form.type === 'ad' ? "Untitled Ad" : "Без имени"),
      location: form.location || "Earth",
      show: form.show || (form.type === 'ad' ? "Advertisement" : "Новый сет"),
      image: form.image || "/artists/artist-1.jpg",
      audioUrl: form.audioUrl || undefined,
      duration: formatDuration(durationMs),
      description: form.description || "...",
      dayIndex: 0,
      orderInDay: 0,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      instagramUrl: form.instagramUrl || undefined,
      soundcloudUrl: form.soundcloudUrl || undefined,
      bandcampUrl: form.bandcampUrl || undefined,
      type: form.type,
      redirectUrl: form.type === 'ad' ? form.redirectUrl : undefined,
      campaignStart: form.type === 'ad' && form.campaignStart ? new Date(form.campaignStart).toISOString() : undefined,
      campaignEnd: form.type === 'ad' && form.campaignEnd ? new Date(form.campaignEnd).toISOString() : undefined,
      isLottie: form.type === 'ad' ? form.isLottie : undefined,
    }

    const nextArtists = isEditing
      ? artists.map((a) => (a.id === editingId ? newArtist : a))
      : [...artists, newArtist]

    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artists: nextArtists,
          newId: newArtist.id
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error ?? `Ошибка сервера (${res.status})`)
        return
      }
    } catch {
      setFormError("Нет соединения с сервером")
      return
    }

    setArtists(nextArtists)

    // Trigger Radio Schedule Sync
    fetch("/api/radio/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artists: nextArtists }),
    }).catch(() => { })

    // ── MASTER DB SYNC ──────────────────────────────────────────────
    if (form.type === 'artist' && form.name) {
      const artistData = {
        name: form.name,
        location: form.location || "Earth",
        show: form.show || "Новый сет",
        image: form.image || "/artists/artist-1.jpg",
        description: form.description || "...",
        audioUrl: form.audioUrl || "",
        instagramUrl: form.instagramUrl || "",
        soundcloudUrl: form.soundcloudUrl || "",
        bandcampUrl: form.bandcampUrl || "",
      }

      const existingId = dbEditingId || form.dbId || dbArtists.find(a => a.name === form.name)?.id

      if (existingId) {
        // Update existing master record
        fetch("/api/artist-db", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existingId, ...artistData }),
        }).then(r => r.json()).then(updatedA => {
          if (updatedA && updatedA.id) {
            setDbArtists(prev => prev.map(a => a.id === updatedA.id ? updatedA : a))
            // If we were ONLY editing the master record, we can stop here
            if (dbEditingId && !isEditing) {
              resetForm()
            }
          }
        }).catch(() => { })
      } else {
        // Create new master record
        fetch("/api/artist-db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(artistData),
        }).then(r => r.json()).then(newA => {
          if (newA && newA.id) {
            setDbArtists(prev => [...prev, newA])
            // Link the same ID if we just created it while scheduling
            newArtist.dbId = newA.id
          }
        }).catch(() => { })
      }
    }

    if (dbEditingId && !isEditing) return // Skip schedule saving if only editing master

    // ── SCHEDULE SAVING ─────────────────────────────────────────────

    resetForm()
  }

  const handleDelete = (id: number) => {
    const next = artists.filter((a) => a.id !== id)
    setArtists(next)
    // Persist delete
    fetch("/api/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })

    // Trigger Radio Schedule Sync
    fetch("/api/radio/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artists: next }),
    }).catch(() => { })
    if (editingId === id) resetForm()
  }

  if (status === "loading" || !ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-[#9ca3af] font-mono text-[10px] uppercase tracking-widest">
        Loading...
      </div>
    )
  }

  const filteredDbArtists = dbArtists.filter(a =>
    a.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
    a.show.toLowerCase().includes(dbSearchQuery.toLowerCase())
  )

  const sortedArtists = [...artists].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  ).filter(a =>
    a.name.toLowerCase().includes(artistsSearchQuery.toLowerCase()) ||
    a.show.toLowerCase().includes(artistsSearchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5]">
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold tracking-wide">
            <span className="font-tektur">BØDEN</span> <span className="text-[#737373]">/ ADMIN</span>
          </h1>
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("radio-schedule")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "radio-schedule" ? "bg-white text-black font-bold" : "text-[#737373] hover:text-white"}`}>Эфир Радио</button>
            <button onClick={() => setActiveTab("artists")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "artists" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>Расписание</button>
            <button onClick={() => setActiveTab("artist-db")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "artist-db" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>База Артистов</button>
            <button onClick={() => setActiveTab("admins")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "admins" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>Администраторы</button>
            <button onClick={() => setActiveTab("listeners")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "listeners" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>Слушатели</button>
            <button onClick={() => setActiveTab("analytics")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "analytics" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>Аналитика</button>
            {isSuperAdmin && (
              <button onClick={() => setActiveTab("stickers")} className={`px-3 py-1 text-xs rounded-sm transition ${activeTab === "stickers" ? "bg-[#99CCCC] text-black font-bold" : "text-[#737373] hover:text-white"}`}>Стикеры</button>
            )}
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="text-xs text-[#737373] hover:text-white transition px-3 py-1 border border-[#2a2a2a] rounded-sm">Выйти</button>
      </header>

      {activeTab === "radio-schedule" && (
        <div className="p-6">
          <RadioScheduleManager
            artists={artists}
            setArtists={setArtists}
            dbArtists={[
              ...dbArtists,
              ...artists.map(a => ({
                id: `timeline-${a.id}`,
                name: a.name,
                show: a.show,
                image: a.image
              })).filter(ta => !dbArtists.some(da => da.name === ta.name && da.show === ta.show))
            ]}
          />
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="p-6">
          <AnalyticsDashboard />
        </div>
      )}

      {activeTab === "stickers" && isSuperAdmin && (
        <div className="p-6 max-w-4xl max-h-[85vh] overflow-y-auto">
          <StickerPackManager />
        </div>
      )}

      {activeTab === "admins" && (
        <div className="px-6 py-6 max-w-lg">
          <h2 className="text-sm font-semibold mb-4 text-[#99CCCC] font-mono">AD MANAGER LIST</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="email@gmail.com"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]"
            />
            <button onClick={addAdmin} className="px-3 py-1.5 text-xs bg-[#99CCCC] text-black font-bold rounded-sm hover:bg-white transition">Добавить</button>
          </div>
          {adminError && <p className="text-xs text-red-400 mb-3">{adminError}</p>}
          <ul className="space-y-2">
            {adminEmails.map((email) => (
              <li key={email} className="flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-3 py-2">
                <span className="text-xs font-mono text-[#e5e5e5]">{email}</span>
                {email.toLowerCase() !== "chyrukoleksii@gmail.com" && (
                  <button onClick={() => removeAdmin(email)} className="text-[10px] text-[#737373] hover:text-red-400 transition">Удалить</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "listeners" && (
        <div className="px-6 py-6 max-w-4xl">
          <h2 className="text-sm font-semibold mb-4 text-[#99CCCC] font-mono">РЕГИСТРАЦИИ ({listeners.length})</h2>
          <div className="overflow-x-auto bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm">
            <table className="w-full text-left text-xs text-[#e5e5e5]">
              <thead className="bg-[#111] uppercase font-mono text-[10px] text-[#737373]">
                <tr>
                  <th className="px-4 py-3 border-b border-[#2a2a2a]">Имя</th>
                  <th className="px-4 py-3 border-b border-[#2a2a2a]">Email</th>
                  <th className="px-4 py-3 border-b border-[#2a2a2a]">Провайдер</th>
                  <th className="px-4 py-3 border-b border-[#2a2a2a]">Роль</th>
                  <th className="px-4 py-3 border-b border-[#2a2a2a]">Избранные</th>
                </tr>
              </thead>
              <tbody>
                {listeners.map(l => (
                  <tr key={l.id} className="border-b border-[#2a2a2a] hover:bg-[#111]">
                    <td className="px-4 py-3 font-semibold">{l.name}</td>
                    <td className="px-4 py-3 text-[#99CCCC]">{l.email}</td>
                    <td className="px-4 py-3 uppercase text-[10px]">{l.provider}</td>
                    <td className="px-4 py-3 uppercase text-[10px]">{l.role}</td>
                    <td className="px-4 py-3 text-[10px] font-mono">{l.favoriteArtists?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "artist-db" && (
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#99CCCC] font-mono">БАЗА АРТИСТОВ ({filteredDbArtists.length})</h2>
            <div className="flex items-center bg-black border border-[#1a1a1a] rounded-sm px-2 py-1">
              <Search size={12} className="text-[#444] mr-2" />
              <input
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Поиск в базе..."
                className="bg-transparent border-none outline-none text-[10px] font-mono uppercase text-white w-48"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              className="border border-dashed border-[#2a2a2a] rounded-sm p-4 h-32 flex flex-col items-center justify-center cursor-pointer hover:border-[#99CCCC] transition group"
              onClick={() => {
                setActiveTab("artists")
                setForm({ ...defaultForm })
                setEditingId(null)
              }}
            >
              <p className="text-[#737373] font-mono text-xs uppercase group-hover:text-[#99CCCC] text-center mb-1">+ Создать в расписании</p>
              <p className="text-[9px] text-[#444] text-center px-4">Артисты автоматически добавляются в базу при сохранении в расписание</p>
            </div>
            {filteredDbArtists.map(a => (
              <div key={a.id} className="border border-[#2a2a2a] bg-[#0a0a0a] rounded-sm overflow-hidden flex flex-col group relative">
                <div className="w-full h-32 relative bg-[#111]">
                  {a.image && <Image src={a.image} alt={a.name} fill className="object-cover" unoptimized />}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-[11px] uppercase truncate">{a.name}</h3>
                  <p className="text-[10px] text-[#737373] truncate w-full">{a.show}</p>
                </div>
                <div className="mt-auto p-2 grid grid-cols-2 gap-2 border-t border-[#1a1a1a]">
                  <button onClick={() => handleDbEdit(a)} className="py-1 text-[8px] uppercase font-mono bg-[#111] text-[#99CCCC] border border-[#1a1a1a] hover:bg-[#1a1a1a] transition">Edit Master</button>
                  <button onClick={() => handleDbScheduleNew(a)} className="py-1 text-[8px] uppercase font-mono bg-[#99CCCC] text-black font-bold hover:bg-white transition">+ To Grid</button>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${a.name} from base?`)) {
                      fetch(`/api/artist-db?id=${a.id}`, { method: "DELETE" }).then(() => setDbArtists(curr => curr.filter(x => x.id !== a.id)))
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "artists" && (
        <main className="px-6 py-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">{form.type === 'ad' ? 'ADVERTISEMENT SETUP' : 'ARTIST SETUP'}</h2>
              <p className="text-[11px] text-[#6b7280]">Slot usage: <span className="text-[#e5e5e5]">{artists.length}</span> / {MAX_ARTISTS}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm bg-[#0a0a0a] p-4 border border-[#1a1a1a] rounded-sm">
              {isSuperAdmin && (
                <div>
                  <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Entry Type</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'artist' }))} className={`flex-1 py-1.5 text-[10px] font-mono border rounded-sm transition ${form.type === 'artist' ? 'bg-white text-black border-white' : 'border-[#2a2a2a] text-[#737373]'}`}>ARTIST</button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'ad' }))} className={`flex-1 py-1.5 text-[10px] font-mono border rounded-sm transition ${form.type === 'ad' ? 'bg-[#99CCCC] text-black border-[#99CCCC]' : 'border-[#2a2a2a] text-[#737373]'}`}>ADVERTISEMENT</button>
                  </div>
                </div>
              )}

              {form.type === 'artist' && dbArtists.length > 0 && !editingId && (
                <div>
                  <label className="block mb-2 text-[10px] uppercase font-mono text-[#99CCCC]">Выбрать из Базы</label>
                  <select
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-sm px-2 py-2 text-xs outline-none focus:border-[#e5e5e5] text-white"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const a = dbArtists.find(x => x.id === e.target.value);
                      if (a) {
                        setForm(f => ({
                          ...f,
                          name: a.name,
                          location: a.location,
                          show: a.show,
                          image: a.image,
                          audioUrl: a.audioUrl || "",
                          description: a.description,
                          instagramUrl: a.instagramUrl || "",
                          soundcloudUrl: a.soundcloudUrl || "",
                          bandcampUrl: a.bandcampUrl || "",
                        }))
                      }
                    }}
                  >
                    <option value="">-- Новый Артист --</option>
                    {dbArtists.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.show})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">{form.type === 'ad' ? 'Banner Title' : 'Artist Name'}</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">{form.type === 'ad' ? 'Slogan' : 'Show Name'}</label>
                <input value={form.show} onChange={(e) => setForm(f => ({ ...f, show: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
              </div>

              {/* Social Links (Moved up for better visibility) */}
              {form.type !== 'ad' && (
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#1a1a1a]">
                  <div>
                    <label className="block mb-1 text-[9px] uppercase font-mono text-[#99CCCC]">Instagram</label>
                    <input value={form.instagramUrl} onChange={(e) => setForm(f => ({ ...f, instagramUrl: e.target.value }))} className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-[#e5e5e5]" placeholder="URL" />
                  </div>
                  <div>
                    <label className="block mb-1 text-[9px] uppercase font-mono text-[#99CCCC]">Soundcloud</label>
                    <input value={form.soundcloudUrl} onChange={(e) => setForm(f => ({ ...f, soundcloudUrl: e.target.value }))} className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-[#e5e5e5]" placeholder="URL" />
                  </div>
                  <div>
                    <label className="block mb-1 text-[9px] uppercase font-mono text-[#99CCCC]">Bandcamp</label>
                    <input value={form.bandcampUrl} onChange={(e) => setForm(f => ({ ...f, bandcampUrl: e.target.value }))} className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-[#e5e5e5]" placeholder="URL" />
                  </div>
                </div>
              )}

              {form.type === 'ad' && (
                <>
                  <div>
                    <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Redirect URL</label>
                    <input type="url" value={form.redirectUrl} onChange={(e) => setForm(f => ({ ...f, redirectUrl: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC] text-[#99CCCC]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="lottie" checked={form.isLottie} onChange={(e) => setForm(f => ({ ...f, isLottie: e.target.checked }))} className="accent-[#99CCCC]" />
                    <label htmlFor="lottie" className="text-[10px] uppercase font-mono text-[#737373]">Lottie JSON Format</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Campaign Start</label>
                      <input type="datetime-local" value={form.campaignStart} onChange={(e) => setForm(f => ({ ...f, campaignStart: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Campaign End</label>
                      <input type="datetime-local" value={form.campaignEnd} onChange={(e) => setForm(f => ({ ...f, campaignEnd: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
                    </div>
                  </div>
                </>
              )}

              {form.type !== 'ad' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Start Broadcast</label>
                    <input type="datetime-local" step="1" value={form.start} onChange={(e) => setForm(f => ({ ...f, start: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">End Broadcast</label>
                    <input type="datetime-local" step="1" value={form.end} onChange={(e) => setForm(f => ({ ...f, end: e.target.value }))} className="w-full bg-black border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-xs outline-none focus:border-[#99CCCC]" />
                  </div>
                </div>
              )}

              {/* Shared Photo section */}
              <div>
                <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Visual Resource (Image/JSON URL)</label>
                {form.image && !form.isLottie && (
                  <div className="relative w-full h-24 mb-2 border border-[#1a1a1a] rounded-sm overflow-hidden">
                    <Image src={form.image} alt="preview" fill className="object-cover" unoptimized />
                  </div>
                )}
                <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full py-1.5 border border-[#1a1a1a] rounded-sm text-[10px] font-mono text-[#737373] hover:text-white transition">UPLOAD FILE</button>
                <input ref={imageInputRef} type="file" className="hidden" onChange={handleImageFile} />
                <input value={form.image} onChange={(e) => setForm(f => ({ ...f, image: e.target.value }))} className="mt-2 w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-[#737373]" placeholder="Paste URL manually..." />
              </div>


              <div>
                <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Broadcast Audio URL</label>
                <input value={form.audioUrl} onChange={(e) => setForm(f => ({ ...f, audioUrl: e.target.value }))} className="w-full bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-white" />
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase font-mono text-[#737373]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full h-20 bg-black border border-[#1a1a1a] rounded-sm px-2 py-1 text-[10px] font-mono text-white outline-none focus:border-[#99CCCC]"
                  placeholder="Enter broadcast description..."
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-[#99CCCC] text-black font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-white transition">
                  {dbEditingId ? 'Update Master' : (editingId ? 'Save Entry' : 'Create Entry')}
                </button>
                {(editingId || dbEditingId) && <button type="button" onClick={resetForm} className="px-4 py-2 border border-[#2a2a2a] text-[10px] font-mono uppercase text-[#737373]">Cancel</button>}
              </div>
              {formError && <p className="text-[10px] text-red-400 font-mono mt-2">{formError}</p>}
            </form>
          </div>

          <section className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-3 ">
              <h2 className="text-sm font-semibold font-mono text-[#737373]">LIVE GRID / SCHEDULE </h2>
              <div className="flex items-center bg-black border border-[#1a1a1a] rounded-sm px-2 py-1">
                <Search size={12} className="text-[#444] mr-2" />
                <input
                  value={artistsSearchQuery}
                  onChange={(e) => setArtistsSearchQuery(e.target.value)}
                  placeholder="Поиск в сетке..."
                  className="bg-transparent border-none outline-none text-[10px] font-mono uppercase text-white w-32"
                />
              </div>
            </div>
            <div className="max-h-[85vh] overflow-y-auto space-y-2 pr-2">
              {sortedArtists.map((artist) => (
                <div key={artist.id} className={`p-4 border group transition-colors flex items-center justify-between ${editingId === artist.id ? 'border-[#99CCCC] bg-[#111]' : 'border-[#1a1a1a] bg-[#080808] hover:border-[#333]'}`}>
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => handleEdit(artist)}>
                    <div className="relative w-12 h-12 bg-[#1a1a1a] rounded-sm overflow-hidden flex-shrink-0">
                      {artist.image && <Image src={artist.image} alt="" fill className={`object-cover ${artist.type === 'ad' ? 'opacity-90' : ''}`} sizes="48px" unoptimized />}
                      {artist.type === 'ad' && <div className="absolute top-0 right-0 bg-[#99CCCC] text-black text-[7px] font-bold px-1 py-0.5">AD</div>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase tracking-wider">{artist.name}</p>
                      <p className="text-[10px] text-[#737373] uppercase">{artist.show}</p>
                      <div className="mt-1 flex gap-2 text-[9px] font-mono">
                        {artist.type === 'ad' ? (
                          <span className="text-[#99CCCC]">CAMPAIGN: {artist.campaignEnd?.slice(5, 10) || 'UNTIL STOP'}</span>
                        ) : (
                          <span className="text-[#737373]">{artist.startTime.slice(11, 16)} - {artist.endTime.slice(11, 16)} UTC</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(artist.id); }} className="p-2 text-[#444] hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>
      )
      }
    </div >
  )
}
