PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  season TEXT,
  game_date TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  final_home_score INTEGER,
  final_away_score INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  period INTEGER,
  clock TEXT,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  home_fouls INTEGER,
  away_fouls INTEGER,
  home_timeouts INTEGER,
  away_timeouts INTEGER,
  source TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  market TEXT NOT NULL,
  venue TEXT NOT NULL,
  price REAL NOT NULL,
  raw TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS idx_score_game_ts ON score_snapshots(game_id, ts);
CREATE INDEX IF NOT EXISTS idx_mkt_game_ts ON market_snapshots(game_id, ts);
