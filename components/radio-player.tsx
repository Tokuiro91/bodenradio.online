"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Header } from "@/components/header"
import { ArtistCard } from "@/components/artist-card"
import { Timeline } from "@/components/timeline"
import { useArtists } from "@/lib/use-artists"
import { Clock, ExternalLink } from "lucide-react"
import { ReactionPicker } from "@/components/reaction-picker"
import type { Artist } from "@/lib/artists-data"
import { useAudioEngine } from "@/hooks/use-audio-engine"
import { useServerTimeSync, setGlobalTimeOffset, getSyncedTime } from "@/hooks/use-server-time"

/** Returns index of currently-playing artist (by real clock), or -1 */
function findCurrentArtistIndex(artists: { startTime: string; endTime: string }[]): number {
  const now = getSyncedTime()
  return artists.findIndex((a) => {
    const s = new Date(a.startTime).getTime()
    const e = new Date(a.endTime).getTime()
    return now >= s && now < e
  })
}

/** Progress [0..1] for a given artist based on real time */
function calcProgress(artist: { startTime: string; endTime: string }): number {
  const now = getSyncedTime()
  const s = new Date(artist.startTime).getTime()
  const e = new Date(artist.endTime).getTime()
  if (now < s || e <= s) return 0
  if (now >= e) return 1
  return (now - s) / (e - s)
}

