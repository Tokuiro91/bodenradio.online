"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SolariText } from "@/components/solari-text"
import { toast } from "sonner"
import Link from "next/link"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await signIn("listener-login", {
            email,
            password,
            redirect: false,
        })

        if (res?.error) {
            toast.error("Invalid email or password")
        } else {
            toast.success("Welcome back!")
            router.push("/profile")
        }
        setLoading(false)
    }

    const handleGoogleLogin = () => {
        signIn("google", { callbackUrl: "/profile" })
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 pt-20">
            <div className="w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-sm p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="text-[#737373] hover:text-white transition-colors" aria-label="Back to radio">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-bold text-[#99CCCC] font-mono tracking-tighter">
                        <SolariText text="LOGIN" />
                    </h1>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <Label className="text-[#737373] uppercase text-[10px] tracking-widest">Email</Label>
                        <Input
                            type="email"
                            className="bg-[#1a1a1a] border-[#2a2a2a] mt-1"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <Label className="text-[#737373] uppercase text-[10px] tracking-widest">Password</Label>
                        <Input
                            type="password"
                            className="bg-[#1a1a1a] border-[#2a2a2a] mt-1"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-[#99CCCC] hover:bg-[#88bbbb] text-black font-bold mt-2"
                        disabled={loading}
                    >
                        {loading ? "LOGGING IN..." : "ENTER"}
                    </Button>
                </form>

                <p className="mt-8 text-center text-xs text-[#737373]">
                    Don't have an account? <Link href="/register" className="text-[#99CCCC] hover:underline font-tektur">Join BØDEN</Link>
                </p>

                <p className="mt-4 text-center text-[10px] text-[#2a2a2a] uppercase tracking-widest">
                    <Link href="/admin/login" className="hover:text-[#737373] transition-colors">Admin entry</Link>
                </p>
            </div>
        </div>
    )
}
