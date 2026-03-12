import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { generateOtp } from "@/lib/otp-store"
import { getAdminEmails } from "@/lib/auth"
import { findListenerByEmail, findListenerByName } from "@/lib/listeners-store"

function makeTransporter() {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    })
}

async function sendOtpEmail(to: string, code: string, isAdmin: boolean) {
    await makeTransporter().sendMail({
        from: `"${isAdmin ? "BØDEN Admin" : "BØDEN Radio"}" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Код входа: ${code}`,
        text: `Ваш код для входа в BØDEN: ${code}\n\nКод действителен 10 минут.\n\nЕсли вы не запрашивали код — проигнорируйте это письмо.`,
        html: `
<div style="font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:40px;max-width:400px;margin:0 auto;border-radius:8px;">
  <p style="color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">${isAdmin ? "BØDEN / ADMIN" : "BØDEN RADIO"}</p>
  <h1 style="font-size:48px;letter-spacing:0.1em;color:${isAdmin ? "#ffffff" : "#99CCCC"};margin:0 0 8px 0;">${code}</h1>
  <p style="color:#9ca3af;font-size:13px;margin:0 0 24px 0;">Код действителен <strong>10 минут</strong></p>
  <p style="color:#4b5563;font-size:11px;">Если вы не запрашивали код — проигнорируйте это письмо.</p>
</div>`,
    })
}

export async function POST(request: Request) {
    try {
        const { identifier, name, type = "admin" } = await request.json() as {
            identifier?: string
            name?: string
            type?: string
        }

        if (!identifier || !identifier.trim()) {
            return NextResponse.json({ error: "Введите email или логин" }, { status: 400 })
        }

        const trimmed = identifier.trim()

        // ── LISTENER FLOW ──────────────────────────────────────────────────────
        if (type === "listener") {
            const isEmail = trimmed.includes("@")

            let targetEmail: string

            if (isEmail) {
                targetEmail = trimmed.toLowerCase()
                const existing = findListenerByEmail(targetEmail)

                if (!existing) {
                    // New user — need username before we can send OTP
                    if (!name?.trim()) {
                        return NextResponse.json({ ok: true, needsName: true, isNewUser: true })
                    }
                    // Username provided — send OTP now
                    const code = generateOtp(targetEmail)
                    await sendOtpEmail(targetEmail, code, false)
                    return NextResponse.json({ ok: true, isNewUser: true, email: targetEmail })
                }

                // Existing user by email
                const code = generateOtp(targetEmail)
                await sendOtpEmail(targetEmail, code, false)
                return NextResponse.json({ ok: true, isNewUser: false, email: targetEmail })

            } else {
                // Username lookup
                const listener = findListenerByName(trimmed)
                if (!listener) {
                    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
                }
                targetEmail = listener.email
                const code = generateOtp(targetEmail)
                await sendOtpEmail(targetEmail, code, false)
                return NextResponse.json({ ok: true, isNewUser: false, email: targetEmail })
            }
        }

        // ── ADMIN FLOW ─────────────────────────────────────────────────────────
        if (!trimmed.includes("@")) {
            return NextResponse.json({ error: "Введите корректный email" }, { status: 400 })
        }
        const normalizedEmail = trimmed.toLowerCase()
        const admins = getAdminEmails().map((e) => e.toLowerCase().trim())
        if (!admins.includes(normalizedEmail)) {
            return NextResponse.json({ ok: true }) // silent success
        }
        const code = generateOtp(normalizedEmail)
        await sendOtpEmail(normalizedEmail, code, true)
        return NextResponse.json({ ok: true })

    } catch (err) {
        console.error("send-otp error:", err)
        return NextResponse.json({ error: "Ошибка отправки письма" }, { status: 500 })
    }
}
