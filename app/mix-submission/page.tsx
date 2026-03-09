"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Send, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function MixSubmissionPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const [form, setForm] = useState({
        artistName: "",
        mixName: "",
        location: "",
        instagram: "",
        soundcloud: "",
        bandcamp: "",
        artistPhoto: "",
        audioUrl: "",
        description: "",
        genresBpm: "",
        contact: ""
    })

    // Protect page
    if (status === "unauthenticated") {
        router.push("/login")
        return null
    }

    useEffect(() => {
        if (submitted) {
            const timer = setTimeout(() => {
                router.push("/")
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [submitted, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch("/api/mix-submission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            })

            const data = await res.json()
            if (res.ok) {
                setSubmitted(true)
                toast.success("Mix submitted successfully!")
            } else {
                const errorMsg = data.error || `Error ${res.status}: Submission failed`
                toast.error(errorMsg)
                console.error("Submission error:", data)
            }
        } catch (err) {
            toast.error("Network error")
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
                <CheckCircle2 className="w-16 h-16 text-[#99CCCC] mb-6 animate-in zoom-in duration-500" />
                <h1 className="text-3xl font-tektur font-bold mb-4 tracking-wider uppercase">Submission Received!</h1>
                <p className="text-[#737373] font-mono text-sm max-w-md mb-8 leading-relaxed">
                    Thank you, {form.artistName}! Your mix has been recorded. Our team will review it and get back to you soon.
                </p>
                <Link
                    href="/"
                    className="px-8 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-[#99CCCC] font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#99CCCC] hover:text-black transition-all"
                >
                    Back to Radio
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans pb-24">
            {/* Header */}
            <header className="max-w-2xl mx-auto mb-10 flex items-center justify-between pt-8">
                <Link href="/" className="p-2 -ml-2 text-[#737373] hover:text-[#99CCCC] transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="font-tektur font-bold text-xl tracking-widest text-[#99CCCC] uppercase">
                    Mix Submission
                </h1>
                <div className="w-6" /> {/* Spacer */}
            </header>

            <main className="max-w-2xl mx-auto">
                <div className="mb-10 text-center">
                    <p className="text-[10px] text-[#737373] uppercase font-mono tracking-[0.2em] mb-2">BØDEN Radio 2026</p>
                    <h2 className="text-2xl font-tektur font-bold text-white uppercase tracking-tight">Showcase Your Sound</h2>
                    <div className="h-[1px] w-20 bg-[#99CCCC]/30 mx-auto mt-4" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Essential Info */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] uppercase font-mono text-[#99CCCC] tracking-widest border-l-2 border-[#99CCCC] pl-3">Essential Details</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Artist Name / Nickname *</label>
                                <input
                                    required
                                    value={form.artistName}
                                    onChange={e => setForm({ ...form, artistName: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Your alias"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Mix Name *</label>
                                <input
                                    required
                                    value={form.mixName}
                                    onChange={e => setForm({ ...form, mixName: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Episode / Mix Title"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-mono text-[#737373]">Location *</label>
                            <input
                                required
                                value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                placeholder="City, Country"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-mono text-[#737373]">Contact Details * (Telegram / WhatsApp / Email)</label>
                            <input
                                required
                                value={form.contact}
                                onChange={e => setForm({ ...form, contact: e.target.value })}
                                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                placeholder="How can we reach you?"
                            />
                        </div>
                    </section>

                    {/* Social Presence */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] uppercase font-mono text-[#99CCCC] tracking-widest border-l-2 border-[#99CCCC] pl-3">Social Links</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Instagram</label>
                                <input
                                    value={form.instagram}
                                    onChange={e => setForm({ ...form, instagram: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="@handle"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">SoundCloud</label>
                                <input
                                    value={form.soundcloud}
                                    onChange={e => setForm({ ...form, soundcloud: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Link"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Bandcamp</label>
                                <input
                                    value={form.bandcamp}
                                    onChange={e => setForm({ ...form, bandcamp: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Link"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Media Links */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] uppercase font-mono text-[#99CCCC] tracking-widest border-l-2 border-[#99CCCC] pl-3">Media (Google Drive Links)</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Artist Photo URL * (.jpg)</label>
                                <input
                                    required
                                    value={form.artistPhoto}
                                    onChange={e => setForm({ ...form, artistPhoto: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Link to photo"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Audio File URL * (60-90 min, Max 100MB)</label>
                                <input
                                    required
                                    value={form.audioUrl}
                                    onChange={e => setForm({ ...form, audioUrl: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="Link to audio"
                                />
                                <p className="text-[9px] text-orange-500/50 uppercase font-mono">Ensure link sharing is set to "Anyone with the link"</p>
                            </div>
                        </div>
                    </section>

                    {/* Bio & Details */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] uppercase font-mono text-[#99CCCC] tracking-widest border-l-2 border-[#99CCCC] pl-3">Artist Bio & Genres</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Description / Bio *</label>
                                <textarea
                                    required
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full min-h-[120px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors resize-none"
                                    placeholder="Tell us about yourself and the mix..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono text-[#737373]">Genres / BPM Range</label>
                                <input
                                    value={form.genresBpm}
                                    onChange={e => setForm({ ...form, genresBpm: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-sm px-4 py-3 text-sm focus:border-[#99CCCC] outline-none transition-colors"
                                    placeholder="e.g. Techno, House (124-128 BPM)"
                                />
                            </div>
                        </div>
                    </section>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-[#99CCCC] text-black font-mono font-black uppercase tracking-[0.2em] text-sm hover:bg-white transition-all disabled:bg-[#2a2a2a] disabled:text-[#737373] flex items-center justify-center gap-2 mt-12 rounded-sm"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Submit to BØDEN
                            </>
                        )}
                    </button>
                </form>
            </main>
        </div >
    )
}
