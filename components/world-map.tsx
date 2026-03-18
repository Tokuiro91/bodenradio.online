"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import * as d3 from "d3"

interface MapArtist {
  id: number
  name: string
  lat?: number
  lng?: number
  sortedIndex: number
}

interface DotGroup {
  cx: number
  cy: number
  artists: MapArtist[]
  isLive: boolean
}

interface WorldMapProps {
  artists?: MapArtist[]
  currentPlayingIndex?: number
  onArtistSelect?: (sortedIndex: number) => void
  isOpen?: boolean
}

export function WorldMap({ artists = [], currentPlayingIndex = -1, onArtistSelect, isOpen }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [dotGroups, setDotGroups] = useState<DotGroup[]>([])
  const [popupGroup, setPopupGroup] = useState<DotGroup | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [zoom, setZoom] = useState(1)

  const S = useRef({
    mapW: 0,
    mapH: 0,
    geoData: null as any,
    projection: null as d3.GeoProjection | null,
    geoPath: null as d3.GeoPath | null,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    maxShiftX: 0,
    maxShiftY: 0,
    rafId: 0,
    zoom: 1,
    // exposed rebuild so zoom buttons can call it
    buildMap: null as (() => void) | null,
    ctx: null as CanvasRenderingContext2D | null,
  })

  // Center on Europe when map opens
  useEffect(() => {
    if (isOpen) {
      const s = S.current
      if (s.projection && s.mapW) {
        // Project Europe center [lng, lat]
        const projected = s.projection([15, 50])
        if (projected) {
          const [cx, cy] = projected
          const tx = Math.max(-s.maxShiftX, Math.min(s.maxShiftX, s.mapW / 2 - cx))
          const ty = Math.max(-s.maxShiftY, Math.min(s.maxShiftY, s.mapH / 2 - cy))
          s.targetX = tx
          s.targetY = ty
          s.currentX = tx
          s.currentY = ty
        }
      } else {
        s.targetX = 0
        s.targetY = 0
        s.currentX = 0
        s.currentY = 0
      }
    }
  }, [isOpen])

  const recomputeDots = useCallback(() => {
    const s = S.current
    if (!s.projection || !s.mapW) return

    const validArtists = artists.filter(a => a.lat != null && a.lng != null)
    const groups: Map<string, MapArtist[]> = new Map()
    for (const a of validArtists) {
      const key = `${Math.round(a.lat! * 2) / 2},${Math.round(a.lng! * 2) / 2}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(a)
    }

    const newDots: DotGroup[] = []
    for (const group of groups.values()) {
      const first = group[0]
      const projected = s.projection([first.lng!, first.lat!])
      if (!projected) continue
      const [cx, cy] = projected
      if (cx < 0 || cy < 0 || cx > s.mapW || cy > s.mapH) continue
      const isLive = group.some(a => a.sortedIndex === currentPlayingIndex)
      newDots.push({ cx, cy, artists: group, isLive })
    }

    setDotGroups(newDots)
  }, [artists, currentPlayingIndex])

  useEffect(() => {
    const s = S.current
    const container = containerRef.current
    const inner = innerRef.current
    const canvas = canvasRef.current
    if (!container || !inner || !canvas) return

    const ctx = canvas.getContext("2d")!
    s.ctx = ctx

    function renderMap() {
      if (!s.geoData || !s.geoPath) return
      ctx.clearRect(0, 0, s.mapW, s.mapH)

      const grat = d3.geoGraticule()()
      ctx.beginPath()
      s.geoPath!(grat)
      ctx.strokeStyle = "rgba(153,204,204,0.03)"
      ctx.lineWidth = 0.5
      ctx.stroke()

      ctx.beginPath()
      s.geoPath!({ type: "FeatureCollection", features: s.geoData.features })
      ctx.fillStyle = "#0d1b22"
      ctx.fill()

      s.geoData.features.forEach((f: any) => {
        ctx.beginPath()
        s.geoPath!(f)
        ctx.strokeStyle = "rgba(153,204,204,0.1)"
        ctx.lineWidth = 0.35
        ctx.stroke()
      })
    }

    function buildMap() {
      const cw = container!.offsetWidth
      const ch = container!.offsetHeight
      if (cw === 0 || ch === 0) return

      const baseScale = cw / 4.5
      const scale = baseScale * s.zoom

      s.mapW = Math.round(scale * 2 * Math.PI)
      s.mapH = Math.round(scale * 3.27)

      canvas!.width = s.mapW
      canvas!.height = s.mapH
      canvas!.style.width = s.mapW + "px"
      canvas!.style.height = s.mapH + "px"
      inner!.style.width = s.mapW + "px"
      inner!.style.height = s.mapH + "px"

      if (svgRef.current) {
        svgRef.current.setAttribute("width", String(s.mapW))
        svgRef.current.setAttribute("height", String(s.mapH))
        svgRef.current.style.width = s.mapW + "px"
        svgRef.current.style.height = s.mapH + "px"
      }

      s.maxShiftX = Math.max(0, s.mapW / 2 - cw / 2)
      s.maxShiftY = Math.max(0, s.mapH / 2 - ch / 2)

      // Clamp pan to new limits
      s.targetX = Math.max(-s.maxShiftX, Math.min(s.maxShiftX, s.targetX))
      s.targetY = Math.max(-s.maxShiftY, Math.min(s.maxShiftY, s.targetY))

      s.projection = d3.geoNaturalEarth1()
        .scale(scale)
        .translate([s.mapW / 2, s.mapH / 2])

      s.geoPath = d3.geoPath(s.projection, ctx)

      if (s.geoData) renderMap()
      recomputeDots()
    }

    s.buildMap = buildMap

    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then(r => r.json())
      .then(data => { s.geoData = data; buildMap() })
      .catch(() => { s.geoData = { type: "FeatureCollection", features: [] }; buildMap() })

    window.addEventListener("resize", buildMap)

    // Mouse pan (only updates target; actual motion via RAF)
    const onMouseMove = (e: MouseEvent) => {
      const rect = container!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      s.targetX = Math.max(-s.maxShiftX, Math.min(s.maxShiftX, -nx * s.maxShiftX * 2))
      s.targetY = Math.max(-s.maxShiftY, Math.min(s.maxShiftY, -ny * s.maxShiftY * 2))
    }
    const onMouseLeave = () => { s.targetX = s.currentX; s.targetY = s.currentY }

    // Scroll zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.12 : 0.12
      const newZoom = Math.max(0.6, Math.min(6, s.zoom + delta))
      s.zoom = newZoom
      setZoom(newZoom)
      buildMap()
    }

    container.addEventListener("mousemove", onMouseMove)
    container.addEventListener("mouseleave", onMouseLeave)
    container.addEventListener("wheel", onWheel, { passive: false })

    const tick = () => {
      s.currentX += (s.targetX - s.currentX) * 0.055
      s.currentY += (s.targetY - s.currentY) * 0.055
      inner!.style.transform = `translate(calc(-50% + ${s.currentX.toFixed(2)}px), calc(-50% + ${s.currentY.toFixed(2)}px))`
      s.rafId = requestAnimationFrame(tick)
    }
    s.rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("resize", buildMap)
      container.removeEventListener("mousemove", onMouseMove)
      container.removeEventListener("mouseleave", onMouseLeave)
      container.removeEventListener("wheel", onWheel)
      cancelAnimationFrame(s.rafId)
    }
  }, [recomputeDots])

  useEffect(() => { recomputeDots() }, [recomputeDots])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopupGroup(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleZoom = (dir: 1 | -1) => {
    const s = S.current
    const newZoom = Math.max(0.6, Math.min(6, s.zoom + dir * 0.35))
    s.zoom = newZoom
    setZoom(newZoom)
    s.buildMap?.()
  }

  const handleDotClick = (group: DotGroup) => {
    if (group.artists.length === 1) {
      onArtistSelect?.(group.artists[0].sortedIndex)
      setPopupGroup(null)
    } else {
      setPopupGroup(g => (g === group ? null : group))
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-crosshair"
      style={{ background: "#080808" }}
      onClick={() => setPopupGroup(null)}
    >
      <style>{`
        @keyframes mapPing {
          0%   { r: 6;  opacity: 0.35; }
          100% { r: 26; opacity: 0; }
        }
        .map-ping-1 { animation: mapPing 4s ease-out infinite; }
        .map-ping-2 { animation: mapPing 4s ease-out 1s infinite; }
        .map-ping-3 { animation: mapPing 4s ease-out 2s infinite; }
        .map-ping-4 { animation: mapPing 4s ease-out 3s infinite; }
      `}</style>

      {/* Zoom controls — right side */}
      <div
        style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
        className="flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => handleZoom(1)}
          className="flex items-center justify-center font-mono text-[#99CCCC] hover:text-white transition-colors duration-200"
          style={{
            width: 40, height: 40,
            fontSize: 26,
            lineHeight: 1,
            border: "1px solid rgba(153,204,204,0.25)",
            background: "rgba(8,8,8,0.7)",
            letterSpacing: "-1px",
          }}
        >
          +
        </button>
        <button
          onClick={() => handleZoom(-1)}
          className="flex items-center justify-center font-mono text-[#99CCCC] hover:text-white transition-colors duration-200"
          style={{
            width: 40, height: 40,
            fontSize: 26,
            lineHeight: 1,
            border: "1px solid rgba(153,204,204,0.25)",
            background: "rgba(8,8,8,0.7)",
            letterSpacing: "-1px",
          }}
        >
          −
        </button>
      </div>

      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          willChange: "transform",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", position: "absolute", top: 0, left: 0 }}
        />

        <svg
          ref={svgRef}
          style={{ display: "block", position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          {dotGroups.map((group, i) => (
            <g
              key={i}
              style={{ cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); handleDotClick(group) }}
              onMouseEnter={() => setTooltip({
                x: group.cx,
                y: group.cy - 14,
                text: group.artists.length === 1
                  ? group.artists[0].name.toUpperCase()
                  : `${group.artists.length} ARTISTS`,
              })}
              onMouseLeave={() => setTooltip(null)}
            >
              {group.isLive && (
                <>
                  {/* 4 expanding echo rings */}
                  <circle cx={group.cx} cy={group.cy} r={7} fill="#99CCCC" className="map-ping-1" />
                  <circle cx={group.cx} cy={group.cy} r={7} fill="#99CCCC" className="map-ping-2" />
                  <circle cx={group.cx} cy={group.cy} r={7} fill="#99CCCC" className="map-ping-3" />
                  <circle cx={group.cx} cy={group.cy} r={7} fill="#99CCCC" className="map-ping-4" />
                  {/* Static outer ring — always visible on open */}
                  <circle cx={group.cx} cy={group.cy} r={12} fill="none" stroke="#99CCCC" strokeWidth={1.5} opacity={0.55} />
                </>
              )}
              <circle
                cx={group.cx}
                cy={group.cy}
                r={group.artists.length > 1 ? 7 : 5}
                fill="#99CCCC"
                opacity={0.9}
                stroke="#080808"
                strokeWidth={1.5}
              />
              {group.artists.length > 1 && (
                <text
                  x={group.cx}
                  y={group.cy + 4}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="monospace"
                  fill="#080808"
                  fontWeight="bold"
                >
                  {group.artists.length}
                </text>
              )}
            </g>
          ))}
        </svg>

        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translateX(-50%) translateY(-100%)",
              pointerEvents: "none",
            }}
            className="bg-[#0d1b22] border border-[#99CCCC]/30 px-2 py-1 font-mono text-[9px] tracking-widest text-[#99CCCC] whitespace-nowrap"
          >
            {tooltip.text}
          </div>
        )}

        {popupGroup && (
          <div
            style={{
              position: "absolute",
              left: popupGroup.cx,
              top: popupGroup.cy - 14,
              transform: "translateX(-50%) translateY(-100%)",
              zIndex: 50,
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d1b22] border border-[#99CCCC]/40 min-w-[140px]"
          >
            {popupGroup.artists.map(a => (
              <button
                key={a.sortedIndex}
                onClick={() => { onArtistSelect?.(a.sortedIndex); setPopupGroup(null) }}
                className="block w-full text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#99CCCC] hover:bg-[#99CCCC]/10 border-b border-[#1a1a1a] last:border-0"
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
