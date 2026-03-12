const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const db = require('./db');
const webpush = require('web-push');

// VAPID config for push notifications
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const LISTENERS_FILE = path.join(__dirname, '..', 'data', 'listeners.json');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET env var is required') })();

// System Health Endpoint
app.get('/api/system/health', (req, res) => {
    // 1. Storage
    const storageCmd = "df -h / | tail -1 | awk '{print $5 \" used of \" $2}'";
    // 2. Memory
    const memoryCmd = "free -m | grep Mem | awk '{print $3 \"MB / \" $2 \"MB\"}'";
    // 3. CPU Load (1-min)
    const cpuCmd = "uptime | awk -F'load average:' '{ print $2 }' | cut -d',' -f1";
    // 4. Latency (Ping 8.8.8.8)
    const latencyCmd = "ping -c 1 8.8.8.8 | grep 'time=' | awk -F'time=' '{print $2}' | cut -d' ' -f1";

    const stats = { storage: '---', memory: '---', cpu: '---', latency: '---' };

    exec(storageCmd, (err, out) => {
        if (!err) stats.storage = out.trim();
        exec(memoryCmd, (err, out) => {
            if (!err) stats.memory = out.trim();
            exec(cpuCmd, (err, out) => {
                if (!err) stats.cpu = out.trim() + " Load";
                exec(latencyCmd, (err, out) => {
                    if (!err) stats.latency = out.trim() + "ms";
                    res.json(stats);
                });
            });
        });
    });
});
const MUSIC_DIR = path.join(__dirname, '..', 'data', 'radio', 'music');
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'radio', 'uploads');
const PORT = process.env.PORT || 8080;

// Setup Multer for track uploads
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'broadcast_media') return cb(null, UPLOADS_DIR);
        cb(null, MUSIC_DIR);
    },
    filename: (req, file, cb) => {
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const dir = file.fieldname === 'broadcast_media' ? UPLOADS_DIR : MUSIC_DIR;
        const fullPath = path.join(dir, cleanName);
        if (fs.existsSync(fullPath)) {
            const ext = path.extname(cleanName);
            const base = path.basename(cleanName, ext);
            cb(null, `${base}_${Date.now()}${ext}`);
        } else {
            cb(null, cleanName);
        }
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Initialize Default Admin (admin/admin)
bcrypt.hash('admin', 10, (err, hash) => {
    db.run(`INSERT OR IGNORE INTO users (username, password) VALUES ('admin', ?)`, [hash]);
});

// Sync existing files on startup
async function syncTracksWithDisk() {
    console.log('🔄 Syncing tracks with disk...');
    try {
        if (!fs.existsSync(MUSIC_DIR)) {
            console.log('📁 Music directory not found, skipping sync.');
            return;
        }
        const files = fs.readdirSync(MUSIC_DIR).filter(f => f.toLowerCase().endsWith('.mp3'));

        // Remove tracks from DB that are not on disk
        db.all('SELECT id, filename FROM tracks', [], (err, rows) => {
            if (rows) {
                rows.forEach(row => {
                    if (!files.includes(row.filename)) {
                        console.log(`🗑️ Removing missing track from DB: ${row.filename}`);
                        db.run('DELETE FROM tracks WHERE id = ?', [row.id]);
                        db.run('DELETE FROM playlist_tracks WHERE track_id = ?', [row.id]);
                    }
                });
            }
        });

        // Add new tracks from disk
        for (const file of files) {
            const fullPath = path.join(MUSIC_DIR, file);
            const stats = fs.statSync(fullPath);
            db.run(`INSERT OR IGNORE INTO tracks (filename, originalname, size) VALUES (?, ?, ?)`,
                [file, file, stats.size]);
        }
        console.log(`✅ Sync complete. Found ${files.length} files.`);
    } catch (err) {
        console.error('❌ Sync failed:', err);
    }
}
syncTracksWithDisk();

// Auth Middleware
const auth = (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

/* --- AUTHENTICATION --- */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    });
});

/* --- TRACKS --- */
app.get('/api/tracks', auth, (req, res) => {
    db.all('SELECT * FROM tracks ORDER BY uploaded_at DESC', (err, rows) => res.json(rows));
});

