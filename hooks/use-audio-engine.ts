"use client"

/**
 * useAudioEngine — единый движок воспроизведения для расписания радио.
 * Обновлено для использования серверного времени и Media Session API.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { Artist } from "@/lib/artists-data"
import { getSyncedTime } from "./use-server-time"
import { toast } from "sonner"

const FADE_DURATION_MS = 1000
const FADE_STEPS = 20
const PRELOAD_BEFORE_MS = 10 * 60 * 1000  // 10 min before start
const RELEASE_AFTER_MS = 10 * 60 * 1000   // 10 min after end

function isExternalUrl(url: string) {
    return url.startsWith("http://") || url.startsWith("https://")
}

/**
 * If we're on HTTPS and the stream is HTTP, route it through the
 * server-side proxy at /api/stream to avoid mixed-content blocking.
 */
function resolveStreamUrl(url: string): string {
    if (typeof window === "undefined") return url
    if (url.startsWith("http://") && window.location.protocol === "https:") {
        return `/api/stream?src=${encodeURIComponent(url)}`
    }
    return url
}

const UNIFIED_STREAM_URL = "http://163.245.219.4:8000/radio"

function getAudioUrl(artist: Artist): string {
    return artist.audioUrl || UNIFIED_STREAM_URL
}

function findActiveArtist(artists: Artist[]): Artist | null {
    const now = getSyncedTime()
    return artists.find((a) => {
        if (!getAudioUrl(a)) return false
        const s = new Date(a.startTime).getTime()
        const e = new Date(a.endTime).getTime()
        return now >= s && now < e
    }) ?? null
}

function findPreloadArtist(artists: Artist[]): Artist | null {
    const now = getSyncedTime()
    return artists.find((a) => {
        if (!getAudioUrl(a) || !isExternalUrl(getAudioUrl(a))) return false
        const s = new Date(a.startTime).getTime()
        const e = new Date(a.endTime).getTime()
        return now >= s - PRELOAD_BEFORE_MS && now < s && now < e
    }) ?? null
}

function shouldReleaseArtist(artist: Artist | null): boolean {
    if (!artist) return false
    const now = getSyncedTime()
    const e = new Date(artist.endTime).getTime()
    return now >= e + RELEASE_AFTER_MS
}

function calcSeekPosition(artist: Artist): number {
    const now = getSyncedTime()
    const s = new Date(artist.startTime).getTime()
    return Math.max(0, (now - s) / 1000)
}

function updateMediaSession(artist: Artist | null) {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        if (!artist) {
            navigator.mediaSession.metadata = null
            return
        }
        navigator.mediaSession.metadata = new MediaMetadata({
            title: artist.show,
            artist: artist.name,
            album: "BØDEN",
            artwork: [
                { src: artist.image, sizes: "512x512", type: "image/jpeg" },
            ],
        })
    }
}

interface CsvEntry { date: string; time: string; end_time: string; file: string }

function findActiveCsvEntry(entries: CsvEntry[]): CsvEntry | null {
    const now = new Date()
    const currentYear = now.getUTCFullYear();
    const currentMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
    const currentDay = String(now.getUTCDate()).padStart(2, '0');
    const today = `${currentYear}-${currentMonth}-${currentDay}`;

    const currentH = String(now.getUTCHours()).padStart(2, '0');
    const currentM = String(now.getUTCMinutes()).padStart(2, '0');
    const currentS = String(now.getUTCSeconds()).padStart(2, '0');
    const hms = `${currentH}:${currentM}:${currentS}`;

    return entries.find(e =>
        e.date === today && e.time <= hms && (e.end_time ? e.end_time > hms : true)
    ) ?? null
}

