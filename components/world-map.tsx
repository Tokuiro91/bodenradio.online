"use client"

import { useRef, useEffect } from "react"
import * as d3 from "d3"

export function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

      s.maxShiftX = Math.max(0, s.mapW / 2 - cw / 2)
      s.maxShiftY = Math.max(0, s.mapH / 2 - ch / 2)

      s.projection = d3.geoNaturalEarth1()
        .scale(scale)
        .translate([s.mapW / 2, s.mapH / 2])

      s.geoPath = d3.geoPath(s.projection, ctx)

      if (s.geoData) renderMap()
    }

    // Load world data
    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then(r => r.json())
      .then(data => { s.geoData = data; buildMap() })
      .catch(() => { s.geoData = { type: "FeatureCollection", features: [] }; buildMap() })

    window.addEventListener("resize", buildMap)

    // Mouse pan
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

    // Smooth pan loop
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
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-crosshair"
      style={{ background: "#080808" }}
    >
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
      </div>
    </div>
  )
}
