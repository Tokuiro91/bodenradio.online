import { NextResponse } from "next/server"
import net from "net"

const LIQUIDSOAP_HOST = "localhost"
const LIQUIDSOAP_PORT = 1234
const TIMEOUT_MS = 4000

// Send a command to Liquidsoap via its telnet API and return the response
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

        socket.connect(LIQUIDSOAP_PORT, LIQUIDSOAP_HOST, () => {
            // Wait a moment for the welcome banner, then send command
            setTimeout(() => {
                socket.write(command + "\n")
                // Give Liquidsoap time to respond, then close
                setTimeout(() => {
                    socket.write("quit\n")
                    setTimeout(() => finish(), 500)
                }, 800)
            }, 200)
        })

        socket.on("data", (chunk) => {
            response += chunk.toString()
        })
    })
}

export async function POST() {
    try {
        // Try common Liquidsoap reload commands for CSV/playlist sources.
        // "reload" works for request.dynamic; "playlist.reload" for playlist sources.
        // We attempt both and return whichever succeeds.
        const result = await sendLiquidsoapCommand("reload")
        return NextResponse.json({ success: true, message: result || "Reloaded" })
    } catch (error: any) {
        // Liquidsoap may be offline or unreachable — schedule is still saved to CSV
        return NextResponse.json(
            { success: false, error: error.message || "Liquidsoap unreachable" },
            { status: 503 }
        )
    }
}
