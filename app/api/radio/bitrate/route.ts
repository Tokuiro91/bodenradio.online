import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), "data", "radio_config.json")

export async function GET() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return NextResponse.json({ bitrate: 192 })
        }
        const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ bitrate: 192 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { bitrate } = await req.json()
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ bitrate }))
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to save bitrate" }, { status: 500 })
    }
}
