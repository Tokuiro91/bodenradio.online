import { auth } from "@/lib/auth-edge"
import { NextResponse } from "next/server"

export default auth((req) => {
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")
    const isLoginPage = req.nextUrl.pathname === "/admin/login"
    const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")

    if (isAdminRoute) {
        const host = req.headers.get("host") || ""
        // Restrict to VPS IP or authorized domains
        const allowedHosts = (process.env.ALLOWED_HOSTS || "bodenradio.online,agileradio.online,localhost,127.0.0.1").split(",")
        if (!allowedHosts.some(h => host.includes(h.trim()))) {
            return NextResponse.redirect(new URL("/", req.url))
        }
    }

    if (isAuthRoute) return NextResponse.next()
    if (isLoginPage) return NextResponse.next()

    if (isAdminRoute && !req.auth) {
        return NextResponse.redirect(new URL("/admin/login", req.url))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/admin/:path*"],
}
