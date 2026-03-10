import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');

// Simple .env parser that handles multiline quoted values
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};

    // Improved regex to handle keys and start of values
    const lines = content.split('\n');
    let currentKey = null;
    let currentValue = null;
    let inQuotes = false;

    for (const line of lines) {
        if (!currentKey) {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/);
            if (match) {
                currentKey = match[1];
                let val = match[2] || '';

                if (val.startsWith('"')) {
                    inQuotes = true;
                    val = val.slice(1);
                    if (val.endsWith('"')) {
                        inQuotes = false;
                        val = val.slice(0, -1);
                    }
                    currentValue = val;
                } else {
                    currentValue = val.trim();
                    env[currentKey] = currentValue;
                    currentKey = null;
                }
            }
        } else {
            if (inQuotes) {
                if (line.endsWith('"')) {
                    inQuotes = false;
                    currentValue += '\n' + line.slice(0, -1);
                    env[currentKey] = currentValue;
                    currentKey = null;
                } else {
                    currentValue += '\n' + line;
                }
            }
        }
    }
    return env;
}


const env = loadEnv(envPath);
console.log('Loaded keys:', Object.keys(env));

async function createSheet() {
    let privateKey = env.GOOGLE_PRIVATE_KEY;
    const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    console.log('Email exists:', !!clientEmail);
    console.log('Key exists:', !!privateKey);

    if (privateKey) {
        // Remove literal \n and actual newlines if they are mixed
        privateKey = privateKey.replace(/\\n/g, '\n');
    }


    // Handle multiline keys from env parser
    if (privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        // Find if it was truncated or has quotes
    }

    const auth = new google.auth.JWT(
        clientEmail,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        console.log('Connecting to Google Sheets API...');
        const spreadsheet = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title: `Mix Submissions - ${new Date().toISOString().split('T')[0]}`,
                },
            },
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        console.log('Spreadsheet created! ID:', spreadsheetId);
        console.log('URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId);

        // Add headers
        const headers = [
            'Timestamp', 'Artist Name', 'Mix Name', 'Location', 'Contact', 'Instagram', 'SoundCloud', 'Bandcamp', 'Photo URL', 'Audio URL', 'Bio', 'Genres/BPM'
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [headers],
            },
        });

        console.log('Headers added successfully!');
        console.log('\nACTION REQUIRED: Add GOOGLE_MIX_SUBMISSION_SPREADSHEET_ID=' + spreadsheetId + ' to your .env.local');

    } catch (err) {
        console.error('Error:', err.message || err);
    }
}

createSheet();
