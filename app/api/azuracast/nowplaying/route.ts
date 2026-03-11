import { NextResponse } from "next/server";

export async function GET() {
    try {
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://163.245.219.4:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";

        const res = await fetch(`${baseUrl}/nowplaying/${stationId}`, {
            next: { revalidate: 15 } // Cache for 15 seconds
        });

        if (!res.ok) throw new Error("Failed to fetch nowplaying data");

        const data = await res.json();

        return NextResponse.json({
            listeners: {
                total: data.listeners.total,
                unique: data.listeners.unique,
                current: data.listeners.current
            },
            now_playing: data.now_playing?.song?.text || "None",
            is_online: data.station.mounts.some((m: any) => m.is_default)
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
