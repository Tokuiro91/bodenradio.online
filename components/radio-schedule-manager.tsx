"use client"

import { useState, useEffect, useRef } from "react"

export function RadioScheduleManager({ dbArtists, artists, setArtists }: {
    dbArtists: any[],
    artists: any[],
    setArtists: (a: any) => void
}) {
    const [token, setToken] = useState<string | null>(null)
    const [error, setError] = useState("")
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Auto-login to radio backend (internal admin)
    useEffect(() => {
        const login = async () => {
            try {
                const res = await fetch("/api/radio/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "admin", password: "admin" })
                })
                const data = await res.json()
                if (data.token) {
                    setToken(data.token)
                }
            } catch (e) {
                setError("Failed to connect to radio backend")
            }
        }
        login()
    }, [])

    // Listen for sync messages from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SYNC_SCHEDULE') {
                const { event: schEvent } = event.data;

                setArtists((prev: any[]) => {
                    // 1. If it was already in our list (by ID from radio backend), update it
                    const existingIdx = prev.findIndex(a => a.radioId === schEvent.id);

                    const dbArtist = dbArtists.find(a => String(a.id) === String(schEvent.artist_id));

                    const updatedEntry = {
                        id: (existingIdx !== -1) ? prev[existingIdx].id : (prev.length ? Math.max(...prev.map(a => a.id)) + 1 : 0),
                        radioId: schEvent.id, // Track the radio backend's entry ID
                        name: dbArtist ? dbArtist.name : schEvent.title.replace(/\[SYNC\] |\[TRACK\] |\[PLAYLIST\] /g, ''),
                        location: dbArtist?.location || "Earth",
                        show: dbArtist?.show || schEvent.title.replace(/\[SYNC\] |\[TRACK\] |\[PLAYLIST\] /g, ''),
                        image: dbArtist?.image || "/artists/artist-1.jpg",
                        startTime: new Date(schEvent.start_time).toISOString(),
                        endTime: new Date(schEvent.end_time).toISOString(),
                        duration: ((schEvent.end_time - schEvent.start_time) / 1000 / 60).toFixed(0) + " min",
                        description: dbArtist?.description || "Synced from radio schedule",
                        trackName: schEvent.trackName || "",
                        dayIndex: 0,
                        orderInDay: 0,
                        type: "artist"
                    };

                    if (existingIdx !== -1) {
                        const next = [...prev];
                        next[existingIdx] = updatedEntry;
                        return next;
                    } else {
                        return [...prev, updatedEntry];
                    }
                });
            } else if (event.data.type === 'DELETE_SCHEDULE') {
                const { id } = event.data;
                setArtists((prev: any[]) => prev.filter(a => a.radioId !== id));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [dbArtists, setArtists]);


    // Send artists to iframe when it loads
    const handleIframeLoad = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'INIT_ARTISTS',
                artists: dbArtists
            }, '*');
        }
    };

    if (error) return <div className="p-10 text-center font-mono text-[11px] text-red-500">{error}</div>
    if (!token) return <div className="p-10 text-center font-mono text-[11px] text-[#737373]">Connecting to radio engine...</div>

    // Use current host to determine the backend IP
    const backendUrl = typeof window !== 'undefined'
        ? `/radio-admin/?token=${token}`
        : ""

    return (
        <div className="w-full min-h-[600px] h-[75vh] bg-[#000] rounded-sm overflow-hidden border border-[#1a1a1a]">
            {backendUrl && (
                <iframe
                    ref={iframeRef}
                    src={backendUrl}
                    className="w-full h-full border-none"
                    title="Radio Schedule"
                    onLoad={handleIframeLoad}
                />
            )}
        </div>
    )
}
