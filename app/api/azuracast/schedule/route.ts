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
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://127.0.0.1:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const body = await request.json();

        // Custom action for scheduling a specific file
        if (body.action === "schedule_file") {
            const { file_id, name, start_time, end_time, start_date } = body;

            // 1. Create Playlist
            const playlistRes = await fetch(`${baseUrl}/station/${stationId}/playlists`, {
                method: "POST",
                headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `Broadcast: ${name}`,
                    type: "default",
                    source: "songs",
                    order: "shuffle",
                    is_enabled: true,
                    schedule_items: [{
                        start_time,
                        end_time,
                        start_date,
                        end_date: start_date,
                        days: [1, 2, 3, 4, 5, 6, 7]
                    }]
                })
            });

            if (!playlistRes.ok) {
                const err = await playlistRes.json();
                throw new Error(err.message || "Failed to create playlist");
            }

            const playlist = await playlistRes.json();

            // 2. Add file to playlist
            const addFileRes = await fetch(`${baseUrl}/station/${stationId}/playlist/${playlist.id}/files`, {
                method: "POST",
                headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [file_id] })
            });

            if (!addFileRes.ok) {
                const addFileErr = await addFileRes.json().catch(() => ({ message: "Unknown error" }));
                console.error("[AzuraCast] Add file error:", addFileErr);
                throw new Error(addFileErr.message || "Failed to add file to playlist");
            }

            return NextResponse.json(playlist);
        }

        // Default POST logic
        const res = await fetch(`${baseUrl}/station/${stationId}/playlists`, {
            method: "POST",
            headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
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

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const baseUrl = process.env.AZURACAST_BASE_URL || "http://127.0.0.1:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const res = await fetch(`${baseUrl}/station/${stationId}/playlist/${id}`, {
            method: "DELETE",
            headers: { "X-API-Key": apiKey }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to delete playlist");
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
