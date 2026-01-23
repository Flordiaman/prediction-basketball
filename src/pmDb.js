// src/pmDb.js
const path = require("path");
const Database = require("better-sqlite3");

function openPmDb(dbPath = process.env.PM_DB_PATH || path.join(process.cwd(), "polymarket.sqlite")) {
  const db = new Database(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS pm_markets (
      slug TEXT PRIMARY KEY,
      league TEXT,
      title TEXT,
      active INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pm_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      ts TEXT NOT NULL,
      price REAL,
      best_bid REAL,
      best_ask REAL,
      volume REAL,
      raw_json TEXT,
      FOREIGN KEY (slug) REFERENCES pm_markets(slug)
    );

    CREATE INDEX IF NOT EXISTS idx_pm_snapshots_slug_ts ON pm_snapshots(slug, ts);
  `);

  return db;
}

module.exports = { openPmDb };
