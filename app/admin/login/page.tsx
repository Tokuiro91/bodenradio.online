"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const router = useRouter()

    // Step 1: enter email / Step 2: enter code
    const [step, setStep] = useState<1 | 2>(1)
    const [email, setEmail] = useState("")
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // ── Step 1: Send OTP ─────────────────────────────────────────────────────
    async function handleSendCode(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        const trimmed = email.trim().toLowerCase()
        if (!trimmed.includes("@")) {
            setError("Введите корректный email")
            return
        }
        setLoading(true)
        try {
            const res = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: trimmed }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error ?? "Ошибка отправки письма")
                return
            }
            setStep(2)
        } catch {
            setError("Нет соединения с сервером")
        } finally {
            setLoading(false)
        }
    }

    // ── Step 2: Verify OTP ───────────────────────────────────────────────────
    async function handleVerifyCode(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (code.trim().length !== 6) {
            setError("Код должен состоять из 6 цифр")
            return
        }
        setLoading(true)
        try {
            const res = await signIn("email-otp", {
                email: email.trim().toLowerCase(),
                otp: code.trim(),
                redirect: false,
            })
            if (res?.error || !res?.ok) {
                setError("Неверный или устаревший код. Запросите новый.")
                return
            }
            router.push("/admin")
            router.refresh()
        } catch {
            setError("Ошибка авторизации")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#525252] mb-2 font-tektur">BØDEN</p>
                    <h1 className="text-xl font-semibold text-white tracking-wide">Панель администратора</h1>
                </div>

                <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-8">
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className={`w-2 h-2 rounded-full transition-colors ${step >= 1 ? "bg-[#99CCCC]" : "bg-[#2a2a2a]"}`} />
                        <div className={`flex-1 h-px transition-colors ${step >= 2 ? "bg-[#99CCCC]" : "bg-[#2a2a2a]"}`} />
                        <div className={`w-2 h-2 rounded-full transition-colors ${step >= 2 ? "bg-[#99CCCC]" : "bg-[#2a2a2a]"}`} />
                    </div>

                    {step === 1 ? (
                        /* ── STEP 1: Email ── */
                        <form onSubmit={handleSendCode} className="space-y-4">
                            <div>
                                <label className="block text-xs text-[#9ca3af] mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                                    placeholder="admin@gmail.com"
                                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#99CCCC] transition-colors placeholder:text-[#404040] font-mono"
                                    autoComplete="email"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <p className="text-xs text-[#f97373]">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                className="w-full py-2.5 text-xs uppercase tracking-widest font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#99CCCC] text-black font-bold hover:bg-white"
                            >
                                {loading ? "Отправка…" : "Отправить код"}
                            </button>
                        </form>
                    ) : (
                        /* ── STEP 2: Code ── */
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div>
                                <p className="text-xs text-[#9ca3af] mb-3">
                                    Код отправлен на{" "}
                                    <span className="text-white font-mono">{email}</span>
                                </p>
                                <label className="block text-xs text-[#9ca3af] mb-1.5">6-значный код</label>
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

                            {error && (
                                <p className="text-xs text-[#f97373]">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full py-2.5 text-xs uppercase tracking-widest font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#99CCCC] text-black font-bold hover:bg-white"
                            >
                                {loading ? "Проверка…" : "Войти"}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setStep(1); setCode(""); setError("") }}
                                className="w-full py-2 text-xs text-[#6b7280] hover:text-[#9ca3af] transition-colors"
                            >
                                ← Изменить email
                            </button>
                        </form>
                    )}
                </div>

                <p className="mt-4 text-center text-[10px] text-[#383838]">
                    Доступ только для авторизованных администраторов
                </p>
            </div>
        </div>
    )
}