app.post('/api/tracks', auth, upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        console.error('[Upload] No files received by Multer');
        return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[Upload] Received ${req.files.length} files. Starting DB insertion...`);

    db.serialize(() => {
        const stmt = db.prepare('INSERT INTO tracks (filename, originalname, size) VALUES (?, ?, ?)');
        let hasError = false;

        req.files.forEach(f => {
            stmt.run(f.filename, f.originalname, f.size, (err) => {
                if (err) {
                    console.error(`[Upload Error] DB insert failed for ${f.filename}:`, err.message);
                    hasError = true;
                }
            });
        });

        stmt.finalize((err) => {
            if (err || hasError) {
                console.error('[Upload Error] Finalize failed or insertion error occurred');
                return res.status(500).json({ error: 'Database update failed' });
            }
            console.log(`[Upload] Successfully processed ${req.files.length} tracks.`);
            res.json({ success: true, files: req.files.map(f => f.filename) });
        });
    });
});

app.get('/api/tracks/:id/stream', auth, (req, res) => {
    db.get('SELECT filename FROM tracks WHERE id = ?', [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: 'Track not found' });
        const filePath = path.join(MUSIC_DIR, row.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File on disk not found' });

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg',
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }
    });
});

app.delete('/api/tracks/:id', auth, (req, res) => {
    db.get('SELECT filename FROM tracks WHERE id = ?', [req.params.id], (err, row) => {
        if (row) {
            fs.unlink(path.join(MUSIC_DIR, row.filename), () => { });
            db.run('DELETE FROM tracks WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Track not found' });
        }
    });
});

app.post('/api/broadcast/upload', auth, upload.single('broadcast_media'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ success: true, filename: req.file.filename });
});

/* --- MEDIA MANAGEMENT --- */
app.get('/api/media', auth, (req, res) => {
    console.log(`[Media] Fetching media from: ${UPLOADS_DIR}`);
    try {
        if (!fs.existsSync(UPLOADS_DIR)) {
            console.log(`[Media] UPLOADS_DIR does not exist at: ${UPLOADS_DIR}`);
            return res.json([]);
        }
        const filenames = fs.readdirSync(UPLOADS_DIR);
        console.log(`[Media] Found ${filenames.length} files in directory.`);

        const files = filenames
            .filter(f => !f.startsWith('.'))
            .map(f => {
                const stat = fs.statSync(path.join(UPLOADS_DIR, f));
                return {
                    name: f,
                    size: stat.size,
                    mtime: stat.mtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime);
        res.json(files);
    } catch (err) {
        console.error('[Media] Error listing media:', err);
        res.status(500).json({ error: 'Failed to list media' });
    }
});

app.post('/api/media/rename', auth, (req, res) => {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) return res.status(400).json({ error: 'Names required' });

    const oldPath = path.join(UPLOADS_DIR, oldName);
    let cleanNewName = newName.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (!cleanNewName.toLowerCase().endsWith('.mp3')) cleanNewName += '.mp3';
    const newPath = path.join(UPLOADS_DIR, cleanNewName);

    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'File not found' });
    if (fs.existsSync(newPath)) return res.status(400).json({ error: 'Target name already exists' });

    try {
        fs.renameSync(oldPath, newPath);
        // Also update any schedules pointing to this file
        db.run('UPDATE schedule SET audio_file = ? WHERE audio_file = ?', [cleanNewName, oldName], (err) => {
            if (err) console.error('Failed to update schedule for renamed file:', err);
            res.json({ success: true, newName: cleanNewName });
        });
    } catch (err) {
        res.status(500).json({ error: 'Rename failed' });
    }
});

app.delete('/api/media/:filename', auth, (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    try {
        fs.unlinkSync(filePath);
        // Also nullify any schedules pointing to this file
        db.run('UPDATE schedule SET audio_file = NULL WHERE audio_file = ?', [filename], (err) => {
            if (err) console.error('Failed to update schedule for deleted file:', err);
            res.json({ success: true });
        });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

/* --- PLAYLISTS --- */
// Create Playlist
app.post('/api/playlists', auth, (req, res) => {
    const { name, track_ids } = req.body; // track_ids is array of ids
    db.run('INSERT INTO playlists (name) VALUES (?)', [name], function (err) {
        if (err) return res.status(400).json({ error: 'Name exists' });
        const playlist_id = this.lastID;
        const stmt = db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)');
        track_ids.forEach((id, index) => stmt.run(playlist_id, id, index));
        stmt.finalize();
        res.json({ id: playlist_id, name });
    });
});

app.get('/api/playlists', auth, (req, res) => {
    db.all(`
        SELECT p.*, COUNT(pt.track_id) as track_count 
        FROM playlists p 
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id 
        GROUP BY p.id
    `, (err, rows) => res.json(rows));
});

app.get('/api/playlists/:id/tracks', auth, (req, res) => {
    db.all(`
        SELECT t.* FROM tracks t 
        JOIN playlist_tracks pt ON t.id = pt.track_id 
        WHERE pt.playlist_id = ? ORDER BY pt.position ASC
    `, [req.params.id], (err, rows) => res.json(rows));
});

app.post('/api/playlists/:id/tracks', auth, (req, res) => {
    const playlist_id = req.params.id;
    const { track_id } = req.body;
    db.get('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?', [playlist_id], (err, row) => {
        const nextPos = (row && row.maxPos !== null) ? row.maxPos + 1 : 0;
        db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [playlist_id, track_id, nextPos], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
    });
});

app.delete('/api/playlists/:id/tracks/:track_id', auth, (req, res) => {
    db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [req.params.id, req.params.track_id], (err) => {
        res.json({ success: true });
    });
});

app.delete('/api/playlists/:id', auth, (req, res) => {
    db.run('DELETE FROM playlists WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

/* --- SCHEDULING --- */
app.get('/api/schedule', auth, (req, res) => {
    const { start, end } = req.query; // unix timestamps
    let query = 'SELECT * FROM schedule';
    let params = [];
    if (start && end) {
        query += ' WHERE start_time >= ? AND end_time <= ?';
        params = [start, end];
    }
    db.all(query, params, (err, rows) => res.json(rows));
});

// Bulk sync schedule (used by Next.js admin)
app.post('/api/schedule/sync', auth, (req, res) => {
    const { events } = req.body; // array of { title, type, item_id, start_time, end_time, ... }

    if (!events || !events.length) {
        db.run('DELETE FROM schedule', () => res.json({ success: true, count: 0 }));
        return;
    }

    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) return res.status(500).json({ error: 'Failed to start transaction' });

            db.run('DELETE FROM schedule', (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to clear schedule' });
                }

                const stmt = db.prepare(`
                    INSERT INTO schedule (
                        title, type, item_id, db_id, start_time, end_time, 
                        instagram_url, soundcloud_url, mixcloud_url, 
                        broadcast_image, audio_file, external_stream_url,
                        track_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                let insertError = false;

                sorted.forEach(ev => {
                    stmt.run(
                        ev.title, ev.type, ev.item_id, ev.db_id || null, ev.start_time, ev.end_time,
                        ev.instagram_url || null, ev.soundcloud_url || null, ev.mixcloud_url || null,
                        ev.broadcast_image || null, ev.audio_file || null, ev.external_stream_url || null,
                        ev.track_name || null,
                        (err) => {
                            if (err) insertError = true;
                        }
                    );
                });

                stmt.finalize((err) => {
                    if (err || insertError) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Database update failed' });
                    }
                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to commit transaction' });
                        }
                        res.json({ success: true, count: sorted.length });
                    });
                });
            });
        });
    });
});

