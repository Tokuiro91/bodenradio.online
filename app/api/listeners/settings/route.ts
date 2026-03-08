import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findListenerByEmail, updateListener } from "@/lib/listeners-store"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const listener = findListenerByEmail(session.user.email)
        if (!listener) {
            return NextResponse.json({ error: "Listener not found" }, { status: 404 })
        }

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

        const { pushEnabled } = await req.json()
        if (typeof pushEnabled !== "boolean") {
            return NextResponse.json({ error: "Invalid preference" }, { status: 400 })
        }

        updateListener(session.user.email, { pushEnabled })
        return NextResponse.json({ ok: true, pushEnabled })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
