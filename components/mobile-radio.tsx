"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  ChevronLeft,
  ChevronRight,
  Menu,
  ExternalLink,
  Star,
} from "lucide-react"
import { ReactionPicker } from "@/components/reaction-picker"

import type { Artist } from "@/lib/artists-data"
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
      <path d="M1.175 12.225c-.015 0-.030.01-.030.03l-.395 2.495.395 2.45c0 .02.015.03.030.03.02 0 .03-.01.03-.03l.45-2.45-.45-2.495c0-.02-.01-.03-.03-.03zm1.09-.42c-.02 0-.035.015-.035.035l-.34 2.91.34 2.855c0 .02.015.035.035.035s.035-.015.035-.035l.385-2.855-.385-2.91c0-.02-.015-.035-.035-.035zm1.11-.235c-.025 0-.04.015-.04.04L3 14.75l.335 2.82c0 .025.015.04.04.04s.04-.015.04-.04l.38-2.82-.38-2.74c0-.025-.015-.04-.04-.04zm1.12-.165c-.025 0-.045.02-.045.045l-.305 2.575.305 2.79c0 .025.02.045.045.045s.045-.02.045-.045l.345-2.79-.345-2.575c0-.025-.02-.045-.045-.045zm1.14-.105c-.03 0-.05.02-.05.05l-.275 2.43.275 2.755c0 .03.02.05.05.05s.05-.02.05-.05l.31-2.755-.31-2.43c0-.03-.02-.05-.05-.05zm1.16-.055c-.03 0-.055.025-.055.055l-.245 2.375.245 2.72c0 .03.025.055.055.055s.055-.025.055-.055l.28-2.72-.28-2.375c0-.03-.025-.055-.055-.055zm1.17-.02c-.035 0-.06.025-.06.06l-.215 2.32.215 2.685c0 .035.025.06.06.06s.06-.025.06-.06l.245-2.685-.245-2.32c0-.035-.025-.06-.06-.06zm2.47 8.22c.89 0 1.61-.72 1.61-1.61V5.6c0-.515-.305-.97-.76-1.18-.155-.07-.32-.105-.49-.105-.185 0-.36.04-.52.11-.405-1.08-1.455-1.85-2.69-1.85-1.575 0-2.85 1.28-2.85 2.855 0 .31.05.605.14.885-.035-.005-.07-.005-.105-.005-1.365 0-2.47 1.105-2.47 2.47 0 1.365 1.105 2.47 2.47 2.47h6.665z" />
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
  const [userFavorites, setUserFavorites] = useState<number[]>([])
  const miniTimelineRef = useRef<HTMLDivElement>(null)

  // Load user favorites
  useEffect(() => {
    fetch("/api/listeners/favorites")
      .then(r => r.json())
      .then(data => {
        if (data.favoriteArtists) {
          setUserFavorites(data.favoriteArtists)
        }
      })
      .catch() // Ignore if not logged in
  }, [])

  const toggleFavorite = async (artistId: number) => {
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
        if (a.type !== 'ad') return true
        const startMs = a.campaignStart ? new Date(a.campaignStart).getTime() : 0
        const endMs = a.campaignEnd ? new Date(a.campaignEnd).getTime() : Infinity
        return nowMs >= startMs && nowMs <= endMs
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

  const timeDisplay = artist ? `${formatShortTime(artist.startTime)} — ${formatShortTime(artist.endTime)}` : "--:--"

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
            <div className="flex flex-col gap-6 mt-12">
              <Link href="/login" className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                LOGIN / JOIN
              </Link>
              <Link href="/about" className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                ABOUT US
              </Link>
              <div className="mt-auto pt-12">
                <p className="text-[#737373] text-[10px] uppercase tracking-widest font-mono">
                  Crafting independent radio culture since 2024
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Time displays — Hide if Ad */}
      {!isAd && (
        <div className="flex items-center justify-center px-4 py-3 bg-[#0a0a0a]">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#737373] mb-0.5">
              Set Time
            </p>
            <p className="text-lg font-mono font-bold text-[#e5e5e5] tracking-tight">
              {timeDisplay}
            </p>
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

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />

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

              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                {!isAd && (
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[#737373] mb-0.5">
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
                    className="flex items-center gap-4 mt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(artist.id)
                      }}
                      className={`transition-colors ${userFavorites.includes(artist.id)
                        ? "text-[#99CCCC]"
                        : "text-[#737373] hover:text-[#99CCCC]"
                        }`}
                      aria-label={userFavorites.includes(artist.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={`w-5 h-5 ${userFavorites.includes(artist.id) ? "fill-current" : ""}`} />
                    </button>

                    {artist.instagramUrl && (
                      <a
                        href={artist.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#737373] hover:text-[#99CCCC] transition-colors"
                        aria-label="Instagram"
                      >
                        <InstagramIcon className="w-4 h-4" />
                      </a>
                    )}
                    {artist.soundcloudUrl && (
                      <a
                        href={artist.soundcloudUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#737373] hover:text-[#99CCCC] transition-colors"
                        aria-label="SoundCloud"
                      >
                        <SoundcloudIcon className="w-4 h-4" />
                      </a>
                    )}
                    {artist.bandcampUrl && (
                      <a
                        href={artist.bandcampUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#737373] hover:text-[#99CCCC] transition-colors"
                        aria-label="Bandcamp"
                      >
                        <BandcampIcon className="w-4 h-4" />
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

                {/* Expanded description */}
                {!isAd && (
                  <div
                    className="overflow-hidden transition-all duration-500"
                    style={{
                      maxHeight: expanded ? "100px" : "0px",
                      opacity: expanded ? 1 : 0,
                      marginTop: expanded ? "10px" : "0px",
                    }}
                  >
                    <div className="border-t border-[#ffffff]/20 pt-2">
                      <p className="text-[11px] text-[#a3a3a3] leading-relaxed">
                        {artist.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Day label */}
          {!isAd && (
            <div className="mt-2 flex items-center gap-1.5 justify-center">
              <div className="w-1.5 h-1.5 rotate-45 bg-[#99CCCC]" />
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#737373]">
                {new Date(artist.startTime).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                }).toUpperCase()}
              </span>
            </div>
          )}
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

        {/* Mini timeline - Scrollable and centering */}
        <div
          ref={miniTimelineRef}
          className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div
            className="flex items-end gap-px h-2"
            style={{ width: TOTAL * MINI_BAR_WIDTH, minWidth: '100%' }}
          >
            {sortedArtists.map((_, i) => {
              const isPlayed = currentPlayingIndex >= 0 && i < currentPlayingIndex
              const isCurrentPlaying = i === currentPlayingIndex
              const isViewing = i === viewIndex
              return (
                <button
                  key={i}
                  onClick={() => {
                    setViewIndex(i)
                    setExpanded(false)
                  }}
                  className={`flex-shrink-0 rounded-sm transition-all duration-200 ${isCurrentPlaying
                    ? "bg-[#99CCCC] h-full"
                    : isPlayed
                      ? "bg-[#737373] h-3/5"
                      : "bg-[#2a2a2a] h-2/5"
                    } ${isViewing ? "ring-1 ring-[#e5e5e5]" : ""}`}
                  style={{ width: MINI_BAR_WIDTH - 1, minHeight: "3px" }}
                  aria-label={`Artist ${i + 1}`}
                />
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