app.post('/api/schedule', auth, (req, res) => {
    const {
        title, type, item_id, start_time, end_time,
        db_id, instagram_url, soundcloud_url, mixcloud_url,
        broadcast_image, audio_file, external_stream_url, track_name
    } = req.body;

    // Validation: no overlap with existing database events
    db.get('SELECT title FROM schedule WHERE (? < end_time AND ? > start_time)', [start_time, end_time], (err, row) => {
        if (row) return res.status(400).json({ error: `Это время уже занято событием: "${row.title}"` });

        const sql = `
            INSERT INTO schedule (
                title, type, item_id, start_time, end_time,
                db_id, instagram_url, soundcloud_url, mixcloud_url,
                broadcast_image, audio_file, external_stream_url, track_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
            title, type, item_id, start_time, end_time,
            db_id || null, instagram_url || null, soundcloud_url || null, mixcloud_url || null,
            broadcast_image || null, audio_file || null, external_stream_url || null, track_name || null
        ], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id: this.lastID,
                title, type, item_id, start_time, end_time,
                db_id, instagram_url, soundcloud_url, mixcloud_url,
                broadcast_image, audio_file, external_stream_url, track_name
            });
        });
    });
});
app.put('/api/schedule/:id', auth, (req, res) => {
    const {
        title, type, item_id, start_time, end_time,
        db_id, instagram_url, soundcloud_url, mixcloud_url,
        broadcast_image, audio_file, external_stream_url, track_name
    } = req.body;
    const { id } = req.params;

    // Validation: no overlap (excluding self)
    db.get('SELECT title FROM schedule WHERE id != ? AND (? < end_time AND ? > start_time)', [id, start_time, end_time], (err, row) => {
        if (row) return res.status(400).json({ error: `Новое время пересекается с событием: "${row.title}"` });

        const sql = `
            UPDATE schedule SET 
                title = ?, type = ?, item_id = ?, start_time = ?, end_time = ?,
                db_id = ?, instagram_url = ?, soundcloud_url = ?, mixcloud_url = ?,
                broadcast_image = ?, audio_file = ?, external_stream_url = ?, track_name = ?
            WHERE id = ?
        `;

        db.run(sql, [
            title, type, item_id, start_time, end_time,
            db_id || null, instagram_url || null, soundcloud_url || null, mixcloud_url || null,
            broadcast_image || null, audio_file || null, external_stream_url || null, track_name || null,
            id
        ], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id,
                title, type, item_id, start_time, end_time,
                db_id, instagram_url, soundcloud_url, mixcloud_url,
                broadcast_image, audio_file, external_stream_url, track_name
            });
        });
    });
});

app.delete('/api/schedule/:id', auth, (req, res) => {
    db.run('DELETE FROM schedule WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});


// Serve frontend build & uploads
app.use('/broadcast-media', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let onlineCount = 0;
let currentTrack = null;

io.on('connection', (socket) => {
    onlineCount++;
    console.log(`[Socket] User connected. Online: ${onlineCount}`);
    io.emit('stats:update', { onlineCount });
    if (currentTrack) {
        socket.emit('now-playing:update', currentTrack);
    }

    socket.on('reaction', (data) => {
        // Broadcast reaction to all other clients
        socket.broadcast.emit('reaction', data);
    });

    socket.on('disconnect', () => {
        onlineCount = Math.max(0, onlineCount - 1);
        console.log(`[Socket] User disconnected. Online: ${onlineCount}`);
        io.emit('stats:update', { onlineCount });
    });
});

server.listen(PORT, () => console.log(`BØDEN Backend (with Sockets) running on port ${PORT}`));

// --- NOTIFICATION WORKER ---

async function checkNotifications() {
    const now = Date.now();
    const check24h = now + 24 * 60 * 60 * 1000;
    const check10m = now + 10 * 60 * 1000;

    // Broad window to catch events (checked every 5 mins)
    const windowMs = 6 * 60 * 1000;

    db.all(`
        SELECT * FROM schedule 
        WHERE (start_time BETWEEN ? AND ?) 
           OR (start_time BETWEEN ? AND ?)
    `, [check24h - windowMs, check24h + windowMs,
    check10m - windowMs, check10m + windowMs], async (err, rows) => {

        if (err || !rows || rows.length === 0) return;

        // Load listeners from Next.js data folder
        let listeners = [];
        try {
            if (fs.existsSync(LISTENERS_FILE)) {
                listeners = JSON.parse(fs.readFileSync(LISTENERS_FILE, 'utf8'));
            }
        } catch (e) {
            console.error("[Notifications] Failed to load listeners:", e.message);
            return;
        }

        for (const row of rows) {
            if (!row.db_id) continue;

            const timeDiff24h = Math.abs(row.start_time - check24h);
            const timeDiff10m = Math.abs(row.start_time - check10m);
            const type = timeDiff24h < timeDiff10m ? '24h' : '10m';

            // Check if already logged
            db.get('SELECT id FROM notification_logs WHERE schedule_id = ? AND type = ?', [row.id, type], async (err, log) => {
                if (log) return;

                const artistName = row.title.replace('[SYNC] ', '').replace('[TRACK] ', '');
                const startTime = new Date(row.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const startDate = new Date(row.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                const payload = JSON.stringify({
                    title: type === '24h' ? `Favorite Artist Alert 🌟` : `Starting Soon! 🔥`,
                    body: type === '24h'
                        ? `Your favorite artist ${artistName} will be playing on ${startDate} at ${startTime}.`
                        : `Almost there! ${artistName} is about to play. Don't miss it!`,
                    icon: "/icons/icon-192.png",
                    url: "/"
                });

                const interestedListeners = listeners.filter(l =>
                    l.pushEnabled &&
                    l.favoriteArtists?.includes(row.db_id) &&
                    l.pushSubscriptions?.length > 0
                );

                if (interestedListeners.length === 0) {
                    // Log even if no one is listening to skip this check next time
                    db.run('INSERT INTO notification_logs (schedule_id, type) VALUES (?, ?)', [row.id, type]);
                    return;
                }

                console.log(`[Notifications] Sending ${type} alert for ${artistName} to ${interestedListeners.length} fans`);

                let sentAny = false;
                for (const listener of interestedListeners) {
                    for (const sub of listener.pushSubscriptions) {
                        try {
                            await webpush.sendNotification(sub, payload);
                            sentAny = true;
                        } catch (e) {
                            if (e.statusCode === 410) {
                                // Subscription expired/gone
                            }
                        }
                    }
                }

                db.run('INSERT INTO notification_logs (schedule_id, type) VALUES (?, ?)', [row.id, type]);
            });
        }
    });
}

