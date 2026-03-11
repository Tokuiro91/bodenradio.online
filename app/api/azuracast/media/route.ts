import { NextResponse } from "next/server";

export async function GET() {
    try {
        const baseUrl = process.env.AZURACAST_BASE_URL || "http://163.245.219.4:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const res = await fetch(`${baseUrl}/station/${stationId}/files`, {
            headers: { "X-API-Key": apiKey }
        });

        if (!res.ok) throw new Error("Failed to fetch media list");
        const data = await res.json();
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

        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const azuraFormData = new FormData();
        azuraFormData.append("file", file);

        const res = await fetch(`${baseUrl}/station/${stationId}/files`, {
            method: "POST",
            headers: { "X-API-Key": apiKey },
            body: azuraFormData
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to upload file");
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
        const fileId = searchParams.get("id");

        if (!fileId) {
            return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
        }

        const baseUrl = process.env.AZURACAST_BASE_URL || "http://127.0.0.1:1010/api";
        const stationId = process.env.AZURACAST_STATION_ID || "1";
        const apiKey = process.env.AZURACAST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing AZURACAST_API_KEY" }, { status: 401 });
        }

        const res = await fetch(`${baseUrl}/station/${stationId}/file/${fileId}`, {
            method: "DELETE",
            headers: { "X-API-Key": apiKey }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to delete file");
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
