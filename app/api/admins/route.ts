import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import fs from "fs"
import path from "path"

const ADMINS_FILE = path.join(process.cwd(), "data", "admins.json")

function readAdmins(): string[] {
    try {
        return JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"))
    } catch {
        return []
    }
}

function writeAdmins(emails: string[]) {
    const dir = path.dirname(ADMINS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(emails, null, 2))
}

export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ admins: readAdmins() })
}

export async function POST(request: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { email } = await request.json()
    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const admins = readAdmins()
    if (!admins.includes(email)) {
        admins.push(email)
        writeAdmins(admins)
    }
    return NextResponse.json({ admins })
}

export async function DELETE(request: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { email } = await request.json()

    const superadmin = (process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim()
    if (superadmin && email.toLowerCase() === superadmin) {
        return NextResponse.json({ error: "Cannot delete the main administrator" }, { status: 403 })
    }

    const admins = readAdmins().filter((e) => e !== email)
    writeAdmins(admins)
    return NextResponse.json({ admins })
}
