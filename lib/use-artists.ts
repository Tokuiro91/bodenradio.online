"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { generateArtists } from "@/lib/artists-data"
import type { Artist } from "@/lib/artists-data"

const STORAGE_KEY = "boden_artists"

export function useArtists() {
  const [artists, setArtistsState] = useState<Artist[]>([])
  const [ready, setReady] = useState(false)
  const isInitialMount = useRef(true)

  const writeToStorage = useCallback((next: Artist[]) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (err) {
      console.error("Local storage save error:", err)
    }
  }, [])

  const persistToServer = useCallback(async (next: Artist[]) => {
    try {
      const res = await fetch("/api/artists?t=" + Date.now(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error("Server persistence error:", data.error || res.statusText)
      }
    } catch (err) {
      console.error("Server connection error:", err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/artists?t=" + Date.now(), {
          headers: { "Cache-Control": "no-cache" }
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && !cancelled) {
            setArtistsState(data)
            writeToStorage(data)
            setReady(true)
            isInitialMount.current = false
            return
          }
        }
      } catch (err) {
        console.error("Initial load error:", err)
      }

      if (!cancelled) {
        // Fallback to storage
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setArtistsState(parsed)
              } else {
                setArtistsState(generateArtists())
              }
            } catch {
              setArtistsState(generateArtists())
            }
          } else {
            setArtistsState(generateArtists())
          }
        }
        setReady(true)
        isInitialMount.current = false
      }
    }
    load()

    // Polling every 5 minutes to fetch future sets
    const pollInterval = setInterval(load, 5 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
  }, [writeToStorage])

  // Sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (Array.isArray(parsed)) setArtistsState(parsed)
        } catch { }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // Public setter
  const setArtists: React.Dispatch<React.SetStateAction<Artist[]>> = useCallback((action) => {
    setArtistsState((prev) => {
      const next = typeof action === "function" ? (action as any)(prev) : action

      // Schedule side effects outside of the React render loop/updater
      if (typeof window !== "undefined") {
        setTimeout(() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          } catch { }
          persistToServer(next)
        }, 0)
      }

      return next
    })
  }, [persistToServer])

  return {
    artists,
    setArtists,
    ready,
  }
}
