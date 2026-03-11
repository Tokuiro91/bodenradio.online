const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'schedule.csv');

function getCurrentTrack() {
    try {
        if (!fs.existsSync(CSV_PATH)) return "SILENCE";

        const data = fs.readFileSync(CSV_PATH, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');

        // Skip header
        const entries = lines.slice(1).map(line => {
            const [date, time, file] = line.split(',');
            return { date, time, file };
        });

        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

        // Find the track that should be playing right now
        // We look for the latest entry that is less than or equal to current time
        let currentEntry = null;
        for (const entry of entries) {
            if (entry.date === currentDate && entry.time <= currentTime) {
                if (!currentEntry || entry.time > currentEntry.time) {
                    currentEntry = entry;
                }
            }
        }

        if (currentEntry) {
            return currentEntry.file;
        }

        return "SILENCE";
    } catch (err) {
        return "SILENCE";
    }
}

console.log(getCurrentTrack());
