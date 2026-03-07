"use client"

import { useState, useEffect } from "react"

export function RadioScheduleManager({ dbArtists, artists, setArtists }: {
    dbArtists: any[],
    artists: any[],
    setArtists: (a: any) => void
}) {
    const [token, setToken] = useState<string | null>(null)
    const [error, setError] = useState("")

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

    if (error) return <div className="p-10 text-center font-mono text-[11px] text-red-500">{error}</div>
    if (!token) return <div className="p-10 text-center font-mono text-[11px] text-[#737373]">Connecting to radio engine...</div>

    // Use current host to determine the backend IP
    const backendUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:8080/?token=${token}`
        : ""

    return (
        <div className="w-full h-[80vh] bg-[#0a0a0a] rounded-sm overflow-hidden border border-[#1a1a1a]">
            {backendUrl && (
                <iframe
                    src={backendUrl}
                    className="w-full h-full border-none"
                    title="Radio Schedule"
                />
            )}
        </div>
    )
}

