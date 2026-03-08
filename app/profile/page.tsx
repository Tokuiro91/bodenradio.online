"use client"

import { useSession, signOut } from "next-auth/react"
import { useArtists } from "@/lib/use-artists"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"

export default function ProfilePage() {
    const { data: session, status } = useSession()
    const { artists } = useArtists()
    const router = useRouter()

    const [profile, setProfile] = useState({
        name: "",
        avatar: "",
        notifications: true,
    })
    const [favorites, setFavorites] = useState<number[]>([])

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login")
        }
    }, [status, router])

    useEffect(() => {
        if (session?.user?.email) {
            fetch("/api/listeners/favorites")
                .then(r => r.json())
                .then(data => {
                    if (data.favoriteArtists) setFavorites(data.favoriteArtists)
                })
                .catch(() => { })
        }
    }, [session])

    if (status === "loading") return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[#99CCCC] font-mono animate-pulse">LOADING...</div>
    if (!session) return null

    const handleLogout = () => {
        signOut({ callbackUrl: "/" })
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pt-24 pb-20 max-w-2xl mx-auto">
            <div className="space-y-8">
                <header className="flex flex-col gap-6 border-b border-[#2a2a2a] pb-6">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" className="text-[#99CCCC] hover:text-white font-mono hover:bg-transparent px-0 text-sm tracking-widest" onClick={() => router.push("/")}>
                            ← BACK TO RADIO
                        </Button>
                        <Button variant="outline" className="border-[#2a2a2a] hover:bg-[#1a1a1a] text-[10px] uppercase tracking-widest">Edit Profile</Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <Avatar className="w-20 h-20 border-2 border-[#99CCCC]">
                            <AvatarImage src={profile.avatar} />
                            <AvatarFallback className="bg-[#1a1a1a] text-[#99CCCC] text-2xl font-bold">
                                {session.user?.name?.charAt(0) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{session.user?.name || "Listener"}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[#737373] text-[10px] uppercase font-mono tracking-widest">{session.user?.role}</p>
                                {(session.user as any).isPremium && (
                                    <span className="bg-[#99CCCC] text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm">PREMIUM</span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* NOTIFICATIONS */}
                <section className="bg-[#111] border border-[#2a2a2a] p-6 rounded-sm">
                    <h2 className="text-[#99CCCC] font-mono text-xs uppercase tracking-[0.2em] mb-4">Settings</h2>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold uppercase tracking-wide">Email Notifications</Label>
                            <p className="text-[10px] text-[#737373] uppercase tracking-wider">Get notified when your favorite artists are live.</p>
                        </div>
                        <Switch
                            checked={profile.notifications}
                            onCheckedChange={v => setProfile({ ...profile, notifications: v })}
                            className="data-[state=checked]:bg-[#99CCCC]"
                        />
                    </div>
                </section>

                {/* FAVORITE ARTISTS */}
                <section>
                    <h2 className="text-[#99CCCC] font-mono text-xs uppercase tracking-[0.2em] mb-4">My Favorites</h2>
                    {favorites.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-[#2a2a2a] rounded-sm">
                            <p className="text-[#737373] text-[10px] uppercase tracking-widest">You haven't added any favorites yet.</p>
                            <Button variant="link" className="text-[#99CCCC] mt-2 text-[10px] uppercase tracking-widest" onClick={() => router.push("/")}>Explore Artists</Button>
                        </div>
                    ) : (
                        <ScrollArea className="h-96">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {artists.filter(a => favorites.includes(a.id)).map(artist => (
                                    <div key={artist.id} className="relative aspect-square rounded-sm overflow-hidden group border border-[#1a1a1a]">
                                        <Image src={artist.image} alt={artist.name} fill className="object-cover transition-transform group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col justify-end">
                                            <span className="font-bold text-xs uppercase tracking-wide">{artist.name}</span>
                                            <span className="text-[9px] text-white/50 uppercase tracking-widest truncate">{artist.show}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </section>

                <Button
                    variant="destructive"
                    className="w-full bg-red-900/10 hover:bg-red-900/20 text-red-500 border border-red-500/20 text-[10px] font-bold uppercase tracking-[0.3em] h-12"
                    onClick={handleLogout}
                >
                    TERMINATE SESSION
                </Button>
            </div>
        </div>
    )
}
