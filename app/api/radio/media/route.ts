import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Use a path that won't cause build-time symlink issues
// On VPS, we use the absolute path directly to avoid Turbopack symlink errors
let MIXES_DIR = path.join(process.cwd(), "data", "radio", "mixes")
if (fs.existsSync("/var/radio/mixes")) {
    MIXES_DIR = "/var/radio/mixes"
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const filename = searchParams.get("file")

        // 1. Serve file content if filename is provided
        if (filename) {
            const safeName = path.basename(filename)
            const filePath = path.join(MIXES_DIR, safeName)
            if (!fs.existsSync(filePath)) {
                return new NextResponse("File not found", { status: 404 })
            }

            const stats = fs.statSync(filePath)
            const fileStream = fs.createReadStream(filePath)

            // Dynamic type detection based on extension
            const ext = path.extname(safeName).toLowerCase()
            const contentType = ext === ".mp3" ? "audio/mpeg" : "application/octet-stream"

            // @ts-ignore
            return new NextResponse(fileStream, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Length": stats.size.toString(),
                    "Accept-Ranges": "bytes",
                }
            })
        }

        // 2. List files
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
                    url: `/api/radio/media?file=${encodeURIComponent(f)}`,
                    size: stats.size,
                    mtime: stats.mtime
                }
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

        return NextResponse.json({ files })
    } catch (error) {
        console.error("Media API error:", error)
        return NextResponse.json({ error: "Failed to process media request" }, { status: 500 })
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '500mb',
        },
    },
};

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

        return NextResponse.json({
            success: true,
            url: `/api/radio/media?file=${encodeURIComponent(safeName)}`,
            name: safeName
        })
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
