import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import fs from "fs"
import path from "path"

const STICKERS_FILE = path.join(process.cwd(), "data", "sticker-packs.json")

export async function GET() {
    try {
        const data = fs.readFileSync(STICKERS_FILE, "utf-8")
        return NextResponse.json(JSON.parse(data))
    } catch {
        return NextResponse.json([])
    }
}

export async function POST(req: Request) {
    const session = await auth()

    // Only superadmin can modify stickers
    // @ts-ignore
    if (!session?.user?.isSuperAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    try {
        const packs = await req.json()
        fs.writeFileSync(STICKERS_FILE, JSON.stringify(packs, null, 2))
        return NextResponse.json({ success: true, packs })
    } catch (error) {
        return NextResponse.json({ error: "Failed to save sticker packs" }, { status: 500 })
    }
}
