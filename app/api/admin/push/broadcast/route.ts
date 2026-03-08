import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getListeners } from "@/lib/listeners-store"
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
        // @ts-ignore
        if (session?.user?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { title, body } = await req.json()
        if (!title || !body) {
            return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
        }

        const listeners = getListeners()
        const eligibleListeners = listeners.filter(l => l.pushEnabled && l.pushSubscriptions && l.pushSubscriptions.length > 0)

        const payload = JSON.stringify({
            title: title || body,
            body: title ? body : "",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            url: "/"
        })

        const allPushes: Promise<any>[] = []
        eligibleListeners.forEach(listener => {
            listener.pushSubscriptions?.forEach(sub => {
                allPushes.push(webpush.sendNotification(sub, payload))
            })
        })

        const results = await Promise.allSettled(allPushes)

        const successCount = results.filter(r => r.status === "fulfilled").length
        const failureCount = results.filter(r => r.status === "rejected").length

        return NextResponse.json({
            ok: true,
            totalSent: allPushes.length,
            successCount,
            failureCount
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
