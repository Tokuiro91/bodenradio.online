import { NextResponse } from "next/server";

export async function GET() {
    try {
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://163.245.219.4:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const res = await fetch(`${baseUrl}/station/${stationId}/playlists`, {
            headers: { "X-API-Key": apiKey }
        });

        if (!res.ok) throw new Error("Failed to fetch schedule/playlists");
        const data = await res.json();

        // Transform AzuraCast playlists into a more manageable schedule format if needed
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://163.245.219.4:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const body = await request.json();

        //body should contain playlist details and schedule
        const res = await fetch(`${baseUrl}/station/${stationId}/playlists`, {
            method: "POST",
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to create schedule/playlist");
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
