"use client"

/**
 * useAudioEngine — unified playback engine for the radio schedule.
 * Updated for server time, Media Session API, and smooth fade transitions.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { Artist } from "@/lib/artists-data"
import { getSyncedTime } from "./use-server-time"
import { toast } from "sonner"

const FADE_STEPS = 20
const PRELOAD_BEFORE_MS = 10 * 60 * 1000  // 10 min before start
const RELEASE_AFTER_MS = 10 * 60 * 1000   // 10 min after end
const FADE_IN_DURATION_MS = 3000           // 3s fade-in for new broadcast
const SWITCH_FADE_OUT_MS = 1500            // fade-out for broadcast switch / manual pause

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

const UNIFIED_STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL || "http://163.245.219.4:8000/radio"

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

/** Linearly fade audio volume from `fromVol` to `toVol` over `durationMs` ms. */
function startFade(
    audio: HTMLAudioElement,
    fromVol: number,
    toVol: number,
    durationMs: number,
    onDone?: () => void
): ReturnType<typeof setInterval> {
    const stepMs = Math.max(durationMs / FADE_STEPS, 16)
    let step = 0
    const id = setInterval(() => {
        step++
        audio.volume = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * step / FADE_STEPS))
        if (step >= FADE_STEPS) {
            clearInterval(id)
            onDone?.()
        }
    }, stepMs)
    return id
}

interface CsvEntry { date: string; time: string; end_time: string; file: string }

function findActiveCsvEntry(entries: CsvEntry[]): CsvEntry | null {
    const now = new Date()
    const y = now.getUTCFullYear()
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    const today = `${y}-${mo}-${d}`

    const h = String(now.getUTCHours()).padStart(2, '0')
    const min = String(now.getUTCMinutes()).padStart(2, '0')
    const s = String(now.getUTCSeconds()).padStart(2, '0')
    const hms = `${h}:${min}:${s}`

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
    const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const isFadingRef = useRef(false)
    const schedulePausedRef = useRef(false)  // stopped by schedule end, not user

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
            audioRef.current.preload = "none"
            audioRef.current.src = UNIFIED_STREAM_URL
            audioRef.current.crossOrigin = "anonymous"
        }

        return () => {
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
            audioRef.current?.pause()
            if (audioRef.current) audioRef.current.src = ""
        }
    }, [])

    // Sync volume/mute (skip while fading to avoid fighting the fade)
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || isFadingRef.current) return
        audio.volume = isMuted ? 0 : volume / 100
    }, [volume, isMuted])

    // Pre-end monitor: intentionally no-op — stream runs continuously until user stops it

    // Main schedule tick: detect artist changes and handle transitions
    useEffect(() => {
        const tick = () => {
            const active = findActiveArtist(artistsRef.current)

            if (activeArtist && !active) {
                // Broadcast ended — keep playing, just update state
            } else if (!activeArtist && active) {
                // New broadcast started — auto-start if playing or paused by schedule end
                if ((isPlayingRef.current || schedulePausedRef.current) && audioRef.current) {
                    schedulePausedRef.current = false
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
                    isFadingRef.current = true
                    const audio = audioRef.current
                    // Explicitly close any lingering connection before starting fresh
                    audio.pause()
                    audio.src = ""
                    audio.load()
                    const url = resolveStreamUrl(getAudioUrl(active)) + "?t=" + Date.now()
                    audio.src = url
                    audio.volume = 0
                    audio.load()
                    audio.play().then(() => {
                        setIsPlayingState(true)
                        isPlayingRef.current = true
                        const targetVol = isMutedRef.current ? 0 : volumeRef.current / 100
                        fadeIntervalRef.current = startFade(audio, 0, targetVol, FADE_IN_DURATION_MS, () => {
                            isFadingRef.current = false
                        })
                    }).catch((err) => {
                        console.error("Auto-start failed:", err)
                        isFadingRef.current = false
                    })
                }
            } else if (activeArtist && active && activeArtist.id !== active.id) {
                // Switched from one broadcast to another
                const oldUrl = getAudioUrl(activeArtist)
                const newUrl = getAudioUrl(active)
                // Only reconnect if the stream URL actually changed (different source file/stream)
                // If both artists use the same Icecast stream, the connection is continuous — no need to reconnect
                if (isPlayingRef.current && audioRef.current && oldUrl !== newUrl) {
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
                    isFadingRef.current = true
                    const audio = audioRef.current
                    fadeIntervalRef.current = startFade(audio, audio.volume, 0, SWITCH_FADE_OUT_MS, () => {
                        // Explicitly close the old connection before opening a new one
                        audio.pause()
                        audio.src = ""
                        audio.load()
                        const url = resolveStreamUrl(newUrl) + "?t=" + Date.now()
                        audio.src = url
                        audio.volume = 0
                        audio.load()
                        audio.play().then(() => {
                            const targetVol = isMutedRef.current ? 0 : volumeRef.current / 100
                            fadeIntervalRef.current = startFade(audio, 0, targetVol, FADE_IN_DURATION_MS, () => {
                                isFadingRef.current = false
                            })
                        }).catch(() => {
                            isFadingRef.current = false
                        })
                    })
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

        // Cancel any in-progress fade
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current)
            fadeIntervalRef.current = null
        }
        isFadingRef.current = false
        schedulePausedRef.current = false

        const currentActive = findActiveArtist(artistsRef.current)
        if (!isPlayingRef.current && !currentActive) {
            toast.info("Connecting to live stream...")
        }

        const newPlaying = !isPlayingRef.current
        setIsPlayingState(newPlaying)
        isPlayingRef.current = newPlaying

        if (newPlaying) {
            const streamUrl = resolveStreamUrl(currentActive ? getAudioUrl(currentActive) : UNIFIED_STREAM_URL) + "?t=" + Date.now()
            audio.src = streamUrl
            audio.volume = 0
            audio.load()
            try {
                await audio.play()
                isFadingRef.current = true
                const targetVol = isMutedRef.current ? 0 : volumeRef.current / 100
                fadeIntervalRef.current = startFade(audio, 0, targetVol, FADE_IN_DURATION_MS, () => {
                    isFadingRef.current = false
                })
            } catch (err) {
                console.error("Playback failed:", err)
                setIsPlayingState(false)
                isPlayingRef.current = false
                toast.error("Failed to start playback")
            }
        } else {
            // Fade out then stop
            isFadingRef.current = true
            fadeIntervalRef.current = startFade(audio, audio.volume, 0, SWITCH_FADE_OUT_MS, () => {
                audio.pause()
                audio.src = ""
                audio.load()
                isFadingRef.current = false
            })
        }
    }, [])

    const setVolume = useCallback((v: number) => {
        setVolumeState(v)
        if (audioRef.current && !isMutedRef.current && !isFadingRef.current) {
            audioRef.current.volume = v / 100
        }
    }, [])

    const setIsMuted = useCallback((m: boolean) => {
        setIsMutedState(m)
        if (audioRef.current && !isFadingRef.current) {
            audioRef.current.volume = m ? 0 : volumeRef.current / 100
        }
    }, [])

    return { isPlaying, volume, isMuted, activeArtist, activeScheduleEntry, togglePlay, setVolume, setIsMuted }
}
