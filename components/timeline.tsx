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
  const containerRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width
      const index = Math.floor((x / width) * totalArtists)
      const safeIndex = Math.max(0, Math.min(index, totalArtists - 1))
      onSeek(safeIndex)
    },
    [totalArtists, onSeek]
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a] transition-all duration-500 h-14 hover:h-24 group/timeline flex flex-col hidden md:block">
      {/* Side Fade Masks */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-20 pointer-events-none" />

      {/* ── Artist bars ── */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-end cursor-pointer px-1"
        onClick={handleClick}
      >
        {artists.map((artist, realIndex) => {
          if (!artist) return null

          const isPlayed = currentPlayingIndex >= 0 && realIndex < currentPlayingIndex
          const isPlaying = realIndex === currentPlayingIndex
          const isVisible = realIndex === visibleIndex
          const innerProgress = isPlaying ? getArtistProgress(artist) : 0

          const prevDateStr = realIndex > 0 ? localDate(artists[realIndex - 1].startTime) : null
          const currentDateStr = localDate(artist.startTime)
          const isFirstOfDay = prevDateStr !== currentDateStr

          const startDate = new Date(artist.startTime)
          const endDate = new Date(artist.endTime)
          const dateLabel = startDate.toLocaleDateString("en-US", { day: "numeric", month: "short" }).toUpperCase()
          const timeLabel = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`

          return (
            <div
              key={realIndex}
              className="relative flex-1 flex flex-col items-center group/segment h-full"
            >
              {/* Date Marker Above Slot */}
              {isFirstOfDay && (
                <div className="absolute top-1 left-[-4px] flex flex-col items-start opacity-40 group-hover/timeline:opacity-100 transition-opacity pointer-events-none">
                  <div className="w-[1px] h-3 bg-[#99CCCC] mb-1" />
                  <span className="text-[8px] font-mono whitespace-nowrap text-[#99CCCC] tracking-tighter">
                    {dateLabel}
                  </span>
                </div>
              )}

              {/* Floating Info on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 group-hover/segment:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap">
                <div className="text-[10px] font-mono text-[#99CCCC] flex flex-col items-center leading-tight bg-black/90 px-3 py-2 rounded-sm border border-[#2a2a2a] backdrop-blur-sm shadow-2xl">
                  <span className="text-[8px] opacity-60 mb-0.5">{dateLabel} • {timeLabel}</span>
                  <span className="text-white font-bold tracking-wider">{artist.name.toUpperCase()}</span>
                  <span className="text-[9px] text-[#737373] mt-0.5">{artist.show}</span>
                </div>
              </div>

              {/* Segment Container */}
              <div className="relative w-full h-full flex items-end px-[1.5px] mt-auto">
                {/* Base bar */}
                <div
                  className={`w-full transition-all duration-300 rounded-t-[1px] ${isPlaying
                    ? "bg-[#2a2a2a] h-1/2"
                    : isPlayed
                      ? "bg-[#737373] h-1/5"
                      : "bg-[#2a2a2a] h-[12%]"
                    } ${isVisible ? "ring-1 ring-[#e5e5e5]/40" : ""} group-hover/segment:bg-[#99CCCC]/80 group-hover/segment:h-1/2`}
                />

                {/* Real-time fill for playing slot */}
                {isPlaying && (
                  <div
                    className="absolute bottom-0 left-[1.5px] right-[1.5px] rounded-t-[1px] bg-[#99CCCC] transition-all duration-1000"
                    style={{
                      height: "50%",
                      clipPath: `inset(0 ${(1 - innerProgress) * 100}% 0 0)`,
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
