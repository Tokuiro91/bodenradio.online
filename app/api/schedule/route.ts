import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const CSV_PATH = path.join(process.cwd(), "data", "schedule.csv")

// Resolve the same mixes directory as the media route
const MIXES_DIR = fs.existsSync("/var/radio/mixes")
    ? "/var/radio/mixes"
    : path.join(process.cwd(), "data", "radio", "mixes")

// Convert a bare filename to a full filesystem path Liquidsoap can read
function toFullPath(file: string): string {
    if (!file || file === "SILENCE") return file
    if (path.isAbsolute(file)) return file
    return path.join(MIXES_DIR, path.basename(file))
}

// Strip the mixes directory prefix for display in the UI
function toDisplayName(file: string): string {
    if (!file || file === "SILENCE") return file
    for (const prefix of [MIXES_DIR, "/var/radio/mixes"]) {
        if (file.startsWith(prefix + "/")) return file.slice(prefix.length + 1)
    }
    return path.basename(file)
}

export async function GET() {
    try {
        if (!fs.existsSync(CSV_PATH)) {
            return NextResponse.json({ schedule: [] })
        }
        const data = fs.readFileSync(CSV_PATH, "utf8")
        const lines = data.split("\n").filter(line => line.trim() !== "")
        const schedule = lines.slice(1).map(line => {
            const parts = line.split(",")
            if (parts.length === 3) {
                // Old format: date,time,file
                const [date, time, file] = parts
                return { date, time, end_time: "", file: toDisplayName(file) }
            } else {
                // New format: date,time,end_time,file
                const [date, time, end_time, file] = parts
                return { date, time, end_time: end_time || "", file: toDisplayName(file) }
            }
        })
        return NextResponse.json({ schedule })
    } catch (error) {
        return NextResponse.json({ error: "Failed to read schedule" }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { schedule } = await req.json()
        // Sort schedule by date and time to keep CSV organized
        const sortedSchedule = [...schedule].sort((a: any, b: any) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });

        let csvContent = "date,time,end_time,file\n"
        sortedSchedule.forEach((entry: any) => {
            // Convert to full filesystem path for Liquidsoap
            const fullPath = toFullPath(entry.file)
            // Ensure fields are comma-safe
            const safeDate = entry.date.trim()
            const safeTime = entry.time.trim()
            const safeEnd = (entry.end_time || "").trim()
            csvContent += `${safeDate},${safeTime},${safeEnd},${fullPath}\n`
        })
        fs.writeFileSync(CSV_PATH, csvContent)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Schedule save error:", error)
        return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 })
    }
}
