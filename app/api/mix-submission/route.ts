import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SPREADSHEET_ID = process.env.GOOGLE_MIX_SUBMISSION_SPREADSHEET_ID || '1gH2majqCcRkQGUPvWE8bqpo6MhdZf8z31Q6mf2t0pBM';
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

        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) {
            console.error('GOOGLE_PRIVATE_KEY is missing from environment');
            return NextResponse.json({ error: 'Server configuration error (key)' }, { status: 500 });
        }

        // Handle both actual newlines and literal \n sequences
        privateKey = privateKey.replace(/\\n/g, '\n');

        // Ensure it starts/ends correctly and has actual newlines
        if (!privateKey.includes('\n')) {
            console.warn('Private key does not contain newlines, this might cause OSSL errors');
        }

        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        if (!clientEmail) {
            console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL is missing from environment');
            return NextResponse.json({ error: 'Server configuration error (email)' }, { status: 500 });
        }

        // Use JWT for better control and debugging
        const jwtClient = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth: jwtClient });

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
