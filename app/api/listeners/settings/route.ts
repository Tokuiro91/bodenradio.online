import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findListenerByEmail, updateListener, ensureListenerExists } from "@/lib/listeners-store"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const listener = ensureListenerExists(session.user.email, session.user.name || undefined)

        return NextResponse.json({
            pushEnabled: !!listener.pushEnabled
        })
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

        const body = await req.json()
        const updates: Record<string, unknown> = {}

        if (typeof body.pushEnabled === "boolean") updates.pushEnabled = body.pushEnabled
        if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim()

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
        }

        updateListener(session.user.email, updates)
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
