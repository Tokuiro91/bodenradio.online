import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Boden Radio — Live Electronic Music"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 80,
          padding: "0 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left — radio wave icon */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: 200, height: 200 }}>
          {/* concentric arcs via box-shadow trick using borders */}
          <div style={{ position: "absolute", width: 200, height: 100, borderRadius: "100px 100px 0 0", border: "2px solid #99CCCC", opacity: 0.15, top: 0 }} />
          <div style={{ position: "absolute", width: 150, height: 75, borderRadius: "75px 75px 0 0", border: "2px solid #99CCCC", opacity: 0.3, top: 25 }} />
          <div style={{ position: "absolute", width: 100, height: 50, borderRadius: "50px 50px 0 0", border: "2.5px solid #99CCCC", opacity: 0.55, top: 50 }} />
          <div style={{ position: "absolute", width: 50, height: 25, borderRadius: "25px 25px 0 0", border: "3px solid #99CCCC", opacity: 0.9, top: 75 }} />
          {/* center dot */}
          <div style={{ position: "absolute", width: 14, height: 14, borderRadius: 7, background: "#99CCCC", bottom: 0, left: 93 }} />
        </div>

        {/* Right — text block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ color: "#99CCCC", fontSize: 130, fontWeight: 800, letterSpacing: 8, lineHeight: 1 }}>
            BØDEN
          </div>
          <div style={{ color: "#555555", fontSize: 30, letterSpacing: 22, marginTop: 8, fontFamily: "monospace" }}>
            RADIO
          </div>
          <div style={{ width: 480, height: 1, background: "#2a2a2a", marginTop: 24 }} />
          <div style={{ color: "#3a3a3a", fontSize: 18, letterSpacing: 4, marginTop: 20, fontFamily: "monospace" }}>
            DEEP HOUSE · DUB TECHNO · AMBIENT · ELECTRONIC
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
