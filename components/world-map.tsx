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
}

export function WorldMap({ artists = [], currentPlayingIndex = -1, onArtistSelect }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [dotGroups, setDotGroups] = useState<DotGroup[]>([])
  const [popupGroup, setPopupGroup] = useState<DotGroup | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // All mutable map state lives here — avoids stale closures
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
  })

  const recomputeDots = useCallback(() => {
    const s = S.current
    if (!s.projection || !s.mapW) return

    const validArtists = artists.filter(a => a.lat != null && a.lng != null)

    // Group artists within ~0.5 degree of each other
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

      const scale = cw / 4.5
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

      s.projection = d3.geoNaturalEarth1()
        .scale(scale)
        .translate([s.mapW / 2, s.mapH / 2])

      s.geoPath = d3.geoPath(s.projection, ctx)

      if (s.geoData) renderMap()
      recomputeDots()
    }

    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then(r => r.json())
      .then(data => { s.geoData = data; buildMap() })
      .catch(() => { s.geoData = { type: "FeatureCollection", features: [] }; buildMap() })

    window.addEventListener("resize", buildMap)

    const onMouseMove = (e: MouseEvent) => {
      const rect = container!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      s.targetX = -nx * s.maxShiftX * 2
      s.targetY = -ny * s.maxShiftY * 2
    }
    const onMouseLeave = () => { s.targetX = 0; s.targetY = 0 }

    container.addEventListener("mousemove", onMouseMove)
    container.addEventListener("mouseleave", onMouseLeave)

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
      cancelAnimationFrame(s.rafId)
    }
  }, [recomputeDots])

  useEffect(() => {
    recomputeDots()
  }, [recomputeDots])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopupGroup(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
          0%  { r: 6;  opacity: 0.75; }
          100%{ r: 22; opacity: 0; }
        }
        .map-ping   { animation: mapPing 1.8s ease-out infinite; }
        .map-ping-2 { animation: mapPing 1.8s ease-out 0.7s infinite; }
      `}</style>

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

        {/* SVG dot overlay */}
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
                  <circle cx={group.cx} cy={group.cy} r={6} fill="#99CCCC" className="map-ping" />
                  <circle cx={group.cx} cy={group.cy} r={6} fill="#99CCCC" className="map-ping-2" />
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

        {/* Hover tooltip */}
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

        {/* Multi-artist popup */}
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
