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
    favoriteArtists: number[] // IDs
    role: "listener"
    provider: "credentials" | "google" | "apple"
    isPremium?: boolean
    pushSubscriptions?: any[] // Web Push subscriptions
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
    favoriteArtists?: number[]
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

export function toggleFavoriteArtist(email: string, artistId: number): number[] {
    const listeners = getListeners()
    const index = listeners.findIndex(l => l.email === email.toLowerCase())
    if (index === -1) throw new Error("User not found")

    const listener = listeners[index]
    const currentFavorites = listener.favoriteArtists || []

    let newFavorites: number[]
    if (currentFavorites.includes(artistId)) {
        newFavorites = currentFavorites.filter(id => id !== artistId)
    } else {
        newFavorites = [...currentFavorites, artistId]
    }

    listeners[index] = { ...listener, favoriteArtists: newFavorites }
    saveListeners(listeners)
    return newFavorites
}
