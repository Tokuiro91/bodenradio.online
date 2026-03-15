"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Menu,
  ExternalLink,
  Star,
  Share2,
  Download,
  X,
} from "lucide-react"
import { ReactionPicker } from "@/components/reaction-picker"

import type { Artist } from "@/lib/artists-data"
import { isArtistInRollingWindow } from "@/lib/artists-data"
import { useArtists } from "@/lib/use-artists"
import { useAudioEngine } from "@/hooks/use-audio-engine"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Link from "next/link"
import Lottie from "lottie-react"
import { getSyncedTime } from "@/hooks/use-server-time"

// ── Minimal B&W social icons ──────────────────────────────────────────────────

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SoundcloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147a.272.272 0 0 1-.542 0a27.955 27.955 0 0 1 0-7.147a.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412c-.026.28-.514.283-.54 0c-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z" />
    </svg>
  )
}

function BandcampIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z" />
    </svg>
  )
}

function findCurrentArtistIndex(artists: { startTime: string; endTime: string }[]): number {
  const now = getSyncedTime()
  return artists.findIndex((a) => {
    const s = new Date(a.startTime).getTime()
    const e = new Date(a.endTime).getTime()
    return now >= s && now < e
  })
}

function calcProgress(artist: { startTime: string; endTime: string }): number {
  const now = getSyncedTime()
  const s = new Date(artist.startTime).getTime()
  const e = new Date(artist.endTime).getTime()
  if (now < s || e <= s) return 0
  if (now >= e) return 1
  return (now - s) / (e - s)
}

