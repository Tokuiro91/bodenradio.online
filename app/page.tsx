"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback } from "react"
import { SplashScreen } from "@/components/splash-screen"
import { ReactionsOverlay } from "@/components/reactions-overlay"

const RadioPlayer = dynamic(() => import("@/components/radio-player").then(m => m.RadioPlayer), { ssr: false })
const MobileRadio = dynamic(() => import("@/components/mobile-radio").then(m => m.MobileRadio), { ssr: false })

// md breakpoint = 768px (matches Tailwind default)
const MD_BREAKPOINT = 768

export default function Page() {
  const [splashDone, setSplashDone] = useState(false)
  const onSplashDone = useCallback(() => setSplashDone(true), [])

  // null = not yet determined (before hydration)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <>
      {!splashDone && <SplashScreen onDone={onSplashDone} duration={3000} />}

      {/* Animated floating emoji reactions (visible to everyone) */}
      <ReactionsOverlay />

      {/* Only mount ONE audio engine — determined by JS matchMedia, not CSS visibility */}
      {isMobile === true && <MobileRadio />}
      {isMobile === false && <RadioPlayer />}
    </>
  )
}
