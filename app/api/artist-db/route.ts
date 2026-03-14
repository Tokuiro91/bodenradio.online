import { NextResponse } from "next/server"
import { getArtistDB, createDBArtist, updateDBArtist, deleteDBArtist, syncDBArtists, incrementScheduleCount } from "@/lib/artist-db-store"
import { getListeners } from "@/lib/listeners-store"
import { auth } from "@/lib/auth"

export async function GET() {
    const artists = getArtistDB()
    const listeners = getListeners()
    const counts: Record<string, number> = {}
    for (const listener of listeners) {
        for (const artistId of (listener.favoriteArtists || [])) {
            counts[artistId] = (counts[artistId] || 0) + 1
        }
    }
    return NextResponse.json(artists.map(a => ({ ...a, favoritesCount: counts[a.id] || 0 })))
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const body = await req.json()

        // Batch sync support
        if (body.action === "sync" && Array.isArray(body.artists)) {
            const synced = syncDBArtists(body.artists)
            return NextResponse.json(synced)
        }

        // Increment schedule count for an existing artist
        if (body.action === "increment-schedule" && body.id) {
            incrementScheduleCount(body.id)
            return NextResponse.json({ success: true })
        }

        const newArtist = createDBArtist(body)
        return NextResponse.json(newArtist)
    } catch (e) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }
}

export async function PUT(req: Request) {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const body = await req.json()
        const { id, ...updates } = body
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

        const updated = updateDBArtist(id, updates)
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

        return NextResponse.json(updated)
    } catch (e) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }
}

export async function DELETE(req: Request) {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const url = new URL(req.url)
        const id = url.searchParams.get("id")
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

        deleteDBArtist(id)
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }
}
