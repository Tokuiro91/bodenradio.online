import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("broadcast_media");

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Forward to Radio Backend
        const backendUrl = `${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/broadcast/upload`;

        // We need a fresh FormData to send to the backend
        const forwardData = new FormData();
        forwardData.append("broadcast_media", file);

        // Get internal token for backend communication
        const authRes = await fetch(`${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: process.env.RADIO_BACKEND_USERNAME || "admin", password: process.env.RADIO_BACKEND_PASSWORD })
        });
        const { token } = await authRes.json();

        if (!token) throw new Error("Radio backend auth failed");

        const res = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: forwardData
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });

    } catch (err: any) {
        console.error("Broadcast upload proxy error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '500mb',
        },
    },
};
