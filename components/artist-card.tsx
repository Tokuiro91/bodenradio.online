"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Clock, ExternalLink, Star } from "lucide-react"
import type { Artist } from "@/lib/artists-data"
import { SolariText } from "@/components/solari-text"
import Lottie from "lottie-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getSyncedTime } from "@/hooks/use-server-time"

// ── Minimal B&W social icons ──────────────────────────────────────────────────

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.2" fill="currentColor" stroke="none" />
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-10h12l-6 10H3z" />
    </svg>
  )
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Format a Date as HH:MM in the user's local timezone */
function formatLocalTime(date: Date): string {
  if (isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Format a Date as HH:MM in UTC for the studio tooltip */
function formatUTCTime(date: Date): string {
  if (isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
}

// ─────────────────────────────────────────────────────────────────────────────

interface ArtistCardProps {
  artist: Artist
  status?: "played" | "playing" | "upcoming"
  progress?: number
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
}

export function ArtistCard({ artist, status, progress: externalProgress = 0, isFavorite, onToggleFavorite }: ArtistCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(getSyncedTime())

  // Update clock every second using synced time
  useEffect(() => {
    const interval = setInterval(() => setNow(getSyncedTime()), 1000)
    return () => clearInterval(interval)
  }, [])


  const start = useMemo(() => new Date(artist.startTime), [artist.startTime])
  const end = useMemo(() => new Date(artist.endTime), [artist.endTime])

  const isValidStart = !isNaN(start.getTime())
  const isValidEnd = !isNaN(end.getTime())

  const localIsPlaying = isValidStart && isValidEnd && now >= start.getTime() && now <= end.getTime()
  const localIsPlayed = isValidEnd && now > end.getTime()
  const effectiveStatus: "played" | "playing" | "upcoming" =
    status ?? (localIsPlaying ? "playing" : localIsPlayed ? "played" : "upcoming")

  const totalDuration = isValidStart && isValidEnd ? end.getTime() - start.getTime() : 0
  const elapsed = isValidStart ? now - start.getTime() : 0

  const localProgress =
    localIsPlaying && totalDuration > 0
      ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
      : 0

  const progress =
    typeof externalProgress === "number" && status
      ? Math.min(Math.max(externalProgress, 0), 1)
      : localProgress

  const formatElapsed = (ms: number) => {
    if (ms <= 0) return "00:00:00"
    const totalSec = Math.floor(ms / 1000)
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0")
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
    const s = String(totalSec % 60).padStart(2, "0")
    return `${h}:${m}:${s}`
  }

  // Campaign visibility check
  const isAd = artist.type === "ad"

  // --- Lottie Loader ---
  const [lottieData, setLottieData] = useState<any>(null)
  useEffect(() => {
    if (isAd && artist.isLottie && artist.image) {
      fetch(artist.image)
        .then(r => r.json())
        .then(data => setLottieData(data))
        .catch(err => console.error("Lottie load error:", err))
    }
  }, [isAd, artist.isLottie, artist.image])

  const isCampaignActive = useMemo(() => {
    if (!isAd) return true
    const nowMs = now
    const startMs = artist.campaignStart ? new Date(artist.campaignStart).getTime() : 0
    const endMs = artist.campaignEnd ? new Date(artist.campaignEnd).getTime() : Infinity
    return nowMs >= startMs && nowMs <= endMs
  }, [isAd, now, artist.campaignStart, artist.campaignEnd])

  if (!isCampaignActive) return null

  const handleCardClick = () => {
    if (isAd && artist.redirectUrl) {
      window.open(artist.redirectUrl, "_blank", "noopener,noreferrer")
    } else if (effectiveStatus === "playing" && !artist.audioUrl) {
      // If it's the live artist but no specific audio file, click should expand as before
      // but the background audio engine is already playing the radio stream
      setExpanded(!expanded)
    } else {
      setExpanded(!expanded)
    }
  }

  // Local time label shown on badge
  const localTimeLabel = `${formatLocalTime(start)} — ${formatLocalTime(end)}`
  // UTC label for tooltip
  const utcTimeLabel = `${formatUTCTime(start)} — ${formatUTCTime(end)} UTC (studio)`

  return (
    <TooltipProvider delayDuration={300}>
      <div
        onClick={handleCardClick}
        onMouseLeave={() => setExpanded(false)}
        className={`relative flex-shrink-0 cursor-pointer transition-all duration-300 ease-out group font-sans
          ${isAd ? "hover:scale-[1.02]" : "hover:scale-[1.08] hover:z-20"}
          ${expanded ? "scale-[1.08] z-20" : ""}
        `}
        style={{
          width: expanded ? "344px" : "312px",
          height: expanded ? "480px" : "436px",
        }}
      >
        <div className={`relative w-full h-full overflow-hidden rounded-sm border transition-colors duration-300
          ${expanded ? "border-[#99CCCC]" : "border-[#2a2a2a]/50"}
          group-hover:border-[#99CCCC]
        `}>
          {/* ... existing layers ... */}
          {/* IMAGE / LOTTIE */}
          <div className="absolute inset-0">
            {isAd && artist.isLottie ? (
              <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
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
                className={`object-cover transition-all duration-700 ${effectiveStatus === "played" && !isAd ? "grayscale brightness-50" : ""
                  } ${effectiveStatus === "upcoming" && !isAd ? "brightness-90" : ""} ${expanded && !isAd ? "brightness-50" : ""
                  }`}
                sizes="344px"
              />
            )}

            {effectiveStatus === "playing" && !isAd && (
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
                  sizes="344px"
                  aria-hidden="true"
                />
              </div>
            )}

            {expanded && !isAd && (
              <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
            )}
          </div>

          {/* Gradient overlay — bottom 50% dark, top transparent */}
          {!isAd && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 55%)", zIndex: 2 }} aria-hidden="true" />
          )}

          {/* Progress line */}
          {effectiveStatus === "playing" && !isAd && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#2a2a2a]">
              <div
                className="h-full bg-[#99CCCC]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}

          {/* AD BADGE */}
          {isAd && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-white/10 backdrop-blur-md text-white text-[10px] font-mono tracking-widest border border-white/10">
              ADVERTISEMENT
            </div>
          )}

          {/* TIMER BADGE — hide for ads */}
          {!isAd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono backdrop-blur-sm cursor-default ${effectiveStatus === "playing"
                    ? "bg-[#99CCCC]/90 text-white"
                    : effectiveStatus === "played"
                      ? "bg-[#1a1a1a]/80 text-[#737373]"
                      : "bg-[#1a1a1a]/80 text-[#a3a3a3]"
                    }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Clock className="w-3 h-3" />
                  {effectiveStatus === "playing"
                    ? formatElapsed(elapsed)
                    : localTimeLabel}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-mono text-[#9ca3af]">
                {utcTimeLabel}
              </TooltipContent>
            </Tooltip>
          )}

          {/* LIVE BADGE — hide for ads */}
          {effectiveStatus === "playing" && !isAd && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[#99CCCC]/90 text-white text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          )}

          {/* INFO */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            {!isAd && (
              <p className="text-[10px] uppercase tracking-widest text-[#737373] mb-1">
                {artist.location}
              </p>
            )}
            <h3 className={`${isAd ? 'text-2xl' : 'text-xl'} font-bold text-[#99CCCC] leading-tight mb-0.5`}>
              <SolariText text={artist.name} stagger={30} />
            </h3>
            <p className={`${isAd ? 'text-sm text-[#99CCCC]' : 'text-xs text-[#a3a3a3]'} tracking-wide`}>
              <SolariText text={artist.show} stagger={20} />
            </p>

            {/* Social links & Favorites */}
            {!isAd && (
              <div
                className="flex items-center gap-3 mt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(artist.dbId || String(artist.id))
                    }}
                    className={`transition-colors flex-shrink-0 ${isFavorite
                      ? "text-[#99CCCC]"
                      : "text-[#737373] hover:text-[#99CCCC]"
                      }`}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={`w-6 h-6 lg:w-4 lg:h-4 ${isFavorite ? "fill-current" : ""}`} />
                  </button>
                )}
                {artist.instagramUrl && (
                  <a
                    href={artist.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#737373] hover:text-[#99CCCC] transition-colors"
                    aria-label="Instagram"
                  >
                    <InstagramIcon className="w-6 h-6 lg:w-4 lg:h-4" />
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
                    <SoundcloudIcon className="w-6 h-6 lg:w-4 lg:h-4" />
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
                    <BandcampIcon className="w-6 h-6 lg:w-4 lg:h-4" />
                  </a>
                )}
              </div>
            )}

            {/* External link indicator for ads */}
            {isAd && artist.redirectUrl && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40 uppercase font-mono tracking-widest">
                <ExternalLink className="w-3 h-3" />
                Visit Website
              </div>
            )}

            {/* Genre tags — visually hidden, for search engines and screen readers */}
            {!isAd && artist.genres && artist.genres.length > 0 && (
              <span className="sr-only" aria-hidden="false">
                {artist.genres.join(", ")}
              </span>
            )}

            {/* Expanded description */}
            {!isAd && (
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: expanded ? "180px" : "0px",
                  opacity: expanded ? 1 : 0,
                  marginTop: expanded ? "12px" : "0px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="border-t border-[#99CCCC]/40 pt-3 h-full max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#99CCCC]/40 scrollbar-track-transparent pr-2"
                  style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}
                >
                  <p className="text-xs text-[#a3a3a3] leading-relaxed">
                    {artist.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}