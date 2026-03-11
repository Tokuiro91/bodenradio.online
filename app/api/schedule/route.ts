import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const CSV_PATH = path.join(process.cwd(), "data", "schedule.csv")

export async function GET() {
    try {
        if (!fs.existsSync(CSV_PATH)) {
            return NextResponse.json({ schedule: [] })
        }
        const data = fs.readFileSync(CSV_PATH, "utf8")
        const lines = data.split("\n").filter(line => line.trim() !== "")
        const schedule = lines.slice(1).map(line => {
            const [date, time, end_time, file] = line.split(",")
            return { date, time, end_time: end_time || "", file }
        })
        return NextResponse.json({ schedule })
    } catch (error) {
        return NextResponse.json({ error: "Failed to read schedule" }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { schedule } = await req.json()
        let csvContent = "date,time,end_time,file\n"
        schedule.forEach((entry: any) => {
            csvContent += `${entry.date},${entry.time},${entry.end_time || ""},${entry.file}\n`
        })
        fs.writeFileSync(CSV_PATH, csvContent)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 })
    }
}
