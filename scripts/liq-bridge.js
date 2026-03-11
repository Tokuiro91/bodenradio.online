const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'schedule.csv');
const STATE_FILE = path.join(__dirname, '..', 'data', 'last_played_slot.txt');

function getCurrentTrack() {
    try {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
        const currentDay = String(now.getUTCDate()).padStart(2, '0');
        const currentDate = `${currentYear}-${currentMonth}-${currentDay}`;
        
        const currentH = String(now.getUTCHours()).padStart(2, '0');
        const currentM = String(now.getUTCMinutes()).padStart(2, '0');
        const currentS = String(now.getUTCSeconds()).padStart(2, '0');
        const currentTime = `${currentH}:${currentM}:${currentS}`;
        
        // 1. Check schedule.csv (Override/Special)
        if (fs.existsSync(CSV_PATH)) {
            const data = fs.readFileSync(CSV_PATH, 'utf8');
            const lines = data.split('\n').filter(line => line.trim() !== '');
            const entries = lines.slice(1).map(line => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length === 3) {
                    // Old format: date,time,file
                    return { date: parts[0], time: parts[1], end_time: '', file: parts[2] };
                }
                // New format: date,time,end_time,file
                return { date: parts[0], time: parts[1], end_time: parts[2], file: parts[3] };
            });

            const currentEntry = entries.find(entry => {
                if (entry.date !== currentDate) return false;
                if (!entry.end_time) return entry.time <= currentTime;
                return entry.time <= currentTime && currentTime < entry.end_time;
            });

            if (currentEntry && currentEntry.file && currentEntry.file !== 'SILENCE') {
                // Prevent looping: check if this slot was already played
                const slotId = `${currentEntry.date}_${currentEntry.time}_${currentEntry.file}`;
                let lastPlayed = '';
                if (fs.existsSync(STATE_FILE)) {
                    lastPlayed = fs.readFileSync(STATE_FILE, 'utf8').trim();
                }

                if (lastPlayed === slotId) {
                    return "SILENCE";
                }

                // Mark as played
                fs.writeFileSync(STATE_FILE, slotId);

                let filePath = currentEntry.file;
                if (!filePath.startsWith('/') && !filePath.startsWith('http')) {
                    filePath = path.join(__dirname, '..', 'data', 'radio', 'mixes', filePath);
                }
                return filePath;
            }
        }

        // 2. Fallback to artists.json
        const ARTISTS_PATH = path.join(__dirname, '..', 'data', 'artists.json');
        if (fs.existsSync(ARTISTS_PATH)) {
            const nowMs = now.getTime();
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