export function MobileRadio() {
  const { status: authStatus, data: session } = useSession()
  const { artists, ready } = useArtists()
  const [showVolume, setShowVolume] = useState(false)
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [viewIndex, setViewIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchDelta, setTouchDelta] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [userFavorites, setUserFavorites] = useState<string[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const miniTimelineRef = useRef<HTMLDivElement>(null)

  // Load user favorites whenever auth status changes
  useEffect(() => {
    if (authStatus !== "authenticated") return
    fetch("/api/listeners/favorites")
      .then(r => r.json())
      .then(data => {
        if (data.favoriteArtists) {
          setUserFavorites(data.favoriteArtists)
        }
      })
      .catch(() => { })
  }, [authStatus])

  const toggleFavorite = async (artistId: string) => {
    // Optimistic UI update
    const isFav = userFavorites.includes(artistId)
    setUserFavorites(prev =>
      isFav ? prev.filter(id => id !== artistId) : [...prev, artistId]
    )

    // TODO: Register for push notifications here in the future

    try {
      await fetch("/api/listeners/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      })
    } catch {
      // Revert on error
      setUserFavorites(prev =>
        isFav ? [...prev, artistId] : prev.filter(id => id !== artistId)
      )
    }
  }

  // Hydration-safe filtered artists
  const [filteredArtists, setFilteredArtists] = useState<Artist[]>([])

  useEffect(() => {
    const update = () => {
      const nowMs = getSyncedTime()
      const next = artists.filter(a => {
        if (!isArtistInRollingWindow(a, nowMs)) return false
        if (a.type === 'ad') {
          const startMs = a.campaignStart ? new Date(a.campaignStart).getTime() : 0
          const endMs = a.campaignEnd ? new Date(a.campaignEnd).getTime() : Infinity
          return nowMs >= startMs && nowMs <= endMs
        }
        return true
      })
      setFilteredArtists(next)
    }
    update()
    const interval = setInterval(update, 60000) // update campaign list every minute
    return () => clearInterval(interval)
  }, [artists])

  // Sort by startTime
  const sortedArtists = useMemo(
    () => [...filteredArtists].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filteredArtists]
  )
  const TOTAL = sortedArtists.length || 1

  // Audio engine
  const { isPlaying, volume, isMuted, togglePlay, setVolume, setIsMuted } =
    useAudioEngine(sortedArtists)

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date(getSyncedTime())
      setCurrentTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-navigate to live card or nearest upcoming on first load
  useEffect(() => {
    if (!ready || !sortedArtists.length) return
    const now = getSyncedTime()
    let target = sortedArtists.findIndex(a => {
      const s = new Date(a.startTime).getTime()
      const e = new Date(a.endTime).getTime()
      return now >= s && now < e
    })
    if (target < 0) {
      target = sortedArtists.findIndex(a => new Date(a.startTime).getTime() > now)
    }
    if (target >= 0) {
      setViewIndex(target)
    } else {
      setViewIndex(0)
    }
  }, [ready, sortedArtists])

  // Real-time artist tracking and mini-timeline centering
  useEffect(() => {
    if (!ready || !sortedArtists.length) return
    const tick = () => {
      const idx = findCurrentArtistIndex(sortedArtists)
      setCurrentPlayingIndex(idx)
      if (idx >= 0) setProgress(calcProgress(sortedArtists[idx]))
      else setProgress(0)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [sortedArtists, ready])

  const MINI_BAR_WIDTH = 20
  useEffect(() => {
    const el = miniTimelineRef.current
    if (!el) return
    const scrollLeft = (viewIndex * MINI_BAR_WIDTH) + (MINI_BAR_WIDTH / 2) - (el.clientWidth / 2)
    el.scrollTo({ left: scrollLeft, behavior: "smooth" })
  }, [viewIndex])

  const getStatus = useCallback(
    (i: number): "played" | "playing" | "upcoming" => {
      if (currentPlayingIndex >= 0) {
        if (i < currentPlayingIndex) return "played"
        if (i === currentPlayingIndex) return "playing"
        return "upcoming"
      }
      const a = sortedArtists[i]
      if (!a) return "upcoming"
      const now = getSyncedTime()
      const e = new Date(a.endTime).getTime()
      const s = new Date(a.startTime).getTime()
      if (now > e) return "played"
      if (now >= s) return "playing"
      return "upcoming"
    },
    [currentPlayingIndex, sortedArtists]
  )

  const navigate = (dir: number) => {
    setViewIndex((prev) => (prev + dir + TOTAL) % TOTAL)
    setExpanded(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    setTouchDelta(e.touches[0].clientX - touchStart)
  }

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 60) {
      navigate(touchDelta < 0 ? 1 : -1)
    }
    setTouchStart(null)
    setTouchDelta(0)
    setIsSwiping(false)
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
  }

  const isFirstOfItsDay = useMemo(() => {
    if (viewIndex === 0) return true
    const curr = sortedArtists[viewIndex]
    const prev = sortedArtists[viewIndex - 1]
    if (!curr || !prev) return true
    const d1 = new Date(curr.startTime)
    const d2 = new Date(prev.startTime)
    return d1.getFullYear() !== d2.getFullYear() || d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate()
  }, [viewIndex, sortedArtists])

  // --- Lottie Loader for mobile --- MUST be before any early return (Rules of Hooks)
  const currentArtistForLottie = sortedArtists[viewIndex]
  const [lottieData, setLottieData] = useState<any>(null)
  useEffect(() => {
    if (currentArtistForLottie?.type === 'ad' && currentArtistForLottie.isLottie && currentArtistForLottie.image) {
      fetch(currentArtistForLottie.image)
        .then(r => r.json())
        .then(data => setLottieData(data))
        .catch(err => console.error("Mobile Lottie load error:", err))
    } else {
      setLottieData(null)
    }
  }, [currentArtistForLottie?.id, currentArtistForLottie?.type, currentArtistForLottie?.isLottie, currentArtistForLottie?.image])

  if (!ready || !sortedArtists.length) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-tektur font-bold text-2xl tracking-wider text-[#99CCCC] animate-pulse">
            BØDEN
          </h1>
          <div className="text-[#737373] font-mono text-[10px] uppercase tracking-[0.2em]">
            Syncing Schedule...
          </div>
        </div>
      </div>
    )
  }

  const artist = sortedArtists[viewIndex]
  const status = getStatus(viewIndex)
  const prevArtist = sortedArtists[((viewIndex - 1) % TOTAL + TOTAL) % TOTAL]
  const nextArtist = sortedArtists[(viewIndex + 1) % TOTAL]

  const formatShortTime = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "--:--"
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const timeDisplay = artist ? `${new Date(artist.startTime).toLocaleDateString("en-US", { day: "numeric", month: "long" }).toUpperCase()} | ${formatShortTime(artist.startTime)} — ${formatShortTime(artist.endTime)}` : "--:--"

  const isAd = artist?.type === 'ad'

  const handleCardClick = () => {
    if (isAd && artist.redirectUrl) {
      window.open(artist.redirectUrl, "_blank", "noopener,noreferrer")
    } else {
      setExpanded(!expanded)
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0a0a0a] overflow-hidden select-none">
      {/* Mobile Header */}
      <header className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] bg-[#0a0a0a] border-b border-[#2a2a2a] z-20">
        <h1 className="font-tektur font-bold text-xl tracking-wider text-[#99CCCC]">
          BØDEN
        </h1>

        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 text-[#e5e5e5] hover:text-[#99CCCC] transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-[#0a0a0a] border-l border-[#2a2a2a] text-white">
            <SheetHeader>
              <SheetTitle className="text-[#99CCCC] font-tektur font-bold text-2xl tracking-wider">
                BØDEN
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 mt-12 px-4">
              <Link href={authStatus === "authenticated" ? "/profile" : "/login"} className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                {authStatus === "authenticated" ? "PROFILE" : "LOGIN / JOIN"}
              </Link>
              {authStatus === "authenticated" && (
                <Link
                  href="/mix-submission"
                  className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2 text-orange-500/80"
                >
                  MIX SUBMISSION
                </Link>
              )}
              <Link href="/about" className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                ABOUT US
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Time displays — Style matched to Web ArtistCard Badge */}
      {!isAd && (
        <div className="flex items-center justify-center px-4 py-4 bg-[#0a0a0a]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#1a1a1a]/80 text-[#a3a3a3] font-mono text-xs border border-[#2a2a2a]/50">
            <Clock className="w-3.5 h-3.5" />
            <span className="tracking-tight">{timeDisplay}</span>
          </div>
        </div>
      )}

      {isAd && (
        <div className="px-4 py-3 bg-[#0a0a0a] border-b border-white/5">
          <p className="text-[10px] uppercase font-mono tracking-widest text-[#99CCCC]">
            Advertisement Card
          </p>
        </div>
      )}

      {/* Main card area with swipe */}
      <div
        className="flex-1 relative flex items-center justify-center px-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous card peek (left) - Narrow strip style */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-[70vh] overflow-hidden transition-opacity duration-300 z-0"
          style={{
            transform: `translateX(${isSwiping ? touchDelta * 0.15 : 0}px) translateY(-50%)`,
            opacity: isSwiping && touchDelta > 0 ? 0.4 + (touchDelta / 200) : 0.2,
          }}
        >
          {prevArtist && (
            <Image
              src={prevArtist.image}
              alt=""
              fill
              className="object-cover grayscale"
              sizes="32px"
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Next card peek (right) - Narrow strip style */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-[70vh] overflow-hidden transition-opacity duration-300 z-0"
          style={{
            transform: `translateX(${isSwiping ? touchDelta * 0.15 : 0}px) translateY(-50%)`,
            opacity: isSwiping && touchDelta < 0 ? 0.4 + (Math.abs(touchDelta) / 200) : 0.2,
          }}
        >
          {nextArtist && (
            <Image
              src={nextArtist.image}
              alt=""
              fill
              className="object-cover grayscale"
              sizes="32px"
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Main card */}
        <div
          className="relative w-full max-w-[320px] z-10 transition-all duration-300 ease-out"
          style={{
            transform: isSwiping ? `translateX(${touchDelta}px)` : "translateX(0)",
            scale: isSwiping ? 0.9 + (1 - Math.abs(touchDelta) / 300) * 0.1 : 1,
            filter: isSwiping ? `grayscale(${Math.abs(touchDelta) / 300})` : "grayscale(0)",
          }}
        >
          {/* Cyan/Blue border frame */}
          <div className="p-[1px] bg-[#99CCCC]/30 rounded-sm">
            <div
              className={`relative w-full overflow-hidden rounded-sm cursor-pointer border border-[#2a2a2a]`}
              style={{
                aspectRatio: expanded && !isAd ? "3/4.5" : "3/4",
                transition: "aspect-ratio 0.5s ease",
              }}
              onClick={handleCardClick}
            >
              {/* Artist image / Lottie */}
              {isAd && artist.isLottie ? (
                <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
                  {lottieData && (
                    <Lottie
                      animationData={lottieData}
                      loop={true}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ) : (
                <Image
                  src={artist.image}
                  alt={artist.name}
                  fill
                  className={`object-cover transition-all duration-500 ${status === "played" && !isAd ? "grayscale brightness-50" : ""
                    }`}
                  sizes="(max-width: 768px) 100vw, 300px"
                  priority
                />
              )}

              {/* Grayscale sweep for playing (Artist only) */}
              {status === "playing" && !isAd && (
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: `inset(0 ${100 - progress * 100}% 0 0)`,
                    transition: "clip-path 1s linear",
                  }}
                >
                  <Image
                    src={artist.image}
                    alt=""
                    fill
                    className="object-cover grayscale brightness-50"
                    sizes="300px"
                    aria-hidden="true"
                  />
                </div>
              )}


              {/* Playing progress bar */}
              {status === "playing" && !isAd && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#2a2a2a]">
                  <div
                    className="h-full bg-[#99CCCC] transition-all duration-1000 linear"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}

              {/* LIVE badge */}
              {status === "playing" && !isAd && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#99CCCC] text-[#ffffff] text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse" />
                  LIVE
                </div>
              )}

              {/* Gradient overlay — bottom 50% dark, top transparent */}
              {!isAd && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 70%)", zIndex: 2 }} aria-hidden="true" />
              )}

              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 p-4" style={{ zIndex: 3 }}>
                {!isAd && (
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[#a3a3a3] mb-0.5">
                    {artist.location}
                  </p>
                )}

                <h2 className={`${isAd ? 'text-2xl' : 'text-xl'} font-bold text-[#99CCCC] leading-tight`}>
                  {artist.name}
                </h2>
                <p className={`${isAd ? 'text-sm text-[#99CCCC]' : 'text-xs text-[#a3a3a3]'} tracking-wide mt-0.5`}>
                  {artist.show}
                </p>

                {/* Social links & Favorites — Hide for ads */}
                {!isAd && (
                  <div
                    className="flex items-center gap-[11px] mt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(artist.dbId || String(artist.id))
                      }}
                      className={`transition-colors ${userFavorites.includes(artist.dbId || String(artist.id))
                        ? "text-[#99CCCC]"
                        : "text-white/70 hover:text-[#99CCCC]"
                        }`}
                      aria-label={userFavorites.includes(artist.dbId || String(artist.id)) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={`w-[22px] h-[22px] ${userFavorites.includes(artist.dbId || String(artist.id)) ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShareOpen(true)
                      }}
                      className="text-white/70 hover:text-[#99CCCC] transition-colors"
                      aria-label="Share"
                    >
                      <Share2 className="w-[22px] h-[22px]" />
                    </button>

                    {artist.instagramUrl && (
                      <a
                        href={artist.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-[#99CCCC] transition-colors"
                        aria-label="Instagram"
                      >
                        <InstagramIcon className="w-[22px] h-[22px]" />
                      </a>
                    )}
                    {artist.soundcloudUrl && (
                      <a
                        href={artist.soundcloudUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-[#99CCCC] transition-colors"
                        aria-label="SoundCloud"
                      >
                        <SoundcloudIcon className="w-[22px] h-[22px]" />
                      </a>
                    )}
                    {artist.bandcampUrl && (
                      <a
                        href={artist.bandcampUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-[#99CCCC] transition-colors"
                        aria-label="Bandcamp"
                      >
                        <BandcampIcon className="w-[22px] h-[22px]" />
                      </a>
                    )}
                  </div>
                )}

                {isAd && artist.redirectUrl && (
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40 uppercase font-mono tracking-widest">
                    <ExternalLink className="w-3 h-3" />
                    Visit Website
                  </div>
                )}

                <div className="overflow-hidden transition-all duration-500 relative" style={{
                  maxHeight: expanded ? "140px" : "0px",
                  opacity: expanded ? 1 : 0,
                  marginTop: expanded ? "10px" : "0px",
                }}>
                  <div className="border-t border-[#ffffff]/20 pt-2 h-full max-h-[140px] overflow-y-auto scrollbar-none pr-1" style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}>
                    <p className="text-[11px] text-[#a3a3a3] leading-relaxed">
                      {artist.description}
                    </p>
                  </div>
                  {/* Stylish scroll arrows */}
                  {expanded && (
                    <div className="absolute right-0 top-3 bottom-0 flex flex-col justify-between py-2 pointer-events-none opacity-40">
                      <ChevronUp className="w-2.5 h-2.5 text-[#99CCCC]" />
                      <ChevronDown className="w-2.5 h-2.5 text-[#99CCCC]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Navigation arrows (for non-touch) */}
        <button
          onClick={() => navigate(-1)}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1a1a]/80 text-[#e5e5e5] z-20 active:bg-[#99CCCC] transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(1)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1a1a]/80 text-[#e5e5e5] z-20 active:bg-[#99CCCC] transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {shareOpen && (
        <ShareModal artist={artist} onClose={() => setShareOpen(false)} isAdmin={session?.user?.role === "admin"} />
      )}

      {/* Bottom control bar */}
      <div className="bg-[#0a0a0a] border-t border-[#2a2a2a] px-3 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] z-20 flex flex-col gap-4">
        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-[#737373] font-mono">
            <Clock className="w-3 h-3" />
            {viewIndex + 1}/{TOTAL}
          </div>

          {/* Play button */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-[#99CCCC] text-[#ffffff] active:scale-95 transition-transform shadow-lg shadow-[#99CCCC]/20"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Reactions instead of Volume */}
          <div className="flex items-center justify-center w-10">
            <ReactionPicker isFixed={false} className="!p-0 !bg-transparent !border-none !shadow-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Share card modal ──────────────────────────────────────────────────────────

function ShareModal({ artist, onClose, isAdmin = false }: { artist: Artist, onClose: () => void, isAdmin?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [canShare, setCanShare] = useState(false)

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "--:--"
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const fmtTimeUTC = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "--:--"
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  }

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 1080, H = 1920
    canvas.width = W
    canvas.height = H

    const draw = (img: HTMLImageElement | null) => {
      // Background
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, W, H)

      if (img) {
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
        const iw = img.naturalWidth * scale
        const ih = img.naturalHeight * scale
        ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih)
      }

      // Top gradient
      const topG = ctx.createLinearGradient(0, 0, 0, 700)
      topG.addColorStop(0, "rgba(0,0,0,0.90)")
      topG.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = topG
      ctx.fillRect(0, 0, W, 700)

      // Bottom gradient
      const botG = ctx.createLinearGradient(0, 1050, 0, H)
      botG.addColorStop(0, "rgba(0,0,0,0)")
      botG.addColorStop(0.35, "rgba(0,0,0,0.82)")
      botG.addColorStop(1, "rgba(0,0,0,0.97)")
      ctx.fillStyle = botG
      ctx.fillRect(0, 1050, W, H - 1050)

      // — Top row — (shifted down 10% of canvas height)
      const topY = 320
      const timeDisplay = isAdmin
        ? `${fmtTimeUTC(artist.startTime)} → ${fmtTimeUTC(artist.endTime)}`
        : `${fmtTime(artist.startTime)} → ${fmtTime(artist.endTime)}`

      // Cyan dot
      ctx.beginPath()
      ctx.arc(80, topY, 14, 0, Math.PI * 2)
      ctx.fillStyle = "#99CCCC"
      ctx.fill()

      // Time string — JetBrains Mono
      ctx.font = "600 52px 'JetBrains Mono', monospace"
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(timeDisplay, 112, topY)

      // UTC+0 label for admins
      if (isAdmin) {
        const timeWidth = ctx.measureText(timeDisplay).width
        ctx.font = "500 34px 'JetBrains Mono', monospace"
        ctx.fillStyle = "rgba(153,204,204,0.75)"
        ctx.fillText(" UTC+0", 112 + timeWidth, topY)
      }

      // BØDEN logo — Tektur
      ctx.font = "500 68px 'Tektur', sans-serif"
      ctx.fillStyle = "#99CCCC"
      ctx.textAlign = "right"
      ctx.fillText("BØDEN", W - 72, topY)

      // — Bottom block —
      // Artist name (large, auto-shrink) — Space Grotesk, cyan
      const name = artist.name.toUpperCase()
      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
      let fontSize = 130
      ctx.font = `900 ${fontSize}px 'Space Grotesk', sans-serif`
      while (ctx.measureText(name).width > W - 160 && fontSize > 60) {
        fontSize -= 4
        ctx.font = `900 ${fontSize}px 'Space Grotesk', sans-serif`
      }
      ctx.fillStyle = "#99CCCC"
      ctx.fillText(name, 80, 1630)

      // Show name — Space Grotesk, white
      ctx.font = "500 52px 'Space Grotesk', sans-serif"
      ctx.fillStyle = "#ffffff"
      ctx.fillText(artist.show.toUpperCase(), 80, 1710)

      // Site URL
      ctx.font = "400 38px 'Space Grotesk', sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.38)"
      ctx.fillText("bodenradio.online", 80, 1810)

      setIsGenerating(false)
    }

    const loadFonts = async () => {
      await Promise.allSettled([
        document.fonts.load("500 100px 'Tektur'"),
        document.fonts.load("900 100px 'Space Grotesk'"),
        document.fonts.load("600 100px 'JetBrains Mono'"),
      ])
    }

    const img = new window.Image()
    img.onload = async () => { await loadFonts(); draw(img) }
    img.onerror = async () => { await loadFonts(); draw(null) }
    img.src = artist.image
  }, [artist, isAdmin])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `${artist.name.toLowerCase().replace(/\s+/g, "-")}-boden.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const handleShare = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `${artist.name}-boden.png`, { type: "image/png" })
      try {
        await navigator.share({ files: [file], title: `${artist.name} @ BØDEN` })
      } catch {
        handleDownload()
      }
    }, "image/png")
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-5 gap-5">
      <button onClick={onClose} className="absolute top-5 right-5 text-[#737373] hover:text-white transition-colors">
        <X className="w-6 h-6" />
      </button>

      {/* Canvas preview */}
      <div className="relative w-full max-w-[220px]" style={{ aspectRatio: "9/16" }}>
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] rounded-sm border border-[#2a2a2a]">
            <span className="text-[#99CCCC] text-[10px] font-mono uppercase tracking-widest animate-pulse">Generating...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-sm"
          style={{ display: isGenerating ? "none" : "block" }}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 w-full max-w-[280px]">
        {canShare && (
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#99CCCC] text-black text-[11px] font-black uppercase tracking-widest rounded-sm disabled:opacity-40"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1a1a1a] text-white text-[11px] font-black uppercase tracking-widest rounded-sm border border-[#2a2a2a] disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  )
}
