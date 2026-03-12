import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { toggleFavoriteArtist, ensureListenerExists } from "@/lib/listeners-store"

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const listener = ensureListenerExists(session.user.email, session.user.name || undefined)

        return NextResponse.json({ favoriteArtists: listener.favoriteArtists || [] })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { artistId } = await req.json()
        if (!artistId && artistId !== 0) {
            return NextResponse.json({ error: "Invalid artist ID" }, { status: 400 })
        }

        const newFavorites = toggleFavoriteArtist(session.user.email, artistId)
        return NextResponse.json({ favoriteArtists: newFavorites })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
