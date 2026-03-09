import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SPREADSHEET_ID = '1gH2majqCcRkQGUPvWE8bqpo6MhdZf8z31Q6mf2t0pBM';
const RANGE = 'A:L'; // Expanded to cover all columns

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await req.json();

        // Validation (simplified, Zod is recommended for frontend)
        const requiredFields = ['artistName', 'mixName', 'location', 'artistPhoto', 'audioUrl', 'description', 'contact'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return NextResponse.json({ error: `Field ${field} is required` }, { status: 400 });
            }
        }

        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        // Google Auth
        const authClient = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await authClient.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client as any });

        // Append to Spreadsheet
        // Order: Timestamp, Artist Name, Mix Name, Location, Contact, Instagram, SoundCloud, Bandcamp, Photo URL, Audio URL, Bio, Genres/BPM
        const values = [
            [
                new Date().toISOString(),
                data.artistName,
                data.mixName,
                data.location,
                data.contact,
                data.instagram || '',
                data.soundcloud || '',
                data.bandcamp || '',
                data.artistPhoto,
                data.audioUrl,
                data.description,
                data.genresBpm || ''
            ],
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Mix submission error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
