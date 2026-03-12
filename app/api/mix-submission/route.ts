import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await req.json();

        const requiredFields = ['artistName', 'mixName', 'location', 'artistPhoto', 'audioUrl', 'description', 'contact'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return NextResponse.json({ error: `Field ${field} is required` }, { status: 400 });
            }
        }

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        if (!scriptUrl) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const payload = {
            timestamp: new Date().toISOString(),
            artistName: data.artistName,
            mixName: data.mixName,
            location: data.location,
            contact: data.contact,
            instagram: data.instagram || '',
            soundcloud: data.soundcloud || '',
            bandcamp: data.bandcamp || '',
            artistPhoto: data.artistPhoto,
            audioUrl: data.audioUrl,
            description: data.description,
            genresBpm: data.genresBpm || '',
        };

        const res = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Apps Script error:', text);
            return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Mix submission error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
