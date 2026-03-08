import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SPREADSHEET_ID = '1gH2majqCcRkQGUPvWE8bqpo6MhdZf8z31Q6mf2t0pBM';
const RANGE = 'A:J'; // Adjusted to match the number of questions

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await req.json();

        // Validation (simplified, Zod is recommended for frontend)
        const requiredFields = ['artistName', 'mixName', 'location', 'artistPhoto', 'audioUrl', 'description'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return NextResponse.json({ error: `Field ${field} is required` }, { status: 400 });
            }
        }

        // Google Auth
        const authClient = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth: await authClient.getClient() });

        // Append to Spreadsheet
        // Order: Timestamp, Artist Name, Mix Name, Location, Instagram, SoundCloud, Bandcamp, Photo URL, Audio URL, Bio, Genres/BPM
        const values = [
            [
                new Date().toISOString(),
                data.artistName,
                data.mixName,
                data.location,
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
