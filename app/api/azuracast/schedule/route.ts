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

export async function PUT(request: Request) {
    try {
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://163.245.219.4:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const { id, start_time, end_time, start_date } = await request.json();
        // ID is in format "playlistId-itemId"
        const [playlistId, itemId] = id.split("-");

        if (!playlistId || !itemId) {
            return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
        }

        // 1. Fetch current playlist to get all schedule items
        const playlistRes = await fetch(`${baseUrl}/station/${stationId}/playlist/${playlistId}`, {
            headers: { "X-API-Key": apiKey }
        });

        if (!playlistRes.ok) throw new Error("Failed to fetch playlist");
        const playlist = await playlistRes.json();

        // 2. Update the specific schedule item
        const updatedScheduleItems = playlist.schedule_items.map((item: any) => {
            if (String(item.id) === String(itemId)) {
                return {
                    ...item,
                    start_time: Number(start_time),
                    end_time: Number(end_time),
                    start_date,
                    end_date: start_date
                };
            }
            return item;
        });

        // 3. Save the playlist with updated schedule and strictly enforced priorities
        const updateRes = await fetch(`${baseUrl}/station/${stationId}/playlist/${playlistId}`, {
            method: "PUT",
            headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
                ...playlist,
                type: "scheduled",
                include_in_on_demand: true,
                backend_options: ["interrupt", "single_track"],
                schedule_items: updatedScheduleItems
            })
        });

        if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.message || "Failed to update schedule");
        }

        return NextResponse.json({ success: true });
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

        // Custom action for scheduling a specific file
        if (body.action === "schedule_file") {
            const { file_id, name, start_time, end_time, start_date } = body;

            // 1. Create Playlist
            const playlistRes = await fetch(`${baseUrl}/station/${stationId}/playlists`, {
                method: "POST",
                headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `Broadcast: ${name}`,
                    type: "scheduled",
                    source: "songs",
                    order: "shuffle",
                    is_enabled: true,
                    include_in_on_demand: true,
                    backend_options: ["interrupt", "single_track"],
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

            // 2. Fetch current file details to preserve existing playlists
            const fileRes = await fetch(`${baseUrl}/station/${stationId}/file/${file_id}`, {
                headers: { "X-API-Key": apiKey }
            });
            const fileData = await fileRes.json();
            const currentPlaylists = fileData.playlists?.map((p: any) => p.id) || [];

            // 3. Update file with new playlist assignment
            const updateFileRes = await fetch(`${baseUrl}/station/${stationId}/file/${file_id}`, {
                method: "PUT",
                headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                    playlists: [...currentPlaylists, playlist.id]
                })
            });

            if (!updateFileRes.ok) {
                const err = await updateFileRes.json().catch(() => ({ message: "Failed to update file playlists" }));
                throw new Error(err.message || "Failed to assign file to playlist");
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
