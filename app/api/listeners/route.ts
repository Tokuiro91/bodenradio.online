import { NextResponse } from "next/server"
import { getListeners, deleteListener, updateListener } from "@/lib/listeners-store"
import { auth } from "@/lib/auth"

export async function GET() {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admins get the full listener list, excluding passwords
    const listeners = getListeners().map(l => {
        const { password, ...safeData } = l
        return safeData
    })

    return NextResponse.json(listeners)
}

export async function DELETE(req: Request) {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    deleteListener(email)
    return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
    const session = await auth()
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, ...updateData } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    updateListener(email, updateData)
    return NextResponse.json({ success: true })
}