/** Local calendar date string — so grouping respects the user's timezone */
function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function RadioPlayer() {
  // ── ALL HOOKS MUST BE CALLED UNCONDITIONALLY BEFORE ANY EARLY RETURN ────────
  const { artists, ready } = useArtists()
  const { offset } = useServerTimeSync()

  useEffect(() => {
    setGlobalTimeOffset(offset)
  }, [offset])

  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [now, setNow] = useState(0)
  const [userFavorites, setUserFavorites] = useState<number[]>([])

  useEffect(() => {
    fetch("/api/listeners/favorites")
      .then(r => r.json())
      .then(data => {
        if (data.favoriteArtists) setUserFavorites(data.favoriteArtists)
      })
      .catch()
  }, [])

  const toggleFavorite = async (artistId: number) => {
    const isFav = userFavorites.includes(artistId)
    setUserFavorites(prev => isFav ? prev.filter(id => id !== artistId) : [...prev, artistId])
    try {
      await fetch("/api/listeners/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      })
    } catch {
      setUserFavorites(prev => isFav ? [...prev, artistId] : prev.filter(id => id !== artistId))
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const CARD_WIDTH = 450

  const sortedArtists = useMemo(
    () => [...artists].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [artists]
  )
  const TOTAL_CARDS = sortedArtists.length

  const audioEngine = useAudioEngine(sortedArtists)
  const { isPlaying, volume, isMuted, togglePlay, setVolume, setIsMuted } = audioEngine

  // Real-time tracking: currentPlayingIndex + progress every second
  useEffect(() => {
    if (!ready || !sortedArtists.length) return
    const tick = () => {
      setNow(getSyncedTime())
      const idx = findCurrentArtistIndex(sortedArtists)
      setCurrentPlayingIndex(idx)
      setProgress(idx >= 0 ? calcProgress(sortedArtists[idx]) : 0)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [sortedArtists, ready])

  // Calculate center offsets for all cards based on scroll position
  const [scrollX, setScrollX] = useState(0)

  useEffect(() => {
    if (!ready) return
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const x = el.scrollLeft
      setScrollX(x)

      // Infinite loop jump
      const maxScroll = el.scrollWidth - el.clientWidth
      if (x <= 0) {
        el.scrollLeft = CARD_WIDTH * TOTAL_CARDS
      } else if (x >= maxScroll - 2) {
        el.scrollLeft = CARD_WIDTH * TOTAL_CARDS
      }

      // Update visible index based on center
      const centerX = x + el.clientWidth / 2
      const idx = Math.floor(centerX / CARD_WIDTH) % TOTAL_CARDS
      setVisibleIndex(idx)
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [TOTAL_CARDS, ready, CARD_WIDTH])

  const getCenterOffset = (index: number) => {
    const el = scrollRef.current
    if (!el) return 0
    // Each container is exactly CARD_WIDTH
    const cardCenter = (index * CARD_WIDTH) + (CARD_WIDTH / 2)
    const viewportCenter = scrollX + el.clientWidth / 2
    const dist = Math.abs(cardCenter - viewportCenter)
    // Range of influence: 1.2 cards
    const threshold = CARD_WIDTH * 1.5
    return Math.max(0, 1 - dist / threshold)
  }

  // Drag scroll (LMB hold + drag)
  useEffect(() => {
    if (!ready) return
    const el = scrollRef.current
    if (!el) return
    let isDragging = false
    let startX = 0
    let scrollStart = 0

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      startX = e.clientX
      scrollStart = el.scrollLeft
      el.style.cursor = "grabbing"
      el.style.userSelect = "none"
      el.style.scrollSnapType = "none"
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - startX
      el.scrollLeft = scrollStart - dx
    }
    const onMouseUp = () => {
      isDragging = false
      el.style.cursor = ""
      el.style.userSelect = ""
      el.style.scrollSnapType = "x mandatory"
    }

    el.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      el.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [ready])

  // Wheel scroll (vertical → horizontal)
  useEffect(() => {
    if (!ready) return
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.style.scrollSnapType = "none"
      el.scrollLeft += e.deltaY

      // Resume snap after a short delay
      clearTimeout((el as any).snapTimeout)
        ; (el as any).snapTimeout = setTimeout(() => {
          el.style.scrollSnapType = "x mandatory"
        }, 500)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [ready])

  // Initial scroll to playing (or nearest upcoming) artist — centered
  useEffect(() => {
    if (!ready || !sortedArtists.length) return

    const scrollInitial = () => {
      const el = scrollRef.current
      if (!el) return

      const viewportWidth = el.clientWidth
      if (viewportWidth === 0) return

      // Find the live artist index, or the nearest upcoming one
      const nowMs = getSyncedTime()
      let targetIdx = sortedArtists.findIndex(a => {
        const s = new Date(a.startTime).getTime()
        const e = new Date(a.endTime).getTime()
        return nowMs >= s && nowMs < e
      })
      if (targetIdx < 0) {
        targetIdx = sortedArtists.findIndex(a => new Date(a.startTime).getTime() > nowMs)
      }
      if (targetIdx < 0) targetIdx = 0

      // CORRECT FORMULA INCLUDING 40dvw PADDING:
      // paddingLeft = 0.4 * viewportWidth
      // cardCenterInContainer = paddingLeft + (TOTAL_CARDS + targetIdx) * CARD_WIDTH + CARD_WIDTH / 2
      // scrollLeft = cardCenterInContainer - viewportWidth / 2
      const paddingLeft = 0.4 * viewportWidth
      const targetScroll =
        paddingLeft + (TOTAL_CARDS + targetIdx) * CARD_WIDTH + (CARD_WIDTH / 2) - (viewportWidth / 2)

      el.scrollTo({ left: targetScroll, behavior: "instant" })
      setScrollX(targetScroll)
      setVisibleIndex(targetIdx)
    }

    // Multiple passes to ensure we catch the late-loading layout/fonts
    scrollInitial()
    const t1 = setTimeout(scrollInitial, 150)
    const t2 = setTimeout(scrollInitial, 600)
    const t3 = setTimeout(scrollInitial, 1500)
    const t4 = setTimeout(scrollInitial, 3000)

    window.addEventListener('resize', scrollInitial)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      window.removeEventListener('resize', scrollInitial)
    }
  }, [TOTAL_CARDS, ready, sortedArtists])

  const scrollToArtist = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el) return
      const targetScroll =
        CARD_WIDTH * (TOTAL_CARDS + index) - el.clientWidth / 2 + CARD_WIDTH / 2
      el.scrollTo({ left: targetScroll, behavior: "smooth" })
    },
    [TOTAL_CARDS]
  )

  const getStatus = useCallback(
    (index: number): "played" | "playing" | "upcoming" => {
      const realIndex = index % TOTAL_CARDS
      if (currentPlayingIndex >= 0) {
        if (realIndex < currentPlayingIndex) return "played"
        if (realIndex === currentPlayingIndex) return "playing"
        return "upcoming"
      }
      const artist = sortedArtists[realIndex]
      if (!artist) return "upcoming"
      const end = new Date(artist.endTime).getTime()
      const start = new Date(artist.startTime).getTime()
      if (now > end) return "played"
      if (now >= start) return "playing"
      return "upcoming"
    },
    [currentPlayingIndex, TOTAL_CARDS, sortedArtists, now]
  )

  // Countdown logic
  const nextArtist = useMemo(() => {
    if (currentPlayingIndex >= 0) return null
    return sortedArtists.find((a) => new Date(a.startTime).getTime() > now) || null
  }, [currentPlayingIndex, sortedArtists, now])

  const tripleArtists = useMemo(() => {
    if (!sortedArtists.length) return []
    return [...sortedArtists, ...sortedArtists, ...sortedArtists]
  }, [sortedArtists])

  // ── GUARD: Only after ALL hooks ─────────────────────────────────────────────
  if (!ready || !sortedArtists.length) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#737373] font-mono text-[10px] uppercase tracking-widest animate-pulse">
          Establishing uplink...
        </div>
      </div>
    )
  }

  let countdownStr = ""
  if (nextArtist) {
    const diff = new Date(nextArtist.startTime).getTime() - now
    if (diff > 0) {
      const totalSec = Math.floor(diff / 1000)
      const h = String(Math.floor(totalSec / 3600)).padStart(2, "0")
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
      const s = String(totalSec % 60).padStart(2, "0")
      countdownStr = `${h !== "00" ? h + ":" : ""}${m}:${s}`
    }
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a]">
      <Header
        volume={volume}
        isMuted={isMuted}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onVolumeChange={setVolume}
        onMuteToggle={() => setIsMuted(!isMuted)}
      />

      {/* Background ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#99CCCC]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#99CCCC]/5 rounded-full blur-[100px]" />
      </div>

      {/* Horizontal scroll area */}
      <div
        ref={scrollRef}
        className="absolute inset-0 pt-16 pb-16 flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-center gap-6 px-8" style={{ minWidth: "max-content" }}>
          {tripleArtists.map((artist, i) => {
            const realIndex = i % TOTAL_CARDS

            const prevDate =
              i === 0
                ? null
                : localDate(sortedArtists[(i - 1) % TOTAL_CARDS].startTime)
            const thisDate = localDate(sortedArtists[realIndex].startTime)
            const isFirstOfDay = prevDate !== thisDate

            const sawtoothPeriod = 6
            const t = (realIndex % sawtoothPeriod) / sawtoothPeriod
            const waveOffset = (1 - t) * 150 - 75

            return (
              <div
                key={`${artist.id}-${i}`}
                ref={(el) => { cardRefs.current[i] = el }}
                className="flex-shrink-0 transition-transform duration-500"
                style={{ transform: `translateY(${waveOffset}px)` }}
              >
                {isFirstOfDay && (
                  <div className="flex items-center gap-2 mb-3 pl-1">
                    <div className="w-2 h-2 rotate-45 bg-[#99CCCC]" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#99CCCC]">
                      {new Date(artist.startTime).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                      }).toUpperCase()}
                    </span>
                    <div className="flex-1 h-px bg-[#2a2a2a]" />
                  </div>
                )}

                <ArtistCard
                  artist={artist}
                  status={getStatus(i)}
                  progress={realIndex === currentPlayingIndex ? progress : 0}
                  isFavorite={userFavorites.includes(artist.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Countdown UI */}
      {countdownStr && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40">
          <div className="backdrop-blur-xl bg-black/60 border border-[#2a2a2a] px-6 py-3 rounded-full flex gap-3 items-center shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-[#99CCCC] animate-pulse" />
            <span className="text-xs text-[#a3a3a3] uppercase tracking-widest">BROADCAST STARTS IN</span>
            <span className="text-sm font-mono text-white tracking-[0.2em]">{countdownStr}</span>
          </div>
        </div>
      )}

      {/* Timeline removed per user request */}

      {/* Reaction picker positioned in the bottom-right of the player area */}
      <div className="absolute bottom-24 right-8 z-[9997]">
        <ReactionPicker isFixed={false} />
      </div>

    </div>
  )
}
