"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { SolariText } from "@/components/solari-text"
import Link from "next/link"

// Steps:
//  1 — enter email or username
//  2 — (new users only) pick a display name → OTP gets sent
//  3 — enter 6-digit OTP code
type Step = 1 | 2 | 3

export default function LoginPage() {
    const router = useRouter()

    const [step, setStep] = useState<Step>(1)
    const [identifier, setIdentifier] = useState("")   // email or username input
    const [resolvedEmail, setResolvedEmail] = useState("") // actual email for signIn
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [isNewUser, setIsNewUser] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // ── Step 1: resolve identifier ────────────────────────────────────────────
    async function handleIdentifier(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        const trimmed = identifier.trim()
        if (!trimmed) { setError("Введите email или логин"); return }
        if (trimmed.includes("@") && !trimmed.includes(".")) {
            setError("Введите корректный email"); return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: trimmed, type: "listener" }),
            })
            const data = await res.json()

            if (!res.ok) { setError(data.error ?? "Ошибка"); return }

            if (data.needsName) {
                // New user — collect username first, OTP sent later
                setIsNewUser(true)
                setResolvedEmail(trimmed.toLowerCase())
                setStep(2)
            } else {
                // Returning user or username resolved — OTP already sent
                setIsNewUser(!!data.isNewUser)
                setResolvedEmail(data.email)
                setStep(3)
            }
        } catch {
            setError("Нет соединения с сервером")
        } finally {
            setLoading(false)
        }
    }

    // ── Step 2: submit username, trigger OTP send ─────────────────────────────
    async function handleNameSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (!name.trim()) { setError("Введите логин"); return }
        if (name.trim().length < 2) { setError("Логин должен быть не менее 2 символов"); return }

        setLoading(true)
        try {
            const res = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: resolvedEmail, name: name.trim(), type: "listener" }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error ?? "Ошибка отправки письма"); return }
            setStep(3)
        } catch {
            setError("Нет соединения с сервером")
        } finally {
            setLoading(false)
        }
    }

    // ── Step 3: verify OTP ────────────────────────────────────────────────────
    async function handleVerifyCode(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (code.trim().length !== 6) { setError("Код должен состоять из 6 цифр"); return }

        setLoading(true)
        try {
            const res = await signIn("listener-otp", {
                email: resolvedEmail,
                otp: code.trim(),
                redirect: false,
            })
            if (res?.error || !res?.ok) {
                setError("Неверный или устаревший код. Запросите новый.")
                return
            }
            // Save chosen name for new users
            if (isNewUser && name.trim()) {
                await fetch("/api/listeners/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name.trim() }),
                })
            }
            router.push("/profile")
            router.refresh()
        } catch {
            setError("Ошибка авторизации")
        } finally {
            setLoading(false)
        }
    }

    // How many dots to show in step indicator
    const totalDots = isNewUser ? 3 : 2
    const activeDot = step === 1 ? 1 : step === 2 ? 2 : (isNewUser ? 3 : 2)

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="text-[#737373] hover:text-white transition-colors" aria-label="Back">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-2xl font-bold text-[#99CCCC] font-mono tracking-tighter">
                        <SolariText text={isNewUser && step > 1 ? "JOIN" : "LOGIN"} />
                    </h1>
                </div>

                <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-8">

                    {/* Step dots */}
                    <div className="flex items-center gap-2 mb-6">
                        {Array.from({ length: totalDots }).map((_, i) => (
                            <div key={i} className="contents">
                                <div className={`w-2 h-2 rounded-full flex-none transition-colors ${activeDot > i ? "bg-[#99CCCC]" : "bg-[#2a2a2a]"}`} />
                                {i < totalDots - 1 && (
                                    <div className={`flex-1 h-px transition-colors ${activeDot > i + 1 ? "bg-[#99CCCC]" : "bg-[#2a2a2a]"}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ── STEP 1: Email or username ── */}
                    {step === 1 && (
                        <form onSubmit={handleIdentifier} className="space-y-4">
                            <div>
                                <label className="block text-xs text-[#9ca3af] mb-1.5 uppercase tracking-widest">
                                    Email или логин
                                </label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => { setIdentifier(e.target.value); setError("") }}
                                    placeholder="user@email.com или username"
                                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#99CCCC] transition-colors placeholder:text-[#404040] font-mono"
                                    autoComplete="email"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>
                            {error && <p className="text-xs text-[#f97373]">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading || !identifier.trim()}
                                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#99CCCC] text-black hover:bg-white"
                            >
                                {loading ? "Проверка…" : "Продолжить"}
                            </button>
                        </form>
                    )}

                    {/* ── STEP 2: Choose username (new users only) ── */}
                    {step === 2 && (
                        <form onSubmit={handleNameSubmit} className="space-y-4">
                            <div>
                                <p className="text-xs text-[#9ca3af] mb-3">
                                    Новый аккаунт для{" "}
                                    <span className="text-white font-mono">{resolvedEmail}</span>
                                </p>
                                <label className="block text-xs text-[#9ca3af] mb-1.5 uppercase tracking-widest">
                                    Ваш логин
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setError("") }}
                                    placeholder="username"
                                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#99CCCC] transition-colors placeholder:text-[#404040] font-mono"
                                    autoComplete="username"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>
                            {error && <p className="text-xs text-[#f97373]">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#99CCCC] text-black hover:bg-white"
                            >
                                {loading ? "Отправка кода…" : "Далее"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(""); setIsNewUser(false) }}
                                className="w-full py-2 text-xs text-[#6b7280] hover:text-[#9ca3af] transition-colors"
                            >
                                ← Назад
                            </button>
                        </form>
                    )}

                    {/* ── STEP 3: OTP code ── */}
                    {step === 3 && (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div>
                                <p className="text-xs text-[#9ca3af] mb-3">
                                    Код отправлен на{" "}
                                    <span className="text-white font-mono">{resolvedEmail}</span>
                                </p>
                                <label className="block text-xs text-[#9ca3af] mb-1.5 uppercase tracking-widest">
                                    6-значный код
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError("") }}
                                    placeholder="000000"
                                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2.5 text-2xl text-white outline-none focus:border-[#99CCCC] transition-colors placeholder:text-[#404040] font-mono tracking-[0.5em] text-center"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>
                            {error && <p className="text-xs text-[#f97373]">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#99CCCC] text-black hover:bg-white"
                            >
                                {loading ? "Проверка…" : isNewUser ? "Создать аккаунт" : "Войти"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setStep(isNewUser ? 2 : 1); setCode(""); setError("") }}
                                className="w-full py-2 text-xs text-[#6b7280] hover:text-[#9ca3af] transition-colors"
                            >
                                ← Назад
                            </button>
                        </form>
                    )}
                </div>

                <p className="mt-4 text-center text-[10px] text-[#383838]">
                    <Link href="/admin/login" className="hover:text-[#737373] transition-colors uppercase tracking-widest">Admin entry</Link>
                </p>
            </div>
        </div>
    )
}
