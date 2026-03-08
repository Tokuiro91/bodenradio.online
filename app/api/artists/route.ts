import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { generateArtists } from "@/lib/artists-data"
import type { Artist } from "@/lib/artists-data"

const DATA_FILE = path.join(process.cwd(), "data", "artists.json")

function ensureDataDir() {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

function readArtists(): Artist[] {
    ensureDataDir()
    if (!fs.existsSync(DATA_FILE)) {
        return generateArtists()
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, "utf-8")
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Artist[]
    } catch {
        // fall through to default
    }
    return generateArtists()
}


/** Check if two [start, end) intervals overlap */
function slotsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
    const artists = readArtists()
    return NextResponse.json(artists, {
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    })
}

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Body can be either:
        //   { artists: Artist[], newId: number }  ← preferred (with ID of the new/edited artist)
        //   Artist[]                               ← legacy (skip overlap check)
        let artists: Artist[]
        let newId: number | null = null

        if (Array.isArray(body)) {
            artists = body as Artist[]
        } else if (body && Array.isArray(body.artists)) {
            artists = body.artists as Artist[]
            newId = typeof body.newId === "number" ? body.newId : null
        } else {
            return NextResponse.json({ error: "Expected array or { artists, newId }" }, { status: 400 })
        }

        // ── Overlap validation ──────────────────────────────────────────────
        if (newId !== null) {
            const target = artists.find((a) => a.id === newId)
            if (target && target.startTime && target.endTime) {
                const tStart = new Date(target.startTime).getTime()
                const tEnd = new Date(target.endTime).getTime()

                if (!isNaN(tStart) && !isNaN(tEnd)) {
                    for (const other of artists) {
                        if (other.id === target.id) continue
                        if (!other.startTime || !other.endTime) continue

                        const oStart = new Date(other.startTime).getTime()
                        const oEnd = new Date(other.endTime).getTime()

                        if (isNaN(oStart) || isNaN(oEnd)) continue

                        if (slotsOverlap(tStart, tEnd, oStart, oEnd)) {
                            const timeA = new Date(tStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            const timeB = new Date(oStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            return NextResponse.json(
                                {
                                    error: `Конфликт во времени: "${target.name}" (${timeA}) пересекается с "${other.name}" (${timeB}). Пожалуйста, выберите другое время.`,
                                    conflict: { a: target.name, b: other.name },
                                },
                                { status: 409 }
                            )
                        }
                    }
                }
            }
        }

        ensureDataDir()
        fs.writeFileSync(DATA_FILE, JSON.stringify(artists, null, 2), "utf-8")
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("POST /api/artists error:", err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
