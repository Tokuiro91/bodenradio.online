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
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import useEmblaCarousel from "embla-carousel-react"

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

  // Embla Carousel Hook
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
    duration: 30
  })

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

  // Scale effect and visibility tracking
  const [slidesInView, setSlidesInView] = useState<number[]>([])
  const [scrollProgress, setScrollProgress] = useState(0)

  const onScroll = useCallback(() => {
    if (!emblaApi) return
    const progress = Math.max(0, Math.min(1, emblaApi.scrollProgress()))
    setScrollProgress(progress)

    const engine = emblaApi.internalEngine()
    const scrollSnap = emblaApi.selectedScrollSnap()
    setVisibleIndex(scrollSnap % TOTAL_CARDS)
  }, [emblaApi, TOTAL_CARDS])

  useEffect(() => {
    if (!emblaApi) return
    onScroll()
    emblaApi.on('scroll', onScroll)
    emblaApi.on('select', onScroll)
    emblaApi.on('reInit', onScroll)

    return () => {
      emblaApi.off('scroll', onScroll)
      emblaApi.off('select', onScroll)
      emblaApi.off('reInit', onScroll)
    }
  }, [emblaApi, onScroll])

  // Initial scroll to playing (or nearest upcoming) artist
  useEffect(() => {
    if (!ready || !sortedArtists.length || !emblaApi) return

    const now = getSyncedTime()
    let targetIdx = sortedArtists.findIndex(a => {
      const s = new Date(a.startTime).getTime()
      const e = new Date(a.endTime).getTime()
      return now >= s && now < e
    })
    if (targetIdx < 0) {
      targetIdx = sortedArtists.findIndex(a => new Date(a.startTime).getTime() > now)
    }
    if (targetIdx < 0) targetIdx = 0

    // Small delay to ensure Embla is ready
    setTimeout(() => {
      emblaApi.scrollTo(targetIdx, true)
    }, 100)
  }, [TOTAL_CARDS, ready, emblaApi, sortedArtists])

  const scrollToArtist = useCallback(
    (index: number) => {
      if (!emblaApi) return
      emblaApi.scrollTo(index, false)
    },
    [emblaApi]
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

      {/* Embla Carousel Area */}
      <div className="absolute inset-0 pt-16 pb-16 flex items-center overflow-hidden">
        <div className="w-full h-full overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y pt-4 pb-4">
            {sortedArtists.map((artist, i) => {
              const realIndex = i % TOTAL_CARDS

              const prevArtist = i === 0 ? null : sortedArtists[(i - 1) % TOTAL_CARDS]
              const isFirstOfDay = !prevArtist || localDate(prevArtist.startTime) !== localDate(artist.startTime)

              return (
                <div key={`${artist.id}-${i}`} className="flex-shrink-0 flex flex-col justify-center px-4" style={{ flex: '0 0 344px' }}>
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

                  <ArtistCardWrapper
                    emblaApi={emblaApi}
                    index={i}
                    artist={artist}
                    status={getStatus(i)}
                    progress={realIndex === currentPlayingIndex ? progress : 0}
                    isFavorite={userFavorites.includes(artist.id)}
                    toggleFavorite={toggleFavorite}
                  />
                </div>
              )
            })}
          </div>
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

      <Timeline
        totalArtists={TOTAL_CARDS}
        currentPlayingIndex={currentPlayingIndex}
        visibleIndex={visibleIndex}
        onSeek={scrollToArtist}
        artists={sortedArtists}
      />

      {/* Reaction picker positioned in the bottom-right of the player area */}
      <div className="absolute bottom-24 right-8 z-[9997]">
        <ReactionPicker isFixed={false} />
      </div>

    </div>
  )
}

function ArtistCardWrapper({ emblaApi, index, artist, status, progress, isFavorite, toggleFavorite }: any) {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)

  const applyStyles = useCallback(() => {
    if (!emblaApi) return
    const engine = emblaApi.internalEngine()
    const scrollProgress = emblaApi.scrollProgress()
    const slidesInView = emblaApi.slidesInView()
    const scrollSnap = emblaApi.scrollSnapList()[index]
    const scrollOffset = engine.scrollProgress

    // Calculate distance from center
    const slidePos = engine.slideLooper.loopPoints.find(lp => lp.index === index)?.target() || engine.location.get()
    // This is a bit complex due to loop, using engine.slidesInView and distances is better

    const slideLocation = engine.slidesInView.includes(index)

    // Easier way: emblaApi.scrollProgress() vs slide snap positions
    const snapPos = emblaApi.scrollSnapList()[index];
    const diff = Math.abs(emblaApi.scrollProgress() - snapPos);
    // Handle loop wrap around
    const normalizedDiff = diff > 0.5 ? 1 - diff : diff;

    // Scale from 1.0 at center to 0.85 at sides
    const s = 1 - (normalizedDiff * 0.4);
    const o = 1 - (normalizedDiff * 1.5);

    setScale(Math.max(0.85, s))
    setOpacity(Math.max(0.4, o))
  }, [emblaApi, index])

  useEffect(() => {
    if (!emblaApi) return
    applyStyles()
    emblaApi.on('scroll', applyStyles)
    return () => {
      emblaApi.off('scroll', applyStyles)
    }
  }, [emblaApi, applyStyles])

  return (
    <div style={{ transform: `scale(${scale})`, opacity: opacity, transition: 'transform 0.1s ease-out, opacity 0.1s ease-out' }}>
      <ArtistCard
        artist={artist}
        status={status}
        progress={progress}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  )
}
