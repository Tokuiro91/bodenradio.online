"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
    const [pushEnabled, setPushEnabled] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setLoading(false)
            return
        }

        const checkStatus = async () => {
            try {
                // Check browser subscription
                const registration = await navigator.serviceWorker.ready
                const subscription = await registration.pushManager.getSubscription()
                setIsSubscribed(!!subscription)

                // Check backend preference
                const res = await fetch("/api/listeners/settings")
                if (res.ok) {
                    const data = await res.json()
                    setPushEnabled(!!data.pushEnabled)
                }
            } catch (err) {
                console.error("Status check error:", err)
            } finally {
                setLoading(false)
            }
        }

        checkStatus()
    }, [])

    const updateBackendPreference = async (enabled: boolean) => {
        try {
            await fetch("/api/listeners/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pushEnabled: enabled }),
            })
            setPushEnabled(enabled)
        } catch (err) {
            toast.error("Failed to update preferences")
        }
    }

    const subscribe = async () => {
        if (!VAPID_PUBLIC_KEY) {
            console.error("VAPID public key missing. Check your environment variables.")
            toast.error("Push system configuration missing. Contact admin.")
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
                await updateBackendPreference(true)
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
            await updateBackendPreference(false)
            toast.success("Notifications disabled")
        } catch (err) {
            console.error("Unsubscription error:", err)
            toast.error("Failed to disable notifications")
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (checked: boolean) => {
        if (checked) {
            if (!isSubscribed) {
                await subscribe()
            } else {
                await updateBackendPreference(true)
                toast.success("Notifications enabled!")
            }
        } else {
            // We only toggle the master setting off, we don't necessarily need to unsubscribe from the browser
            // but for a clean state it's better to keep it synced.
            await updateBackendPreference(false)
            toast.success("Notifications disabled")
        }
    }

    const sendTestPush = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/test/push", { method: "POST" })
            if (res.ok) {
                toast.success("Test notification sent!")
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to send test push")
            }
        } catch {
            toast.error("Error sending test push")
        } finally {
            setLoading(false)
        }
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return null
    }

    const effectiveActive = isSubscribed && pushEnabled
    const needsActivation = !isSubscribed && pushEnabled

    return (
        <div className="flex flex-col gap-4 p-4 bg-[#1a1a1a] rounded-sm border border-[#2a2a2a]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${effectiveActive ? "bg-[#99CCCC]/20 text-[#99CCCC]" : (needsActivation ? "bg-orange-500/20 text-orange-500" : "bg-red-500/10 text-red-500/50")}`}>
                        {effectiveActive ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </div>
                    <div className="space-y-0.5">
                        <Label className="text-sm font-bold uppercase tracking-wide">PWA Notifications</Label>
                        <p className="text-[9px] text-[#737373] uppercase tracking-wider">
                            {effectiveActive ? "Alerts enabled for your favorite artists" :
                                needsActivation ? "Activation required on this device" :
                                    "Stay informed when your favorites are live"}
                        </p>
                    </div>
                </div>
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#737373]" />
                ) : (
                    <Switch
                        checked={pushEnabled}
                        onCheckedChange={handleToggle}
                        className="data-[state=checked]:bg-[#99CCCC]"
                    />
                )}
            </div>

            {needsActivation && !loading && (
                <div className="pt-2 border-t border-[#2a2a2a]">
                    <p className="text-[10px] text-orange-500/80 mb-3 uppercase font-mono leading-relaxed">
                        Notifications are enabled for your account, but this device is not yet subscribed.
                    </p>
                    <Button
                        onClick={subscribe}
                        className="w-full bg-orange-500/10 text-orange-500 border border-orange-500/30 text-[10px] uppercase font-bold tracking-widest hover:bg-orange-500 hover:text-white transition-all h-10"
                    >
                        ACTIVATE ON THIS DEVICE
                    </Button>
                </div>
            )}

            {effectiveActive && (
                <div className="pt-2 border-t border-[#2a2a2a]">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={sendTestPush}
                        disabled={loading}
                        className="w-full border-[#99CCCC]/30 text-[#99CCCC] text-[10px] uppercase font-bold tracking-widest hover:bg-[#99CCCC]/10 h-10"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "SEND TEST PUSH"}
                    </Button>
                </div>
            )}
        </div>
    )
}
