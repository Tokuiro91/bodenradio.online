import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const MIXES_DIR = path.join(process.cwd(), "public", "radio", "mixes")

export async function GET() {
    try {
        if (!fs.existsSync(MIXES_DIR)) {
            fs.mkdirSync(MIXES_DIR, { recursive: true })
            return NextResponse.json({ files: [] })
        }
        const files = fs.readdirSync(MIXES_DIR)
            .filter(f => !f.startsWith("."))
            .map(f => {
                const stats = fs.statSync(path.join(MIXES_DIR, f))
                return {
                    name: f,
                    url: `/radio/mixes/${f}`,
                    size: stats.size,
                    mtime: stats.mtime
                }
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

        return NextResponse.json({ files })
    } catch (error) {
        return NextResponse.json({ error: "Failed to list mixes" }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        if (!fs.existsSync(MIXES_DIR)) {
            fs.mkdirSync(MIXES_DIR, { recursive: true })
        }

        // Use original filename but make it safe
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const filePath = path.join(MIXES_DIR, safeName)

        const arrayBuffer = await file.arrayBuffer()
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer))

        return NextResponse.json({ success: true, url: `/radio/mixes/${safeName}`, name: safeName })
    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { filename } = await req.json()
        if (!filename) return NextResponse.json({ error: "Filename required" }, { status: 400 })

        const filePath = path.join(MIXES_DIR, filename)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: "File not found" }, { status: 404 })
    } catch (error) {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }
}
