import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { artists } = await request.body ? await request.json() : { artists: [] };

        // 1. Get Token for Radio Backend
        const authRes = await fetch(`${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin" })
        });
        const { token } = await authRes.json();
        if (!token) throw new Error("Radio backend auth failed");

        // 2. Get all tracks to map filenames to IDs
        const tracksRes = await fetch(`${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/tracks`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const tracks = await tracksRes.json();

        // 3. Prepare events
        const events = artists
            .filter((a: any) => a.type === 'artist' && a.audioUrl)
            .map((a: any) => {
                const filename = a.audioUrl.split('/').pop();
                const track = tracks.find((t: any) => t.filename === filename);

                if (!track) return null;

                return {
                    title: `[SYNC] ${a.name}`,
                    type: 'track',
                    item_id: track.id,
                    start_time: new Date(a.startTime).getTime(),
                    end_time: new Date(a.endTime).getTime()
                };
            })
            .filter((e: any) => e !== null);

        // 4. Send to Radio Sync Endpoint
        const syncRes = await fetch(`${process.env.RADIO_BACKEND_URL || 'http://localhost:8080'}/api/schedule/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ events })
        });

        const syncData = await syncRes.json();
        return NextResponse.json(syncData);

    } catch (err: any) {
        console.error("Sync Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
