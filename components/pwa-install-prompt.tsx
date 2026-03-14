"use client"

import { useEffect, useState } from "react"

const DISMISSED_KEY = "boden-pwa-install-dismissed-v2"
const DISMISS_DAYS = 30

function isDismissed() {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    const expires = parseInt(raw, 10)
    if (Date.now() > expires) {
        localStorage.removeItem(DISMISSED_KEY)
        return false
    }
    return true
}

function setDismissed() {
    const expires = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISSED_KEY, String(expires))
}

function isIosSafari() {
    if (typeof navigator === "undefined") return false
    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua)
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
    const isStandalone = (navigator as any).standalone === true
    return isIos && isSafari && !isStandalone
}

export function PwaInstallPrompt() {
    const [show, setShow] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [platform, setPlatform] = useState<"ios" | "android" | "other">("other")

    useEffect(() => {
        if (isDismissed()) return

        if (isIosSafari()) {
            setPlatform("ios")
            const t = setTimeout(() => setShow(true), 5000)
            return () => clearTimeout(t)
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setPlatform("android")
            setTimeout(() => setShow(true), 3000)
        }

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
        return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }, [])

    const dismiss = () => {
        setDismissed()
        setShow(false)
    }

    const handleInstall = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === "accepted") {
            setDismissed()
            setShow(false)
        }
        setDeferredPrompt(null)
    }

    if (!show) return null

    return (
        <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm
      bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-300"
        >
            {/* Close */}
            <button
                onClick={dismiss}
                className="absolute top-3 right-3 text-[#737373] hover:text-white text-lg leading-none"
                aria-label="Dismiss"
            >
                ×
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.png" alt="BØDEN" className="w-10 h-10 rounded-xl" />
                <div>
                    <div className="font-tektur font-bold text-sm tracking-wider">Install BØDEN</div>
                    <div className="font-mono text-[10px] text-[#737373] uppercase tracking-wider">
                        {platform === "ios" ? "Add to Home Screen" : "Progressive Web App"}
                    </div>
                </div>
            </div>

            {platform === "android" && deferredPrompt ? (
                <div className="space-y-4">
                    <p className="text-sm font-mono text-[#e5e5e5]">
                        Install the radio as an app for quick access to the stream.
                    </p>
                    <button
                        onClick={handleInstall}
                        className="w-full py-3 bg-[#99CCCC] text-black font-bold text-xs font-mono uppercase tracking-widest rounded-xl hover:bg-white transition"
                    >
                        Install now
                    </button>
                </div>
            ) : (
                /* Steps for iOS or Manual Android */
                <ol className="space-y-3 text-sm font-mono text-[#e5e5e5]">
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#99CCCC]/20 text-[#99CCCC] text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>
                            {platform === "ios" ? (
                                <>
                                    Tap the{" "}
                                    <span className="inline-flex items-center gap-1 text-[#99CCCC]">
                                        Share
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                                            <polyline points="16 6 12 2 8 6" />
                                            <line x1="12" y1="2" x2="12" y2="15" />
                                        </svg>
                                    </span>{" "}
                                    button
                                </>
                            ) : (
                                <>
                                    Tap the menu button{" "}
                                    <span className="text-[#99CCCC] font-bold">⋮</span> (three dots)
                                </>
                            )}
                        </span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#99CCCC]/20 text-[#99CCCC] text-[11px] flex items-center justify-center font-bold">2</span>
                        <span>
                            {platform === "ios" ? "Scroll down and tap " : "Select "}
                            <span className="text-[#99CCCC]">
                                {platform === "ios" ? "\"Add to Home Screen\"" : "\"Add to Home Screen\""}
                            </span>
                        </span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#99CCCC]/20 text-[#99CCCC] text-[11px] flex items-center justify-center font-bold">3</span>
                        <span>Tap <span className="text-[#99CCCC]">"Add"</span> to confirm</span>
                    </li>
                </ol>
            )}
        </div>
    )
}