export function useAudioEngine(artists: Artist[]) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const isPlayingRef = useRef(false)
    const volumeRef = useRef(75)
    const isMutedRef = useRef(false)
    const artistsRef = useRef(artists)
    const tickRunningRef = useRef(false)

    const [isPlaying, setIsPlayingState] = useState(false)
    const [volume, setVolumeState] = useState(75)
    const [isMuted, setIsMutedState] = useState(false)
    const [activeArtist, setActiveArtist] = useState<Artist | null>(null)
    const [activeScheduleEntry, setActiveScheduleEntry] = useState<CsvEntry | null>(null)
    const csvEntriesRef = useRef<CsvEntry[]>([])

    // Poll schedule.csv every 60s so the engine knows what Liquidsoap is playing
    useEffect(() => {
        const load = async () => {
            try {
                const r = await fetch("/api/schedule")
                const d = await r.json()
                if (d.schedule) {
                    csvEntriesRef.current = d.schedule
                    setActiveScheduleEntry(findActiveCsvEntry(d.schedule))
                }
            } catch { }
        }
        load()
        const iv = setInterval(() => {
            setActiveScheduleEntry(findActiveCsvEntry(csvEntriesRef.current))
            // Reload full list every 5 minutes
        }, 60_000)
        return () => clearInterval(iv)
    }, [])

    useEffect(() => { artistsRef.current = artists }, [artists])
    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
    useEffect(() => { volumeRef.current = volume }, [volume])
    useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

    // Init audio element
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio()
            audioRef.current.preload = "none" // Don't preload until played
            audioRef.current.src = UNIFIED_STREAM_URL
            audioRef.current.crossOrigin = "anonymous"
        }

        return () => {
            audioRef.current?.pause()
            if (audioRef.current) audioRef.current.src = ""
        }
    }, [])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        audio.volume = isMuted ? 0 : volume / 100
    }, [volume, isMuted])

    useEffect(() => {
        const tick = () => {
            const active = findActiveArtist(artistsRef.current)

            // Strict schedule enforcement
            if (activeArtist && !active) {
                // Broadcast just ended - STOP
                if (isPlayingRef.current) {
                    audioRef.current?.pause()
                    setIsPlayingState(false)
                    isPlayingRef.current = false
                    toast.info("Broadcast ended. Stream paused.")
                }
            } else if (!activeArtist && active) {
                // New broadcast started while player was open — auto-switch if already playing
                if (isPlayingRef.current && audioRef.current) {
                    const url = resolveStreamUrl(getAudioUrl(active)) + "?t=" + Date.now()
                    audioRef.current.src = url
                    audioRef.current.load()
                    audioRef.current.play().catch(console.error)
                }
            } else if (activeArtist && active && activeArtist.id !== active.id) {
                // Switched from one broadcast to another — use new artist's URL
                if (isPlayingRef.current) {
                    const url = resolveStreamUrl(getAudioUrl(active)) + "?t=" + Date.now()
                    audioRef.current!.src = url
                    audioRef.current!.load()
                    audioRef.current!.play().catch(console.error)
                }
            }

            setActiveArtist(active)
            updateMediaSession(active)
        }

        tick()
        const interval = setInterval(tick, 5000)
        return () => clearInterval(interval)
    }, [activeArtist])

    const togglePlay = useCallback(async () => {
        const audio = audioRef.current
        if (!audio) return

        // 1. Check if anything is scheduled right now
        const currentActive = findActiveArtist(artistsRef.current)
        if (!isPlayingRef.current && !currentActive) {
            // We allow playing even if no artist is active in the UI schedule, 
            // as Liquidsoap might have its own schedule or fallback.
            toast.info("Connecting to live stream...")
        }

        const newPlaying = !isPlayingRef.current
        setIsPlayingState(newPlaying)
        isPlayingRef.current = newPlaying

        if (newPlaying) {
            // Use artist's external URL if set, otherwise fall back to unified Icecast stream
            const currentActive = findActiveArtist(artistsRef.current)
            const streamUrl = resolveStreamUrl(currentActive ? getAudioUrl(currentActive) : UNIFIED_STREAM_URL) + "?t=" + Date.now()
            audio.src = streamUrl
            audio.load()
            try {
                await audio.play()
            } catch (err) {
                console.error("Playback failed:", err)
                setIsPlayingState(false)
                isPlayingRef.current = false
                toast.error("Failed to start playback")
            }
        } else {
            audio.pause()
            audio.src = ""
            audio.load()
        }
    }, [])

    const setVolume = useCallback((v: number) => {
        setVolumeState(v)
        if (audioRef.current && !isMutedRef.current) {
            audioRef.current.volume = v / 100
        }
    }, [])

    const setIsMuted = useCallback((m: boolean) => {
        setIsMutedState(m)
        if (audioRef.current) {
            audioRef.current.volume = m ? 0 : volumeRef.current / 100
        }
    }, [])

    return { isPlaying, volume, isMuted, activeArtist, activeScheduleEntry, togglePlay, setVolume, setIsMuted }
}

