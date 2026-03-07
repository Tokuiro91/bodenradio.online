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
                const dbArtist = dbArtists.find(a => String(a.id) === String(schEvent.artist_id));

                if (dbArtist) {
                    const startTimeISO = new Date(schEvent.start_time).toISOString();
                    const endTimeISO = new Date(schEvent.end_time).toISOString();

                    const newArtistEntry = {
                        id: artists.length ? Math.max(...artists.map((a: any) => a.id)) + 1 : 0,
                        name: dbArtist.name,
                        location: "Earth",
                        show: dbArtist.show || "DJ Set",
                        image: dbArtist.image || "/artists/artist-1.jpg",
                        startTime: startTimeISO,
                        endTime: endTimeISO,
                        duration: ((schEvent.end_time - schEvent.start_time) / 1000 / 60).toFixed(0) + " min",
                        description: "Automatically synced from radio schedule",
                        dayIndex: 0,
                        orderInDay: 0,
                        type: "artist"
                    };

                    setArtists([...artists, newArtistEntry]);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [dbArtists, artists, setArtists]);

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
        ? `${window.location.protocol}//${window.location.hostname}:8080/?token=${token}`
        : ""

    return (
        <div className="w-full h-[80vh] bg-[#000] rounded-sm overflow-hidden border border-[#1a1a1a]">
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
