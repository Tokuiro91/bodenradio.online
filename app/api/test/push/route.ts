import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findListenerByEmail } from "@/lib/listeners-store"
import webpush from "web-push"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:chyrukoleksii@gmail.com"

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const listener = findListenerByEmail(session.user.email)
        if (!listener || !listener.pushSubscriptions || listener.pushSubscriptions.length === 0) {
            return NextResponse.json({ error: "No subscriptions found. Please enable notifications first." }, { status: 404 })
        }

        const payload = JSON.stringify({
            title: "BØDEN Test Push",
            body: "This is a test notification from BØDEN Radio! It works! 🚀",
            icon: "/icons/icon-192.png",
            url: "/profile"
        })

        const results = await Promise.allSettled(
            listener.pushSubscriptions.map(sub => webpush.sendNotification(sub, payload))
        )

        return NextResponse.json({ ok: true, results })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