// Every 5 minutes
setInterval(checkNotifications, 5 * 60 * 1000);
// Initial delay to let DB initialize
setTimeout(checkNotifications, 10000);

// --- CUSTOM AUDIO ENGINE (FFMPEG MIXER) ---
const { PassThrough } = require('stream');
const { spawn } = require('child_process');

const radioStream = new PassThrough();
let engineFFmpeg = null;
let listeners = new Set();
let engineCurrentTrack = null;

// Periodically check if we need to switch track in the engine
function syncEngineWithSchedule() {
    const now = Date.now();
    db.get('SELECT * FROM schedule WHERE start_time <= ? AND end_time > ? ORDER BY start_time DESC LIMIT 1', [now, now], (err, row) => {
        if (err) return;

        let targetFile = null;
        let isExternal = false;
        let startTimeOffset = 0;

        if (row) {
            if (row.external_stream_url) {
                targetFile = row.external_stream_url;
                isExternal = true;
            } else if (row.audio_file) {
                targetFile = path.join(UPLOADS_DIR, row.audio_file);
                startTimeOffset = (now - row.start_time) / 1000;
            }
        }

        // If something is playing but it's different from what engine is doing
        const engineId = row ? (row.external_stream_url || row.audio_file) : 'silence';
        if (engineCurrentTrack !== engineId) {
            console.log(`[Engine] Switching to: ${engineId}`);
            engineCurrentTrack = engineId;
            startEngineProcess(targetFile, isExternal, startTimeOffset);
        }
    });
}

