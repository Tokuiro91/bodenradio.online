"use client"

import { useCallback, useMemo, useRef, useEffect } from "react"
import type { Artist } from "@/lib/artists-data"
import { getSyncedTime } from "@/hooks/use-server-time"

interface TimelineProps {
  totalArtists: number
  currentPlayingIndex: number
  visibleIndex: number
  onSeek: (index: number) => void
  artists?: Artist[]
}

const BAR_WIDTH = 40 // Each artist slot width in pixels

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
  const scrollRef = useRef<HTMLDivElement>(null)

  // Build day groups from actual artist dates
  const days = useMemo<DayGroup[]>(() => {
    if (!artists.length) return []
    const groups: DayGroup[] = []
    artists.forEach((a, i) => {
      const d = localDate(a.startTime)
      if (!groups.length || groups[groups.length - 1].date !== d) {
        groups.push({
          date: d,
          label: new Date(a.startTime)
            .toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
            })
            .toUpperCase(),
          startIndex: i,
          count: 1,
        })
      } else {
        groups[groups.length - 1].count++
      }
    })
    return groups
  }, [artists])

  // Auto-centering logic
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Prefer visibleIndex (what the user is looking at) for centering the timeline
    const targetIndex = visibleIndex >= 0 ? visibleIndex : currentPlayingIndex
    const scrollLeft = (targetIndex * BAR_WIDTH) + (BAR_WIDTH / 2) - (el.clientWidth / 2)
    el.scrollTo({ left: scrollLeft, behavior: "smooth" })
  }, [visibleIndex, currentPlayingIndex])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      const index = Math.min(
        Math.floor(ratio * totalArtists),
        totalArtists - 1
      )
      onSeek(index)
    },
    [totalArtists, onSeek]
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a]">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div
          className="relative flex flex-col"
          style={{ width: totalArtists * BAR_WIDTH, minWidth: '100%' }}
        >
          {/* ── Artist bars ── */}
          <div
            className="relative h-8 cursor-pointer group flex"
            onClick={handleClick}
            role="slider"
            aria-label="Artist navigation"
          >
            {Array.from({ length: totalArtists }).map((_, i) => {
              const isPlayed = currentPlayingIndex >= 0 && i < currentPlayingIndex
              const isPlaying = i === currentPlayingIndex
              const isVisible = i === visibleIndex
              const innerProgress = isPlaying && artists[i] ? getArtistProgress(artists[i]) : 0

              return (
                <div
                  key={i}
                  className="relative flex items-end px-px"
                  style={{ width: BAR_WIDTH, height: "100%" }}
                >
                  <div
                    className={`w-full transition-all duration-300 rounded-t-sm ${isPlaying ? "bg-[#99CCCC] h-full shadow-[0_0_8px_#99CCCC]" : isPlayed ? "bg-[#737373] h-3/5" : "bg-[#2a2a2a] h-2/5"
                      } ${isVisible ? "ring-1 ring-[#e5e5e5] h-3/4" : ""}`}
                    style={{ minHeight: "4px" }}
                  />
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

          {/* ── Day labels ── */}
          {days.length > 0 && (
            <div className="relative flex h-6">
              {days.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center border-r border-[#2a2a2a] last:border-r-0 overflow-hidden"
                  style={{ width: day.count * BAR_WIDTH }}
                >
                  <button
                    onClick={() => onSeek(day.startIndex)}
                    className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#737373] hover:text-[#99CCCC] transition-colors whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {day.label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
