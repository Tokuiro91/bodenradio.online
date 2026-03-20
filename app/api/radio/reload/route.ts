import { NextResponse } from "next/server"
import net from "net"
import fs from "fs"
import path from "path"

const LIQUIDSOAP_HOST = "localhost"
const LIQUIDSOAP_PORT = 1234
const TIMEOUT_MS = 3000

// Anti-repeat state file written by liq-bridge.js
const STATE_FILE = path.join(process.cwd(), "data", "last_played_slot.txt")

// Fire-and-forget: send command immediately on connect, close after response arrives
function sendLiquidsoapCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket()
        let response = ""
        let settled = false

        const finish = (err?: Error) => {
            if (settled) return
            settled = true
            socket.destroy()
            if (err) reject(err)
            else resolve(response.trim())
        }

        socket.setTimeout(TIMEOUT_MS)
        socket.on("timeout", () => finish(new Error("Connection timed out")))
        socket.on("error", (err) => finish(err))

        socket.on("data", (chunk) => {
            response += chunk.toString()
            // As soon as we get any response back, we're done — no need to wait
            if (response.includes("\n")) finish()
        })

        socket.connect(LIQUIDSOAP_PORT, LIQUIDSOAP_HOST, () => {
            // Write immediately — no banner wait needed
            socket.write(command + "\nquit\n")
        })
    })
}

export async function POST(request: Request) {
    const url = new URL(request.url)
    const force = url.searchParams.get("force") === "true"

    // Soft reload: schedule file is already saved on disk, liq-bridge will
    // pick up future changes on its next poll cycle — no need to interrupt
    // whatever is currently playing.
    if (!force) {
        return NextResponse.json({ success: true, message: "Schedule saved" })
    }

    // Force reload: clear anti-repeat state + flush_and_skip current track
    try {
        fs.writeFileSync(STATE_FILE, "")
    } catch { /* non-fatal */ }

    try {
        const result = await sendLiquidsoapCommand("radio_scheduler.flush_and_skip")
        return NextResponse.json({ success: true, message: result || "Applied" })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || "Liquidsoap unreachable" },
            { status: 503 }
        )
    }
}
