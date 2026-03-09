import fs from "fs"
import path from "path"
import bcrypt from "bcryptjs"

const LISTENERS_FILE = path.join(process.cwd(), "data", "listeners.json")

export interface Listener {
    id: string
    email: string
    password?: string
    name?: string
    avatar?: string
    favoriteArtists: string[] // IDs (dbId)
    role: "listener"
    provider: "credentials" | "google" | "apple"
    isPremium?: boolean
    pushSubscriptions?: any[] // Web Push subscriptions
    pushEnabled?: boolean
}

function ensureDirectoryExistence(filePath: string) {
    const dirname = path.dirname(filePath)
    if (fs.existsSync(dirname)) return
    fs.mkdirSync(dirname, { recursive: true })
}

export function getListeners(): Listener[] {
    try {
        ensureDirectoryExistence(LISTENERS_FILE)
        if (!fs.existsSync(LISTENERS_FILE)) return []
        const content = fs.readFileSync(LISTENERS_FILE, "utf-8")
        return JSON.parse(content) as Listener[]
    } catch {
        return []
    }
}

export function saveListeners(listeners: Listener[]) {
    ensureDirectoryExistence(LISTENERS_FILE)
    fs.writeFileSync(LISTENERS_FILE, JSON.stringify(listeners, null, 2))
}

export async function createListener(data: {
    email: string
    password?: string
    name?: string
    provider: "credentials" | "google" | "apple"
    favoriteArtists?: string[]
}): Promise<Listener> {
    const listeners = getListeners()
    const exists = listeners.find((l) => l.email === data.email.toLowerCase())
    if (exists) throw new Error("User already exists")

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 12) : undefined

    const newListener: Listener = {
        id: data.email.toLowerCase(),
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name || data.email.split("@")[0],
        favoriteArtists: data.favoriteArtists || [],
        role: "listener",
        provider: data.provider,
        pushEnabled: true,
    }

    listeners.push(newListener)
    saveListeners(listeners)
    return newListener
}

export function findListenerByEmail(email: string): Listener | undefined {
    return getListeners().find((l) => l.email === email.toLowerCase())
}

export function deleteListener(email: string) {
    const listeners = getListeners()
    const next = listeners.filter(l => l.email.toLowerCase() !== email.toLowerCase())
    saveListeners(next)
}

export function updateListener(email: string, data: Partial<Listener>) {
    const listeners = getListeners()
    const index = listeners.findIndex(l => l.email.toLowerCase() === email.toLowerCase())
    if (index === -1) return
    listeners[index] = { ...listeners[index], ...data }
    saveListeners(listeners)
}

export function toggleFavoriteArtist(email: string, artistId: string): string[] {
    const listeners = getListeners()
    const index = listeners.findIndex(l => l.email === email.toLowerCase())
    if (index === -1) throw new Error("User not found")

    const listener = listeners[index]
    const currentFavorites = listener.favoriteArtists || []

    let newFavorites: string[]
    if (currentFavorites.includes(artistId)) {
        newFavorites = currentFavorites.filter(id => id !== artistId)
    } else {
        newFavorites = [...currentFavorites, artistId]
    }

    listeners[index] = { ...listener, favoriteArtists: newFavorites }
    saveListeners(listeners)
    return newFavorites
}
export function ensureListenerExists(email: string, name?: string): Listener {
    const existing = findListenerByEmail(email)
    if (existing) return existing

    const listeners = getListeners()
    const newListener: Listener = {
        id: email.toLowerCase(),
        email: email.toLowerCase(),
        name: name || email.split("@")[0],
        favoriteArtists: [],
        role: "listener",
        provider: "google", // Default for auto-created
        pushEnabled: true,
    }

    listeners.push(newListener)
    saveListeners(listeners)
    return newListener
}
