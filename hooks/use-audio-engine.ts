"use client"

/**
 * useAudioEngine — единый движок воспроизведения для расписания радио.
 * Обновлено для использования серверного времени и Media Session API.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { Artist } from "@/lib/artists-data"
import { getSyncedTime } from "./use-server-time"

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

function getAudioUrl(artist: Artist): string {
    return artist.audioUrl || "http://bodenradio.online:9090/stream.mp3"
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

export function useAudioEngine(artists: Artist[]) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const preloadUrlRef = useRef<string>("")
    const currentUrlRef = useRef<string>("")
    const lastReleasedRef = useRef<string>("")
    const isPlayingRef = useRef(false)
    const volumeRef = useRef(75)
    const isMutedRef = useRef(false)
    const artistsRef = useRef(artists)
    const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const tickRunningRef = useRef(false)

    const [isPlaying, setIsPlayingState] = useState(false)
    const [volume, setVolumeState] = useState(75)
    const [isMuted, setIsMutedState] = useState(false)
    const [activeArtist, setActiveArtist] = useState<Artist | null>(null)

    useEffect(() => { artistsRef.current = artists }, [artists])
    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
    useEffect(() => { volumeRef.current = volume }, [volume])
    useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

    // Init audio element & media session handlers (client-side only)
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio()
            audioRef.current.preload = "auto"
        }
        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => {
                const active = findActiveArtist(artistsRef.current)
                if (active) togglePlay()
            })
            navigator.mediaSession.setActionHandler("pause", () => {
                togglePlay()
            })
            // Seek/Next/Prev are disabled for live radio
        }
        return () => { audioRef.current?.pause() }
    }, []) // eslint-disable-next-line react-hooks/exhaustive-deps

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        audio.volume = isMuted ? 0 : volume / 100
    }, [volume, isMuted])

    const fadeOut = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            const audio = audioRef.current
            if (!audio || audio.paused) { resolve(); return }
            const startVol = audio.volume
            let step = 0
            if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
            fadeTimerRef.current = setInterval(() => {
                step++
                audio.volume = Math.max(0, startVol * (1 - step / FADE_STEPS))
                if (step >= FADE_STEPS) {
                    clearInterval(fadeTimerRef.current!)
                    audio.pause()
                    audio.volume = isMutedRef.current ? 0 : volumeRef.current / 100
                    resolve()
                }
            }, FADE_DURATION_MS / FADE_STEPS)
        })
    }, [])

    const startTrack = useCallback(async (artist: Artist) => {
        const audio = audioRef.current
        if (!audio) return
        const rawUrl = getAudioUrl(artist)
        const url = resolveStreamUrl(rawUrl)  // transparently proxy HTTP→HTTPS if needed
        const external = isExternalUrl(rawUrl)

        // Detect live streams (AzuraCast, Icecast, etc.)
        // These cannot be seeked and should be played as-is via direct src load
        const isLiveStream = external && (
            rawUrl.includes('/radio/') ||
            rawUrl.includes('/stream') ||
            rawUrl.includes('.mp3') ||
            rawUrl.includes('.aac') ||
            rawUrl.includes('.ogg') ||
            rawUrl.includes('/listen/')
        )

        updateMediaSession(artist)

        if (isLiveStream) {
            // For live streams: just set src and play immediately (no seek)
            if (audio.src !== url) {
                audio.crossOrigin = 'anonymous'
                audio.src = url
            }
            currentUrlRef.current = url
            preloadUrlRef.current = url
            audio.volume = isMutedRef.current ? 0 : volumeRef.current / 100
            try { await audio.play() } catch {
                // If crossOrigin fails, retry without it
                audio.crossOrigin = ''
                audio.src = url
                try { await audio.play() } catch { /* autoplay blocked */ }
            }
            return
        }

        const alreadyLoaded = preloadUrlRef.current === url || currentUrlRef.current === url
        if (!alreadyLoaded || audio.src !== url) {
            audio.src = url
        }
        currentUrlRef.current = url
        preloadUrlRef.current = url
        audio.volume = isMutedRef.current ? 0 : volumeRef.current / 100

        if (external) {
            try { await audio.play() } catch { /* autoplay blocked */ }
        } else {
            await new Promise<void>((resolve) => {
                const onCanPlay = () => { audio.removeEventListener("canplay", onCanPlay); audio.removeEventListener("error", onErr); resolve() }
                const onErr = () => { audio.removeEventListener("canplay", onCanPlay); audio.removeEventListener("error", onErr); resolve() }
                audio.addEventListener("canplay", onCanPlay, { once: true })
                audio.addEventListener("error", onErr, { once: true })
                if (audio.src !== url) { audio.src = url }
                audio.load()
            })
            const seekSec = calcSeekPosition(artist)
            if (seekSec > 0 && Number.isFinite(audio.duration) && seekSec < audio.duration) {
                audio.currentTime = seekSec
            }
            try { await audio.play() } catch { /* autoplay blocked */ }
        }
    }, [])

    const preloadTrack = useCallback((url: string) => {
        const audio = audioRef.current
        if (!audio || preloadUrlRef.current === url) return
        preloadUrlRef.current = url
        audio.src = url
        audio.load()
    }, [])

    const releasePreload = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        audio.src = ""
        audio.load()
        preloadUrlRef.current = ""
    }, [])

    useEffect(() => {
        const tick = async () => {
            if (tickRunningRef.current) return
            tickRunningRef.current = true
            try {
                const audio = audioRef.current
                if (!audio) return

                const playing = isPlayingRef.current
                const active = findActiveArtist(artistsRef.current)
                setActiveArtist(active)

                // ── Release after card ends (10 min grace) ─────────────────────
                if (!active && currentUrlRef.current) {
                    const prevArtist = artistsRef.current.find(
                        (a) => getAudioUrl(a) === currentUrlRef.current ||
                            resolveStreamUrl(getAudioUrl(a)) === currentUrlRef.current
                    )
                    if (prevArtist && shouldReleaseArtist(prevArtist)) {
                        if (!audio.paused) await fadeOut()
                        if (isExternalUrl(currentUrlRef.current)) releasePreload()
                        currentUrlRef.current = ""
                        lastReleasedRef.current = getAudioUrl(prevArtist)
                        updateMediaSession(null)
                    }
                }

                // ── User paused — fade out without touching state ───────────────
                if (!playing) {
                    if (!audio.paused) await fadeOut()
                    return
                }

                // ── No active artist — fade out if still playing ────────────────
                if (!active) {
                    if (!audio.paused) {
                        await fadeOut()
                        updateMediaSession(null)
                    }
                    return
                }

                const resolvedUrl = resolveStreamUrl(getAudioUrl(active))

                // ── Already playing/loaded the correct track — do nothing ───────
                // This is the critical check: don't restart a live stream just
                // because it's momentarily buffering (audio.paused = true).
                if (currentUrlRef.current === resolvedUrl) {
                    // If it's paused AND we want it playing, try a gentle resume
                    if (audio.paused && audio.src === resolvedUrl && audio.readyState > 0) {
                        try { await audio.play() } catch { /* autoplay blocked */ }
                    }
                    return
                }

                // ── Different track — fade out old one, start new ───────────────
                if (!audio.paused && currentUrlRef.current !== resolvedUrl) {
                    await fadeOut()
                }

                await startTrack(active)
            } finally {
                tickRunningRef.current = false
            }
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [fadeOut, startTrack, preloadTrack, releasePreload])

    const togglePlay = useCallback(async () => {
        const newPlaying = !isPlayingRef.current
        setIsPlayingState(newPlaying)
        isPlayingRef.current = newPlaying

        if (!newPlaying) {
            await fadeOut()
            return
        }

        const active = findActiveArtist(artistsRef.current)
        if (active && getAudioUrl(active)) {
            await startTrack(active)
        }
    }, [fadeOut, startTrack])

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

    return { isPlaying, volume, isMuted, activeArtist, togglePlay, setVolume, setIsMuted }
}

