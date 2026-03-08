import { NextResponse } from "next/server"
import { getArtistDB, createDBArtist, updateDBArtist, deleteDBArtist, syncDBArtists } from "@/lib/artist-db-store"
import { auth } from "@/lib/auth"

export async function GET() {
    return NextResponse.json(getArtistDB())
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
