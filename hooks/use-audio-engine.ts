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
    return artist.audioUrl || ""
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

const UNIFIED_STREAM_URL = "/api/radio/stream.mp3"

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
            setActiveArtist(active)
            updateMediaSession(active)
        }

        tick()
        const interval = setInterval(tick, 5000)
        return () => clearInterval(interval)
    }, [])

    const togglePlay = useCallback(async () => {
        const audio = audioRef.current
        if (!audio) return

        const newPlaying = !isPlayingRef.current
        setIsPlayingState(newPlaying)
        isPlayingRef.current = newPlaying

        if (newPlaying) {
            // To ensure we get the FRESH stream (not buffered), sometimes re-setting src helps
            // but for a chunked stream it should be fine. 
            // We force a reload to jump to the 'live' edge if possible.
            audio.src = UNIFIED_STREAM_URL + "?t=" + Date.now()
            audio.load()
            try {
                await audio.play()
            } catch (err) {
                console.error("Playback failed:", err)
                setIsPlayingState(false)
                isPlayingRef.current = false
            }
        } else {
            audio.pause()
            // Clear src to stop background download
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

    return { isPlaying, volume, isMuted, activeArtist, togglePlay, setVolume, setIsMuted }
}

