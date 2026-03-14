import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"

const DB_FILE = path.join(process.cwd(), "data", "artist-db.json")

export interface DBArtist {
    id: string
    name: string
    location: string
    show: string
    image: string
    description: string
    audioUrl?: string
    instagramUrl?: string
    soundcloudUrl?: string
    bandcampUrl?: string
    isLottie?: boolean
    scheduleCount?: number  // persistent: total times added to schedule (never decremented)
    favoritesCount?: number // computed by API, not stored in JSON
}

function ensureDirectoryExistence(filePath: string) {
    const dirname = path.dirname(filePath)
    if (fs.existsSync(dirname)) return
    fs.mkdirSync(dirname, { recursive: true })
}

export function getArtistDB(): DBArtist[] {
    try {
        ensureDirectoryExistence(DB_FILE)
        if (!fs.existsSync(DB_FILE)) return []
        const content = fs.readFileSync(DB_FILE, "utf-8")
        return JSON.parse(content) as DBArtist[]
    } catch {
        return []
    }
}

export function saveArtistDB(artists: DBArtist[]) {
    ensureDirectoryExistence(DB_FILE)
    fs.writeFileSync(DB_FILE, JSON.stringify(artists, null, 2))
}

export function createDBArtist(data: Omit<DBArtist, "id">): DBArtist {
    const artists = getArtistDB()
    const newArtist: DBArtist = {
        ...data,
        id: randomUUID(),
    }
    artists.push(newArtist)
    saveArtistDB(artists)
    return newArtist
}

export function updateDBArtist(id: string, updates: Partial<DBArtist>): DBArtist | undefined {
    const artists = getArtistDB()
    const index = artists.findIndex(a => a.id === id)
    if (index === -1) return undefined

    artists[index] = { ...artists[index], ...updates }
    saveArtistDB(artists)
    return artists[index]
}

export function incrementScheduleCount(id: string): void {
    const artists = getArtistDB()
    const index = artists.findIndex(a => a.id === id)
    if (index === -1) return
    artists[index] = { ...artists[index], scheduleCount: (artists[index].scheduleCount || 0) + 1 }
    saveArtistDB(artists)
}

export function deleteDBArtist(id: string) {
    let artists = getArtistDB()
    artists = artists.filter(a => a.id !== id)
    saveArtistDB(artists)
}

export function syncDBArtists(newArtistsData: Omit<DBArtist, "id">[]) {
    const artists = getArtistDB()
    let updated = false

    for (const data of newArtistsData) {
        const existingIndex = artists.findIndex(a => a.name.toLowerCase().trim() === data.name.toLowerCase().trim())
        if (existingIndex !== -1) {
            artists[existingIndex] = { ...artists[existingIndex], ...data }
            updated = true
        } else {
            artists.push({
                ...data,
                id: randomUUID()
            })
            updated = true
        }
    }

    if (updated) {
        saveArtistDB(artists)
    }
    return artists
}
