"use client"

import { useCallback, useMemo, useEffect, useRef } from "react"
import type { Artist } from "@/lib/artists-data"
import { getSyncedTime } from "@/hooks/use-server-time"

interface TimelineProps {
  totalArtists: number
  currentPlayingIndex: number
  visibleIndex: number
  onSeek: (index: number) => void
  artists?: Artist[]
}

function getArtistProgress(artist: Artist): number {
  const now = getSyncedTime()
  const s = new Date(artist.startTime).getTime()
  const e = new Date(artist.endTime).getTime()
  if (e <= s || now < s) return 0
  if (now >= e) return 1
  return (now - s) / (e - s)
}

function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

interface DayGroup {
  label: string
  date: string
  startIndex: number
  count: number
}

export function Timeline({
  totalArtists,
  currentPlayingIndex,
  visibleIndex,
  onSeek,
  artists = [],
}: TimelineProps) {
  /**
   * Auto-scroll the timeline to center the 'visibleIndex' segment.
   * We use the middle copy (TOTAL_CARDS + index) for initial centering.
   */
  const scrollRef = useRef<HTMLDivElement>(null)
  const SEGMENT_WIDTH = 120

  useEffect(() => {
    const el = scrollRef.current
    if (!el || totalArtists === 0) return

    const viewportWidth = el.clientWidth
    if (viewportWidth === 0) return

    // Center the target segment in the MIDDLE group of 3
    const targetIndex = visibleIndex >= 0 ? visibleIndex : 0
    const targetScroll = (totalArtists + targetIndex) * SEGMENT_WIDTH + SEGMENT_WIDTH / 2 - viewportWidth / 2

    el.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    })
  }, [visibleIndex, totalArtists])

  // Infinite scroll jump logic for the timeline
  useEffect(() => {
    const el = scrollRef.current
    if (!el || totalArtists === 0) return

    const handleScroll = () => {
      const x = el.scrollLeft
      const groupWidth = totalArtists * SEGMENT_WIDTH
      const maxScroll = el.scrollWidth - el.clientWidth

      // Jump if we get too close to the edges
      // Using a buffer to avoid "flicker"
      if (x < groupWidth * 0.5) {
        el.scrollLeft = x + groupWidth
      } else if (x > maxScroll - groupWidth * 0.5) {
        el.scrollLeft = x - groupWidth
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [totalArtists])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const el = scrollRef.current
      if (!el) return

      const absoluteX = x + el.scrollLeft
      const index = Math.floor(absoluteX / SEGMENT_WIDTH) % totalArtists
      onSeek(index)
    },
    [totalArtists, onSeek]
  )

  const tripleSegments = Array.from({ length: totalArtists * 3 })

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a] transition-all duration-500 h-14 hover:h-24 group/timeline">
      {/* Side Fade Masks */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent z-20 pointer-events-none" />

      {/* ── Artist bars ── */}
      <div
        ref={scrollRef}
        className="relative w-full h-full overflow-x-auto overflow-y-hidden scrollbar-hide cursor-pointer"
        onClick={handleClick}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          className="flex h-full items-end"
          style={{ width: totalArtists * 3 * SEGMENT_WIDTH }}
        >
          {tripleSegments.map((_, i) => {
            const realIndex = i % totalArtists
            const artist = artists[realIndex]
            if (!artist) return null

            const isPlayed = currentPlayingIndex >= 0 && realIndex < currentPlayingIndex
            const isPlaying = realIndex === currentPlayingIndex
            const isVisible = realIndex === visibleIndex
            const innerProgress = isPlaying ? getArtistProgress(artist) : 0

            return (
              <div
                key={i}
                className="relative flex items-end px-px border-r border-[#2a2a2a]/20 last:border-r-0 pb-1 group/segment"
                style={{ height: "100%", width: SEGMENT_WIDTH, flexShrink: 0 }}
              >
                {/* Floating Info on Hover (Only visible when timeline is hovered) */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 group-hover/segment:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap">
                  <div className="text-[10px] font-mono text-[#99CCCC] flex flex-col items-center leading-tight">
                    <span className="mb-0.5">{new Date(artist.startTime).toLocaleDateString("en-US", { day: 'numeric', month: 'short' }).toUpperCase()}</span>
                    <span className="text-white font-bold">{artist.name.toUpperCase()}</span>
                  </div>
                </div>

                {/* Base bar */}
                <div
                  className={`w-full transition-all duration-300 rounded-t-sm ${isPlaying
                    ? "bg-[#2a2a2a] h-3/4"
                    : isPlayed
                      ? "bg-[#737373] h-2/5"
                      : "bg-[#2a2a2a] h-1/4"
                    } ${isVisible ? "ring-1 ring-[#e5e5e5]/40" : ""} group-hover/segment:bg-[#99CCCC]/80 group-hover/segment:h-1/2`}
                />

                {/* Real-time fill for playing slot */}
                {isPlaying && (
                  <div
                    className="absolute bottom-1 left-px right-px rounded-t-sm bg-[#99CCCC] transition-all duration-1000"
                    style={{
                      height: "75%",
                      clipPath: `inset(0 ${(1 - innerProgress) * 100}% 0 0)`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
