const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'schedule.csv');
const ARTISTS_PATH = path.join(__dirname, '..', 'data', 'artists.json');

function getCurrentTrack() {
    try {
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
        const nowMs = now.getTime();

        // 1. Check schedule.csv (Override/Special)
        if (fs.existsSync(CSV_PATH)) {
            const data = fs.readFileSync(CSV_PATH, 'utf8');
            const lines = data.split('\n').filter(line => line.trim() !== '');
            const entries = lines.slice(1).map(line => {
                const [date, time, file] = line.split(',');
                return { date, time, file };
            });

            // Find the most recent applicable entry
            let currentEntry = null;
            for (const entry of entries) {
                if (entry.date === currentDate && entry.time <= currentTime) {
                    if (!currentEntry || entry.time > currentEntry.time) {
                        currentEntry = entry;
                    }
                }
            }

            if (currentEntry && currentEntry.file && currentEntry.file !== 'SILENCE') {
                let filePath = currentEntry.file;
                if (!filePath.startsWith('/') && !filePath.startsWith('http')) {
                    filePath = path.join(__dirname, '..', 'public', 'radio', 'mixes', filePath);
                }
                return filePath;
            }
        }

        // 2. Check artists.json (Main Schedule)
        if (fs.existsSync(ARTISTS_PATH)) {
            const artists = JSON.parse(fs.readFileSync(ARTISTS_PATH, 'utf8'));
            if (Array.isArray(artists)) {
                const activeArtist = artists.find(a => {
                    const s = new Date(a.startTime).getTime();
                    const e = new Date(a.endTime).getTime();
                    return nowMs >= s && nowMs < e;
                });

                if (activeArtist && activeArtist.audioUrl) {
                    let filePath = activeArtist.audioUrl;
                    if (!filePath.startsWith('/') && !filePath.startsWith('http')) {
                        filePath = path.join(__dirname, '..', 'public', filePath);
                    }
                    return filePath;
                }
            }
        }

        return "SILENCE";
    } catch (err) {
        return "SILENCE";
    }
}

console.log(getCurrentTrack());
