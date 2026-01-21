// E:\prediction_basketball\db.js
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(__dirname, "data", "app.sqlite");

const fs = require("fs");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Improve concurrency + safety
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function init() {
  // ---- core tables you already use ----
  db.prepare(`
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
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS games (
      slug TEXT PRIMARY KEY,
      title TEXT,
      event_date TEXT,
      start_time TEXT,
      game_id TEXT
    )
  `).run();

  db.prepare(`
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
      outcome_prices TEXT,
      raw TEXT,
      FOREIGN KEY(slug) REFERENCES games(slug)
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_snapshots_slug_ts ON snapshots (slug, ts)`).run();

  // ---- NEW: players table (for /api/nba/db/players/search) ----
  // Keep schema flexible. person_id is the stable key from many providers.
  db.prepare(`
    CREATE TABLE IF NOT EXISTS players (
      person_id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      display_first_last TEXT,
      team_id INTEGER,
      team_abbreviation TEXT,
      provider TEXT,
      raw TEXT,
      updated_at TEXT
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_players_display ON players (display_first_last)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_players_last ON players (last_name)`).run();
}

module.exports = { db, init, DB_PATH };
