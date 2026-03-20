import fs from "fs"
import path from "path"

const ANALYTICS_DIR = path.join(process.cwd(), "data")
const SESSIONS_FILE = path.join(ANALYTICS_DIR, "analytics-sessions.jsonl")
const EVENTS_FILE = path.join(ANALYTICS_DIR, "analytics-events.jsonl")

// Ensure data directory exists
if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true })
}

export interface AnalyticsSession {
    id: string // UUID
    startedAt: number
    lastActive: number
    ip?: string
    userAgent: string
    referrer: string
    source: "direct" | "referral" | "social" | "search" | "other"
    country?: string
    city?: string
    totalDurationMs: number
    isRegistered?: boolean
    userName?: string
}

export interface AnalyticsEvent {
    sessionId: string
    timestamp: number
    type: "pageview" | "play" | "pause"
    path?: string // For pageviews
}

export function appendSession(session: AnalyticsSession) {
    try {
        const line = JSON.stringify(session) + "\n"
        fs.appendFileSync(SESSIONS_FILE, line, "utf-8")
    } catch (err) {
        console.error("Failed to append session:", err)
    }
}

export function updateSession(session: AnalyticsSession) {
    try {
        // Read all sessions
        const sessions = getSessions()
        const idx = sessions.findIndex((s) => s.id === session.id)
        if (idx >= 0) {
            sessions[idx] = session
            // Rewrite the file
            const lines = sessions.map((s) => JSON.stringify(s)).join("\n") + "\n"
            fs.writeFileSync(SESSIONS_FILE, lines, "utf-8")
        } else {
            appendSession(session)
        }
    } catch (err) {
        console.error("Failed to update session:", err)
    }
}

export function getSessions(): AnalyticsSession[] {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) return []
        const content = fs.readFileSync(SESSIONS_FILE, "utf-8")
        return content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
    } catch (err) {
        console.error("Failed to read sessions:", err)
        return []
    }
}

export function appendEvent(event: AnalyticsEvent) {
    try {
        const line = JSON.stringify(event) + "\n"
        fs.appendFileSync(EVENTS_FILE, line, "utf-8")
    } catch (err) {
        console.error("Failed to append event:", err)
    }
}

export function getEvents(): AnalyticsEvent[] {
    try {
        if (!fs.existsSync(EVENTS_FILE)) return []
        const content = fs.readFileSync(EVENTS_FILE, "utf-8")
        return content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
    } catch (err) {
        console.error("Failed to read events:", err)
        return []
    }
}
