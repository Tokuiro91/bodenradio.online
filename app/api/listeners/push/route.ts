import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findListenerByEmail, updateListener } from "@/lib/listeners-store"

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const subscription = await req.json()
        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
        }

        const listener = findListenerByEmail(session.user.email)
        if (!listener) {
            return NextResponse.json({ error: "Listener not found" }, { status: 404 })
        }

        const currentSubs = listener.pushSubscriptions || []
        // Check if already subscribed (simple endpoint check)
        const alreadySubscribed = currentSubs.find(s => s.endpoint === subscription.endpoint)

        if (!alreadySubscribed) {
            const nextSubs = [...currentSubs, subscription]
            updateListener(session.user.email, { pushSubscriptions: nextSubs })
        }

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { endpoint } = await req.json()
        if (!endpoint) {
            return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
        }

        const listener = findListenerByEmail(session.user.email)
        if (!listener) {
            return NextResponse.json({ error: "Listener not found" }, { status: 404 })
        }

        const nextSubs = (listener.pushSubscriptions || []).filter(s => s.endpoint !== endpoint)
        updateListener(session.user.email, { pushSubscriptions: nextSubs })

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
