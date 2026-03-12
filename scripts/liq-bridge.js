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
                    return { date: parts[0], time: parts[1], end_time: '', end_date: '', file: parts[2] };
                } else if (parts.length === 4) {
                    // Format: date,time,end_time,file
                    return { date: parts[0], time: parts[1], end_time: parts[2], end_date: '', file: parts[3] };
                } else {
                    // New format: date,time,end_time,end_date,file
                    return { date: parts[0], time: parts[1], end_time: parts[2], end_date: parts[3], file: parts[4] };
                }
            });

            const currentEntry = entries.find(entry => {
                const endDate = entry.end_date || entry.date;
                // Check date range (supports multi-day entries)
                if (currentDate < entry.date || currentDate > endDate) return false;
                // On start day: must be at or after start time
                if (currentDate === entry.date && currentTime < entry.time) return false;
                // On end day: must be before end time
                if (currentDate === endDate && entry.end_time && currentTime >= entry.end_time) return false;
                return true;
            });

            if (currentEntry && currentEntry.file && currentEntry.file !== 'SILENCE') {
                const slotId = `${currentEntry.date}_${currentEntry.time}_${currentEntry.file}`;

                // Compute slot duration so we block re-queuing for the whole slot
                const startMs = new Date(`${currentEntry.date}T${currentEntry.time}Z`).getTime();
                const endDateStr = currentEntry.end_date || currentEntry.date;
                const endTimeStr = currentEntry.end_time || '23:59:59';
                const endMs = new Date(`${endDateStr}T${endTimeStr}Z`).getTime();
                const slotDurationMs = Math.max(endMs - startMs, 60 * 1000); // at least 1 min

                // State file format: "slotId|epochMs"
                let lastSlotId = '';
                let lastTimestamp = 0;
                if (fs.existsSync(STATE_FILE)) {
                    const state = fs.readFileSync(STATE_FILE, 'utf8').trim();
                    const pipe = state.lastIndexOf('|');
                    if (pipe !== -1) {
                        lastSlotId = state.slice(0, pipe);
                        lastTimestamp = parseInt(state.slice(pipe + 1), 10) || 0;
                    } else {
                        lastSlotId = state; // legacy format — treat as already played
                    }
                }

                const nowMs = now.getTime();
                if (lastSlotId === slotId && (nowMs - lastTimestamp) < slotDurationMs) {
                    // Already handed this slot to Liquidsoap; still within slot duration
                    return "SILENCE";
                }

                // Mark slot as started
                fs.writeFileSync(STATE_FILE, `${slotId}|${nowMs}`);

                let filePath = currentEntry.file;
                if (!filePath.startsWith('/') && !filePath.startsWith('http')) {
                    filePath = path.join(__dirname, '..', 'data', 'radio', 'mixes', filePath);
                }

                // Tell Liquidsoap to stop the file at slot end (cue_out = slot duration in seconds)
                // This ensures a 60-min file stops at 13:05 if slot ends at 13:05
                if (currentEntry.end_time) {
                    const actualDurationSec = (endMs - startMs) / 1000;
                    if (actualDurationSec > 0) {
                        return `annotate:liq_cue_out=${actualDurationSec.toFixed(3)}:${filePath}`;
                    }
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