function startEngineProcess(targetFile, isExternal, offset = 0) {
    if (engineFFmpeg) {
        engineFFmpeg.kill('SIGKILL');
    }

    let args = [];
    if (!targetFile || !fs.existsSync(targetFile)) {
        // Play silence if no file
        args = ['-re', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-f', 'mp3', '-acodec', 'libmp3lame', '-ab', '128k', '-'];
    } else {
        if (isExternal) {
            args = ['-i', targetFile, '-f', 'mp3', '-acodec', 'libmp3lame', '-ab', '128k', '-'];
        } else {
            // Seek to current offset for precise timing
            args = ['-re', '-ss', offset.toString(), '-i', targetFile, '-f', 'mp3', '-acodec', 'libmp3lame', '-ab', '128k', '-'];
        }
    }

    engineFFmpeg = spawn('ffmpeg', args);

    engineFFmpeg.stdout.on('data', (chunk) => {
        radioStream.write(chunk);
    });

    engineFFmpeg.on('exit', () => {
        // If it exited naturally, sync again
        setTimeout(syncEngineWithSchedule, 100);
    });

    engineFFmpeg.stderr.on('data', (data) => {
        // Debug engine if needed: console.log(`ffmpeg: ${data}`);
    });
}

// Broadcast to all connected listeners
radioStream.on('data', (chunk) => {
    listeners.forEach(res => {
        try {
            res.write(chunk);
        } catch (e) {
            listeners.delete(res);
        }
    });
});

// Unified Stream Endpoint
app.get('/api/stream.mp3', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    listeners.add(res);

    req.on('close', () => {
        listeners.delete(res);
    });
});

// Start engine sync
setInterval(syncEngineWithSchedule, 5000);
syncEngineWithSchedule();

// --- NOW PLAYING MONITOR ---
function updateNowPlaying() {
    const now = Date.now();
    db.get('SELECT * FROM schedule WHERE start_time <= ? AND end_time > ? ORDER BY start_time DESC LIMIT 1', [now, now], (err, row) => {
        if (err) return;
        if (!row) {
            if (currentTrack !== null) {
                currentTrack = null;
                io.emit('now-playing:update', null);
            }
            return;
        }

        const newTrack = {
            title: row.title,
            trackName: row.track_name || row.title.replace(/\[SYNC\] |\[TRACK\] |\[PLAYLIST\] /g, ''),
            startTime: row.start_time,
            endTime: row.end_time,
            type: row.type,
            audio_file: row.audio_file,
            external_stream_url: row.external_stream_url
        };

        // 1. Update Socket UI (Banner) if changed
        if (!currentTrack || currentTrack.startTime !== newTrack.startTime || currentTrack.title !== newTrack.title) {
            currentTrack = newTrack;
            console.log(`[Monitor] Updating now-playing: ${currentTrack.title}`);
            io.emit('now-playing:update', currentTrack);
        }
    });
}


// Every 10 seconds check the DB to keep the banner fresh
setInterval(updateNowPlaying, 10000);
updateNowPlaying();
