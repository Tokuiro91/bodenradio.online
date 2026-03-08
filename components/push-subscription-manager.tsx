"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function PushSubscriptionManager() {
    const { data: session } = useSession()
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setLoading(false)
            return
        }

        navigator.serviceWorker.ready.then((registration) => {
            registration.pushManager.getSubscription().then((subscription) => {
                setIsSubscribed(!!subscription)
                setLoading(false)
            })
        })
    }, [])

    const subscribe = async () => {
        if (!VAPID_PUBLIC_KEY) {
            toast.error("VAPID public key not found")
            return
        }

        setLoading(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            })

            const res = await fetch("/api/listeners/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subscription),
            })

            if (res.ok) {
                setIsSubscribed(true)
                toast.success("Notifications enabled!")
            } else {
                throw new Error("Failed to save subscription")
            }
        } catch (err) {
            console.error("Subscription error:", err)
            toast.error("Failed to enable notifications")
        } finally {
            setLoading(false)
        }
    }

    const unsubscribe = async () => {
        setLoading(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            if (subscription) {
                await subscription.unsubscribe()
                await fetch("/api/listeners/push", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                })
            }
            setIsSubscribed(false)
            toast.success("Notifications disabled")
        } catch (err) {
            console.error("Unsubscription error:", err)
            toast.error("Failed to disable notifications")
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = (checked: boolean) => {
        if (checked) {
            subscribe()
        } else {
            unsubscribe()
        }
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return null
    }

    return (
        <div className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-sm border border-[#2a2a2a]">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isSubscribed ? "bg-[#99CCCC]/20 text-[#99CCCC]" : "bg-red-500/10 text-red-500/50"}`}>
                    {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </div>
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-wide">PWA Notifications</Label>
                    <p className="text-[9px] text-[#737373] uppercase tracking-wider">
                        {isSubscribed ? "Alerts enabled for your favorite artists" : "Stay informed when your favorites are live"}
                    </p>
                </div>
            </div>
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#737373]" />
            ) : (
                <Switch
                    checked={isSubscribed}
                    onCheckedChange={handleToggle}
                    className="data-[state=checked]:bg-[#99CCCC]"
                />
            )}
        </div>
    )
}
