const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Authentication user table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // Tracks table
  db.run(`CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE,
    originalname TEXT,
    size INTEGER,
    duration REAL DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Playlists table
  db.run(`CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Playlist to Track mapping (M:N)
  db.run(`CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER,
    track_id INTEGER,
    position INTEGER,
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
  )`);

  // Schedule mapping
  db.run(`CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT, -- 'track' or 'playlist'
    item_id INTEGER, -- refers to tracks(id) or playlists(id)
    db_id TEXT, -- refers to master artist ID
    start_time INTEGER, -- Unix timestamp (milliseconds)
    end_time INTEGER, -- Unix timestamp (milliseconds)
    instagram_url TEXT,
    soundcloud_url TEXT,
    mixcloud_url TEXT,
    broadcast_image TEXT,
    audio_file TEXT,
    external_stream_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Notification logs table
  db.run(`CREATE TABLE IF NOT EXISTS notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    type TEXT, -- '24h' or '10m'
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE CASCADE
  )`);

  // Add columns if they don't exist (migrations)
  const columns = [
    'instagram_url', 'soundcloud_url', 'mixcloud_url',
    'broadcast_image', 'audio_file', 'external_stream_url', 'db_id'
  ];
  columns.forEach(col => {
    db.run(`ALTER TABLE schedule ADD COLUMN ${col} TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        // Ignore duplicate column errors, but log others
      }
    });
  });
});

module.exports = db;
