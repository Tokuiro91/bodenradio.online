const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'boden_radio_secret_key_123!';
const MUSIC_DIR = '/var/radio/music';
const UPLOADS_DIR = '/var/radio/uploads';
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
const upload = multer({ storage });

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
                        title, type, item_id, start_time, end_time, 
                        instagram_url, soundcloud_url, mixcloud_url, 
                        broadcast_image, audio_file, external_stream_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                let insertError = false;

                sorted.forEach(ev => {
                    stmt.run(
                        ev.title, ev.type, ev.item_id, ev.start_time, ev.end_time,
                        ev.instagram_url || null, ev.soundcloud_url || null, ev.mixcloud_url || null,
                        ev.broadcast_image || null, ev.audio_file || null, ev.external_stream_url || null,
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
    const { title, type, item_id, start_time, end_time } = req.body;

    // Validation: no overlap with existing database events
    db.get('SELECT title FROM schedule WHERE (? < end_time AND ? > start_time)', [start_time, end_time], (err, row) => {
        if (row) return res.status(400).json({ error: `Это время уже занято событием: "${row.title}"` });

        db.run('INSERT INTO schedule (title, type, item_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
            [title, type, item_id, start_time, end_time],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    id: this.lastID,
                    title,
                    type,
                    item_id,
                    start_time,
                    end_time
                });
            }
        );
    });
});

app.put('/api/schedule/:id', auth, (req, res) => {
    const { title, type, item_id, start_time, end_time } = req.body;
    const { id } = req.params;

    // Validation: no overlap (excluding self)
    db.get('SELECT title FROM schedule WHERE id != ? AND (? < end_time AND ? > start_time)', [id, start_time, end_time], (err, row) => {
        if (row) return res.status(400).json({ error: `Новое время пересекается с событием: "${row.title}"` });

        db.run('UPDATE schedule SET title = ?, type = ?, item_id = ?, start_time = ?, end_time = ? WHERE id = ?',
            [title, type, item_id, start_time, end_time, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id, title, type, item_id, start_time, end_time });
            }
        );
    });
});

app.delete('/api/schedule/:id', auth, (req, res) => {
    db.run('DELETE FROM schedule WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

/* --- LIQUIDSOAP INTEGRATION BRIDGE --- */
app.get('/internal/next', (req, res) => {
    const now = Date.now();
    // Find active schedule
    db.get('SELECT * FROM schedule WHERE start_time <= ? AND end_time > ? ORDER BY id ASC', [now, now], (err, schedule) => {
        if (!schedule) return res.status(404).send('NO_SCHEDULE');

        const offsetSeconds = Math.max(0, Math.floor((now - schedule.start_time) / 1000));
        const totalDurationSeconds = Math.max(1, Math.floor((schedule.end_time - schedule.start_time) / 1000));
        const fadeOutDuration = 5.0;

        // Priority 1: External Stream URL
        if (schedule.external_stream_url) {
            return res.send(`annotate:liq_cue_out=${totalDurationSeconds},liq_fade_out=${fadeOutDuration}:${schedule.external_stream_url}`);
        }

        // Priority 2: Custom Audio File
        if (schedule.audio_file) {
            const fullPath = path.join(UPLOADS_DIR, schedule.audio_file);
            return res.send(`annotate:liq_cue_in=${offsetSeconds},liq_cue_out=${totalDurationSeconds},liq_fade_out=${fadeOutDuration},liq_start=${offsetSeconds}:${fullPath}`);
        }

        // Priority 3: Regular track/playlist items
        if (schedule.type === 'track') {
            db.get('SELECT filename FROM tracks WHERE id = ?', [schedule.item_id], (err, track) => {
                if (track) {
                    const fullPath = path.join(MUSIC_DIR, track.filename);
                    return res.send(`annotate:liq_cue_in=${offsetSeconds},liq_cue_out=${totalDurationSeconds},liq_fade_out=${fadeOutDuration},liq_start=${offsetSeconds}:${fullPath}`);
                }
                res.status(404).send('TRACK_NOT_FOUND');
            });
        } else if (schedule.type === 'playlist') {
            db.get(`
                SELECT t.filename FROM playlist_tracks pt 
                JOIN tracks t ON t.id = pt.track_id 
                WHERE pt.playlist_id = ? 
                ORDER BY pt.position ASC LIMIT 1
            `, [schedule.item_id], (err, track) => {
                if (track) {
                    const fullPath = path.join(MUSIC_DIR, track.filename);
                    return res.send(`annotate:liq_cue_in=${offsetSeconds},liq_cue_out=${totalDurationSeconds},liq_fade_out=${fadeOutDuration},liq_start=${offsetSeconds}:${fullPath}`);
                }
                res.status(404).send('PLAYLIST_EMPTY');
            });
        }
    });
});

// Serve frontend build & uploads
app.use('/broadcast-media', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`BØDEN Backend running on port ${PORT}`));
