// db.js (project root)
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "data.sqlite");
const db = new Database(DB_PATH);

function init() {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS markets (
      slug TEXT PRIMARY KEY,
      title TEXT,
      sport TEXT,
      league TEXT,
      market_type TEXT,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      ts TEXT NOT NULL,

      live INTEGER,
      ended INTEGER,
      period TEXT,
      elapsed TEXT,
      score TEXT,

      best_bid REAL,
      best_ask REAL,
      last_trade REAL,
      spread REAL,

      outcome_prices TEXT,  -- store as JSON string
      raw TEXT              -- store as JSON string
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_slug_ts ON snapshots(slug, ts);
    CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts);
  `);
}

module.exports = { db, init };
