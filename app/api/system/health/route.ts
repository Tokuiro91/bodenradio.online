import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const backendUrl = `${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/system/health`;

        const res = await fetch(backendUrl, {
            cache: 'no-store'
        });

        if (!res.ok) throw new Error("Backend unreachable");

        const data = await res.json();
        return NextResponse.json(data);

    } catch (err: any) {
        return NextResponse.json({
            storage: 'Error',
            memory: 'Error',
            cpu: 'Offline',
            latency: '---'
        }, { status: 200 }); // Return placeholder on fail to prevent UI crash
    }
}
