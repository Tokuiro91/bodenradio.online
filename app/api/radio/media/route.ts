import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"


/** Wrap a Node.js ReadableStream into a Web API ReadableStream. */
function nodeToWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk: Buffer | string) => {
                controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
            })
            nodeStream.on("end", () => controller.close())
            nodeStream.on("error", (err) => controller.error(err))
        },
        cancel() {
            nodeStream.destroy()
        }
    })
}

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
            const ext = path.extname(safeName).toLowerCase()
            const contentType = ext === ".mp3" ? "audio/mpeg" : "application/octet-stream"
            const fileSize = stats.size

            // Handle Range requests for audio seeking
            const rangeHeader = req.headers.get("range")
            if (rangeHeader) {
                const [, rangeStr] = rangeHeader.split("=")
                const [startStr, endStr] = rangeStr.split("-")
                const start = parseInt(startStr, 10)
                const end = endStr ? parseInt(endStr, 10) : fileSize - 1
                const chunkSize = end - start + 1

                return new NextResponse(nodeToWebStream(fs.createReadStream(filePath, { start, end })), {
                    status: 206,
                    headers: {
                        "Content-Type": contentType,
                        "Content-Length": chunkSize.toString(),
                        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                        "Accept-Ranges": "bytes",
                    },
                })
            }

            return new NextResponse(nodeToWebStream(fs.createReadStream(filePath)), {
                headers: {
                    "Content-Type": contentType,
                    "Content-Length": fileSize.toString(),
                    "Accept-Ranges": "bytes",
                },
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
