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
   */
  const scrollRef = useRef<HTMLDivElement>(null)
  const SEGMENT_WIDTH = 120

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const viewportWidth = el.clientWidth
    if (viewportWidth === 0) return

    // Center the target segment:
    // centerPos = index * SEGMENT_WIDTH + SEGMENT_WIDTH / 2
    // scrollPosition = centerPos - viewportWidth / 2
    const targetIndex = visibleIndex >= 0 ? visibleIndex : 0
    const targetScroll = targetIndex * SEGMENT_WIDTH + SEGMENT_WIDTH / 2 - viewportWidth / 2

    el.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    })
  }, [visibleIndex])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const el = scrollRef.current
      if (!el) return

      // Adjust for scroll position to find which segment was clicked
      const absoluteX = x + el.scrollLeft
      const index = Math.min(
        Math.floor(absoluteX / SEGMENT_WIDTH),
        totalArtists - 1
      )
      onSeek(index)
    },
    [totalArtists, onSeek]
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a]">
      {/* Side Fade Masks */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      {/* ── Artist bars (Fixed width, scrollable) ── */}
      <div
        ref={scrollRef}
        className="relative w-full h-8 overflow-x-auto overflow-y-hidden scrollbar-hide cursor-pointer group"
        onClick={handleClick}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          className="flex h-full"
          style={{ width: totalArtists * SEGMENT_WIDTH, paddingLeft: "0px" }}
        >
          {Array.from({ length: totalArtists }).map((_, i) => {
            const isPlayed =
              currentPlayingIndex >= 0 && i < currentPlayingIndex
            const isPlaying = i === currentPlayingIndex
            const isVisible = i === visibleIndex
            const innerProgress =
              isPlaying && artists[i] ? getArtistProgress(artists[i]) : 0

            return (
              <div
                key={i}
                className="relative flex items-end px-px border-r border-[#2a2a2a]/30 last:border-r-0"
                style={{ height: "100%", width: SEGMENT_WIDTH, flexShrink: 0 }}
              >
                {/* Base bar */}
                <div
                  className={`w-full transition-all duration-300 rounded-t-sm ${isPlaying
                    ? "bg-[#2a2a2a] h-full"
                    : isPlayed
                      ? "bg-[#737373] h-3/5"
                      : "bg-[#2a2a2a] h-2/5"
                    } ${isVisible ? "ring-1 ring-[#e5e5e5]/50" : ""}`}
                />
                {/* Real-time fill for playing slot */}
                {isPlaying && (
                  <div
                    className="absolute bottom-0 left-px right-px rounded-t-sm bg-[#99CCCC] transition-all duration-1000"
                    style={{
                      height: "100%",
                      clipPath: `inset(0 ${(1 - innerProgress) * 100}% 0 0)`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Day labels (Proportional to scrollable container) ── */}
      <div className="relative h-6 overflow-hidden">
        <div
          className="flex h-full"
          style={{
            width: totalArtists * SEGMENT_WIDTH,
            transform: scrollRef.current ? `translateX(-${scrollRef.current.scrollLeft}px)` : 'none'
          }}
        >
          {/* Note: In a pure React way, we'd sync this scroll or use the same scrollRef element. 
              But keeping it simple: labels will follow segments if they are children of the same scrollable. 
              Let's put labels INSIDE the scrollable div for perfect sync. */}
        </div>
      </div>

      {/* Simplified Day labels footer (fixed, or synced) */}
      <div className="h-4 flex items-center justify-center border-t border-[#1a1a1a]">
        <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-[#444]">
          Archive & Schedule Navigation
        </div>
      </div>
    </div>
  )
}
