"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Play, Pause, Volume2, VolumeX, Clock, Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Link from "next/link"


interface HeaderProps {
  volume?: number
  isMuted?: boolean
  isPlaying?: boolean
  onTogglePlay?: () => void
  onVolumeChange?: (v: number) => void
  onMuteToggle?: () => void
}

export function Header({
  volume = 75,
  isMuted = false,
  isPlaying = false,
  onTogglePlay,
  onVolumeChange,
  onMuteToggle,
}: HeaderProps) {
  const { status } = useSession()
  const [showVolume, setShowVolume] = useState(false)
  const [time, setTime] = useState("")
  const [timeZoneOffset, setTimeZoneOffset] = useState("")

  /* ===== TIME ===== */
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, "0")
      const mm = String(now.getMinutes()).padStart(2, "0")
      const ss = String(now.getSeconds()).padStart(2, "0")
      setTime(`${hh}:${mm}:${ss}`)
      const offsetMinutes = now.getTimezoneOffset()
      const offsetHours = -offsetMinutes / 60
      const sign = offsetHours >= 0 ? "+" : "-"
      setTimeZoneOffset(`UTC${sign}${Math.abs(offsetHours)}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 px-4 md:px-8 flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <h1 className={`font-tektur font-bold text-xl md:text-2xl tracking-wider text-[#99CCCC]`}>
          <span className="text-[#99CCCC]">BØDEN</span>
        </h1>
        <div className="hidden md:flex items-center gap-2 text-xs text-[#737373] font-mono">
          <Clock className="w-3 h-3" />
          <span>{time} ({timeZoneOffset})</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        {/* PLAY — master switch for scheduled audio */}
        <button
          onClick={onTogglePlay}
          title={isPlaying ? "Пауза" : "Воспроизведение"}
          className="w-9 h-9 flex items-center justify-center bg-[#99CCCC] text-white rounded-sm hover:bg-[#88bbbb] transition"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* VOLUME */}
        <div className="relative">
          <button
            onClick={() => setShowVolume((v) => !v)}
            className="w-9 h-9 flex items-center justify-center bg-[#1f1f1f] text-[#e5e5e5] rounded-sm hover:bg-[#2a2a2a]"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {showVolume && (
            <div className="absolute right-0 top-full mt-2 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm w-[180px]">
              <div className="flex items-center gap-3">
                <button onClick={onMuteToggle} className="text-[#737373] hover:text-[#e5e5e5]">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    onVolumeChange?.(Number(e.target.value))
                    if (Number(e.target.value) > 0 && isMuted) onMuteToggle?.()
                  }}
                  className="flex-1 h-1 bg-[#2a2a2a] rounded-full accent-[#99CCCC]"
                />
                <span className="w-8 text-right text-xs font-mono text-[#737373]">
                  {isMuted ? 0 : volume}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BURGER MENU */}
        <Sheet>
          <SheetTrigger asChild>
            <button className="w-9 h-9 flex items-center justify-center bg-[#1f1f1f] text-white rounded-sm hover:bg-[#2a2a2a] transition">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-[#0a0a0a] border-l border-[#2a2a2a] text-white">
            <SheetHeader>
              <SheetTitle className="text-[#99CCCC] font-tektur font-bold text-2xl tracking-wider">
                BØDEN
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 mt-12 px-4">
              <Link href={status === "authenticated" ? "/profile" : "/login"} className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                {status === "authenticated" ? "PROFILE" : "LOGIN / JOIN"}
              </Link>
              {status === "authenticated" && (
                <Link
                  href="/mix-submission"
                  className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2 text-orange-500/80"
                >
                  MIX SUBMISSION
                </Link>
              )}
              <Link href="/about" className="text-xl font-mono hover:text-[#99CCCC] transition-colors border-b border-[#2a2a2a] pb-2">
                ABOUT US
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}