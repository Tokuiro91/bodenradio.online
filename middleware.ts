import { auth } from "@/lib/auth-edge"
import { NextResponse } from "next/server"

export default auth((req) => {
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")
    const isLoginPage = req.nextUrl.pathname === "/admin/login"
    const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")

    if (isAdminRoute) {
        const host = req.headers.get("host") || ""
        // Restrict to VPS IP or authorized domains
        if (!host.includes("163.245.219.4") &&
            !host.includes("bodenradio.online") &&
            !host.includes("agileradio.online") &&
            !host.includes("localhost") &&
            !host.includes("127.0.0.1")) {
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
